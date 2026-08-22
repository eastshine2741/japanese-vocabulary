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

Detailed design: `docs/translation-pipeline.md`.

Flow: `(translation || [segment -> surface/reading check + retry -> grammar rules -> jisho entry-select]) -> sense-select -> sense-translate -> assemble`.

`KoreanLyricTranslationService` is the orchestrator. Concrete steps live in `translation.service.pipeline.stage` as `PipelineStage<I, O>` implementations, and stage DTOs live in `translation.model`.

1. **translate lyrics** (LLM, `gemini.translation-model`): original line -> Korean lyrics. This gives sense-select context. It no longer produces a pronunciation.
2. **segment** (LLM, `gemini.segmentation-model`): original line -> segments, each with `surface`, `headword`, `usedReading`, `baseFormReading` (both katakana), and a short English `contextGloss`. Replaces Kuromoji. This stage carries the pipeline's disambiguation signal, so its model tier is configured separately from the cheaper downstream calls. Sent in `SEGMENT_CHUNK_LINES` chunks.
3. **surface/reading check + retry** (code): validates that segmented surfaces cover the original Japanese text in order and that both readings are kana-only. Hiragana is normalized to katakana rather than retried; kanji left in a reading fails that line, which is retried on its own.
4. **grammar rules** (code): deterministically handles only grammar tokens that lexical lookup cannot reliably recover, such as `ている/てる`, particles, and the `どうも こうも` rewrite. Ambiguous words such as `ない` and `から` stay out of the rule table.
5. **jisho entry-select** (code): a lookup keyed by headword returns every dictionary entry it touched, boundaries intact — one entry per `(headword, reading)` pair. `LexicalResolver` narrows to the entry matching the segment's `(headword, baseFormReading)` pair and offers only that entry's senses — or, when the pair still matches several entries (a kana headword such as かける does this), offers them all with entry labels attached. See the grade table in `docs/translation-pipeline.md`. i-adjective adverbials such as `高く` can still be normalized through a `高い` probe.
6. **sense-select** (LLM): chooses the matching sense ID for each word, using the lyric translation and the segment's `contextGloss` as context. It does not create meanings directly. **A word with only one candidate sense is settled in code without a request.** Sense candidates carry headword/reading only in the `AMBIGUOUS_HEADWORD` grade, where senses from several entries share one request.
7. **sense-translate** (LLM): translates each chosen Japanese sense to one Korean meaning. Multiple English glosses for one sense are treated as one sense description, not concatenated gloss translations.
8. **assemble** (code): `Token.reading` is the segment's inflected `usedReading` and `Token.baseFormReading` is the chosen entry's dictionary reading, so 行って keeps イッテ while its headword 行く reads イク. POS, JLPT, and meaning come from the rule result or the selected sense. If no sense exists, leave it empty. Non-Japanese punctuation, English, and numbers are marked `SYMBOL`. The line's `pronounciation` is assembled here by joining the tokens' `usedReading` in position order and copying the raw text of the gaps between them.

### Pronunciation is katakana; Hangul is derived on the client

`AnalyzedLine.pronounciation` holds katakana. The Hangul transcription that used to come from the
translation prompt — including its rule forcing voiceless K/T rows to aspirated Korean against
외래어 표기법's word-initial rule — is now `app-rn/src/utils/readingConverter.ts`'s `katakanaToKorean`,
which already encoded the same mapping. The prompt's few-shot pairs live on as
`readingConverter.test.ts`. One divergence: that function writes a long vowel as a hyphen (`ドウ` →
`도-`), where the prompt asked for `도우`.

`AnalyzedLine.koreanPronounciation` is legacy. New analysis always writes null; it stays on the model
only so rows written before `pronounciation` existed still deserialize.

Failures end as `song_analysis_work.status=FAILED` without automatic retry in the first pass. If the user requests the same song again, a new work is created.

### Measurement harness

`EntrySelectHarness` (`backend/domains/translation/src/test/.../harness/`) runs the real stage
objects in `runPipeline`'s order but keeps every intermediate, so it can report what the finished
`AnalyzedLine` no longer carries — each token's jisho provenance and whether sense-select answered
`-1`. It is skipped unless `-Dharness.input` names a directory of golden lyrics, so a normal
`:domains:translation:test` stays free.

```
cd backend && ./gradlew :domains:translation:test --tests '*EntrySelectHarness*' \
  -Dharness.input=<golden-dir> -Dharness.output=<out.json> -Dharness.jisho.cache=<cache.json> \
  -Dharness.segmentation.model=gemini-3.1-flash-lite
```

Golden lyrics are **not committed** — they are copyrighted. Regenerate them from the `lyrics` table
(one file per song: `{lyricId, songId, title, artist, profile, lines:[{index,startTimeMs,text}]}`).
The set used below was chosen by script composition: `晴る` (kanji 0.37), `Lemon` (kana 0.78),
`バッカアノ` (latin 0.12).

Prompt-level experiments still live under `gemini-playground/src/experiments/`; the pipeline-level
harness lives with the pipeline because a re-implementation would measure a copy, not the code.

### Segmentation model: measured, kept at flash-lite

Golden 3 songs, one run each, temperature 0. "before" is the pre-refactor pipeline at `0e1d6d6`.

| | before | `gemini-3.1-flash-lite` | `gemini-3-flash-preview` |
|---|---|---|---|
| jisho `EXACT` share | 0.945 | 0.672 | 0.669 |
| candidate senses per token (mean) | 8.27 | 7.72 | — |
| tokens offered >10 senses | 141 | 96 | — |
| `senseId = -1` | 0.060 | 0.043 | 0.041 |
| `koreanText == null` | 0.045 | 0.034 | 0.030 |
| `easiestJlpt == N1` | 0.051 | 0.056 | 0.051 |
| tokens whose inflected reading differs from the dictionary one | 0 | 112 | — |
| hiragana left in a reading | 669 tokens | 0 | 0 |
| line pronunciation not katakana | n/a | 0 | 0 |
| output tokens / song | 14,874 | 20,106 | 18,949 |
| wall clock / song | ~91 s | ~83 s | ~96 s |

**Decision: keep `gemini-3.1-flash-lite`.** The higher tier matches it inside run-to-run noise and
costs more per token, so nothing justifies the upgrade.

Two findings behind that decision:

- The flash tiers above flash-lite **think by default and charge those thoughts to the same output
  budget as the answer.** A 20-line segmentation chunk stops at `finishReason=MAX_TOKENS` with the
  JSON array barely started — 1,298 candidate tokens against `maxOutputTokens=32768`. They are
  unusable for this stage unless `gemini.segmentation-thinking-level` bounds the thinking.
- At `low` the same model wrote **the Korean translation's surfaces into the segmentation output**
  (`Surface '가' is not present in order`), failed all four attempts on four lines, and took the whole
  song down. Only `minimal` — thinking off — produced the numbers in the table.

`gemini.segmentation-thinking-level` (`minimal`/`low`/`high`, blank by default) exists for that
comparison. Blank sends no `thinkingConfig` at all, so today's requests are unchanged. It is scoped
to the segmentation call because the levels are not portable: `gemini-3.1-pro-preview` rejects
`minimal` with HTTP 400.

Interpreting the `EXACT` drop: the label changed meaning. Before, a lookup was `EXACT` when the
headword **or** any reading matched, so `前` scored `EXACT` while handing sense-select the senses of
前[マエ], 前[ゼン] and 先[サキ] mixed together — 94.5% of tokens carried a label that guaranteed
nothing. Now `EXACT` means the `(headword, reading)` pair pinned exactly one entry, and the rest are
labelled `AMBIGUOUS_HEADWORD` instead of being silently mislabelled. The comparable number is
candidate senses per token, and it falls where homographs actually live: on the kanji-heavy song,
9.45 → 7.01 mean and 50 → 27 tokens offered more than ten senses.

Cost: prompt 71.9k → 65.1k and output 14.9k → 20.1k tokens per song. Segmentation grew (five fields
per word instead of two) and sense-select shrank (147.6k prompt vs 173.5k; single-candidate tokens
never leave the process). The largest saving is on the expensive model: dropping the pronunciation
from the translation schema cut `gemini-3.1-pro-preview` output 7,277 → 4,237 tokens per song.

> The jisho Redis cache key carries a schema version (`jisho:v4:`). Bump it whenever the cached DTO
> changes: unknown-field-tolerant deserialization turns an old cached value into an empty result,
> which drops meanings and POS with no error in the logs.

## Major Word Ranking

Important vocabulary can be ranked from `lyrics.analyzed_content` without a
corpus-wide TF-IDF table. The current design uses single-lyric signals such as
line coverage, capped frequency, line dispersion, title/theme boosts, POS
weights, and learning-value penalties for pronouns, generic words, and katakana
loanwords.

See [major-word-scoring.md](major-word-scoring.md).
