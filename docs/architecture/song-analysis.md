# Song Analysis

Song analysis is an asynchronous work pipeline.

When a search result is selected, the user app first calls `GET /api/songs?title=...&artistName=...` to exact-match an existing song+lyric. If it returns `200`, the app immediately uses player data. If it returns `204`, the app calls `/api/songs/analyze` to create or reuse `song_analysis_work`.

Recommendation analysis also reuses `song_analysis_work`, but only after an operator approves a collected candidate. The admin recommendation operation creates or reuses work with `trigger_source=RECOMMENDATION`; the generic song-analysis worker does not import or know about recommendation tables.

Admin song detail can trigger existing-song reanalysis with `POST /admin/api/songs/{songId}/reanalysis`. The endpoint creates or reuses a song-scoped `song_analysis_work` with `trigger_source=ADMIN`, returns an active blocker when one exists, and preserves the product constraint that this feature stores only the newly produced MV URL on `song_analysis_work.youtube_url`; it does not add `previous_youtube_url`.

`/api/songs/analyze` does not synchronously fetch lyrics, YouTube data, or provider data. It immediately returns work status. The user app polls `/api/songs/analysis-work/{workId}` and reads `GET /api/songs/{id}` once the `song_id + lyric_id + player_ready_at` milestone exists.

## Flow

1. **Trigger** (`api`/`admin-api` + `song-analysis`): analyze request or approved recommendation candidate -> `SongAnalysisWorkService.createOrReuse()` -> returns existing active raw `title|artist` workId or creates `song_analysis_work(PENDING)`.
2. **Batch claim** (`batch`, `SongAnalysisWorkScheduler`, `@Scheduled fixedRate=30s`): claims `PENDING` work, changes it to `RUNNING`, and records lock owner/until.
3. **Pre-analysis pipeline** (`batch` + `song`): stage changes through `FETCH_LYRICS` -> `FETCH_YOUTUBE` -> `CREATE_SONG_AND_LYRIC`, running LRCLIB/VocaDB lyric lookup, YouTube MV lookup, and songs+lyrics creation.
4. **Player-ready milestone**: once song and lyric are created, `song_id`, `lyric_id`, and `player_ready_at` are set. `PLAYER_READY` is not a status.
5. **Lyric analysis** (`batch` + `translation`): stage `ANALYZE_LYRICS` runs `KoreanLyricTranslationService.runPipeline()`. A batch-local completion service saves `lyrics.analyzed_content` and marks work `COMPLETED` in the same transaction. For admin reanalysis of an existing song, completion is also the active-result switch boundary: the old active lyric/MV remains visible until completion atomically moves the song to the candidate lyric and work-produced MV.

Work status uses only `PENDING`, `RUNNING`, `COMPLETED`, and `FAILED`. The first pass has no request table, attempt table, automatic retry, MQ, or FCM completion path. On failure, work becomes `FAILED` and `active_dedup_key` is cleared so the same song can create a new work later. `lyrics` stores original/analyzed content only; `song_analysis_work` owns the state machine.

`trigger_source` values:

- `USER_APP`: user app `/api/songs/analyze`
- `ADMIN`: reserved for admin-triggered analysis
- `RECOMMENDATION`: admin recommendation dispatch after candidate approval


## Admin Song Reanalysis

Admin song detail can trigger `POST /admin/api/songs/{songId}/reanalysis`. The endpoint creates or returns a `song_analysis_work` with `trigger_source=ADMIN`, `song_id` set to the target song, and an admin-scoped active dedupe key. Any active `PENDING` or `RUNNING` work for the song blocks a new admin work, regardless of trigger source. A raw `title|artist` active work without a `song_id` also blocks conservatively.

Admin reanalysis reruns lyric lookup, YouTube lookup, lyric creation, and analysis for the existing song. It creates a new lyric row rather than reusing the current active lyric. The candidate lyric and the newly produced MV are attached to `song_analysis_work.lyric_id` and `song_analysis_work.youtube_url` at the player-ready milestone, but the public/admin active read paths continue to use `songs.active_lyric_id` until completion.

Completion is the active switch boundary: it locks the work row and target song row, writes analyzed content to the candidate lyric, updates `songs.active_lyric_id`, overwrites current `songs.youtube_url` with the work-produced MV, updates `songs.updated_at`, and marks the work `COMPLETED`. Failures never mutate the active song pointer or MV. Previous lyric rows remain queryable for audit/comparison; previous active MV values are not guaranteed to be retained. Do not add `previous_youtube_url`; only the newly produced MV belongs on `song_analysis_work.youtube_url`.

## Word Meaning Pipeline

2026-07 guardrail redesign, meaning generation stage: `gemini-3.1-flash-lite`.

Detailed design: `docs/translation-pipeline.md`.

Flow: `(translation || [segment -> surface check/retry -> grammar rules -> jisho/i-adjective normalize]) -> sense-select -> sense-translate -> assemble`.

`KoreanLyricTranslationService` is the orchestrator. Concrete steps live in `translation.service.pipeline.stage` as `PipelineStage<I, O>` implementations, and stage DTOs live in `translation.model`.

1. **translate lyrics** (LLM): original line -> Korean lyrics/pronunciation. This gives sense-select context.
2. **segment** (LLM): original line -> semantic segments + lemma restoration. Replaces Kuromoji.
3. **surface check/retry** (code): validates segmented surfaces cover the original Japanese text in order. Failed segmentation is retried.
4. **grammar rules** (code): deterministically handles only grammar tokens that lexical lookup cannot reliably recover, such as `ている/てる`, particles, and `どうも こうも` rewrite. Ambiguous words such as `ない` and `から` stay out of the rule table.
5. **jisho + i-adjective normalize** (code): segmented headwords -> candidate sense list. Unsafe fallbacks are rejected, and i-adjective adverbials such as `高く` can be normalized through a `高い` probe.
6. **sense-select** (LLM): chooses the matching sense ID for each word using lyric translation as context. It does not create meanings directly.
7. **sense-translate** (LLM): translates each chosen Japanese sense to one Korean meaning. Multiple English glosses for one sense are treated as one sense description, not concatenated gloss translations.
8. **assemble** (code): fills reading, POS, JLPT, and meaning from rule results or selected sense. If no sense exists, leave it empty. Non-Japanese punctuation, English, and numbers are marked `SYMBOL`.

Failures end as `song_analysis_work.status=FAILED` without automatic retry in the first pass. If the user requests the same song again, a new work is created.

Experiment and validation code: `gemini-playground/word-meaning-harness/`. Cost is approximately `$0.031/song`.

> If Redis DTO schema for jisho cache changes, clear old `jisho:*` cache. Unknown-field-tolerant deserialization can turn old cached values into empty results, causing tokens to lose meaning/POS without obvious error logs.

## Major Word Ranking

Important vocabulary can be ranked from `lyrics.analyzed_content` without a
corpus-wide TF-IDF table. The current design uses single-lyric signals such as
line coverage, capped frequency, line dispersion, title/theme boosts, POS
weights, and learning-value penalties for pronouns, generic words, and katakana
loanwords.

See [major-word-scoring.md](major-word-scoring.md).
