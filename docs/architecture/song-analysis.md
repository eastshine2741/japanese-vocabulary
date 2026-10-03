# Song Analysis

Song analysis is an asynchronous work pipeline.

When a search result is selected, the user app first calls `GET /api/songs?title=...&artistName=...` to exact-match an existing song+lyric. If it returns `200`, the app immediately uses player data. If it returns `204`, the app calls `/api/songs/analyze` to create or reuse `song_analysis_work`.

Recommendation analysis also reuses `song_analysis_work`, but only after an operator approves a collected candidate. The admin recommendation operation creates or reuses work with `trigger_source=RECOMMENDATION`; the generic song-analysis worker does not import or know about recommendation tables.

Admin song detail can trigger existing-song reanalysis with `POST /admin/api/songs/{songId}/reanalysis`. The endpoint creates or reuses a song-scoped `song_analysis_work` with `trigger_source=ADMIN`, returns an active blocker when one exists, and preserves the product constraint that this feature stores only the newly produced MV URL on `song_analysis_work.youtube_url`; it does not add `previous_youtube_url`.

`/api/songs/analyze` does not synchronously fetch lyrics, YouTube data, or provider data. It immediately returns work status. The user app shows the work in the analysis pill and polls `/api/songs/analysis-work/{workId}`; the song only exists once the work is `COMPLETED`, and the app opens it when the user taps the finished pill, never on its own.

## Flow

1. **Trigger** (`api`/`admin-api` + `song-analysis`): analyze request or approved recommendation candidate -> `SongAnalysisWorkService.createOrReuse()` -> returns existing active raw `title|artist` workId or creates `song_analysis_work(PENDING)`.
2. **Stage messages** (`integrations:message-queue` + `worker`): the pipeline is a chain of stages, one queue message each. `createOrReuse` publishes `SongAnalysisWorkQueuedEvent(workId, FETCH_LYRICS)`; the queue adapter turns it into a RabbitMQ message carrying `workId` and `stage` on `AFTER_COMMIT`. Finishing a stage publishes the next one the same way. See [Stage ledger](#stage-ledger).
3. **Pre-analysis stages** (`worker` + `song`): `FETCH_LYRICS` -> `FETCH_YOUTUBE`, running LRCLIB/VocaDB lyric lookup and YouTube MV lookup. Their outputs stay on the ledger; no `songs`/`lyrics` row exists yet. A search with no acceptable MV candidate fails the work. `CREATE_SONG_AND_LYRIC` is the old pipeline's stage that created the rows here; `next` skips it and it only runs for work that was already waiting for it.

Lyric providers run in order; the first hit wins. LrcLib matches a candidate by artist name first (`ArtistNameNormalizer` folds width, case, spacing, and punctuation). Its duration fallback exists for cross-script spellings (`あいみょん` vs `Aimyon`) but duration alone is not evidence — 『恋』 has dozens of same-titled songs within a few seconds of each other, and one of them once landed on Sohbana's song — so a duration candidate is accepted only when `ItunesArtistAliasVerifier` confirms the artist: it searches iTunes JP for the candidate's artist spelling and accepts it when any returned track names the query artist; a failed lookup rejects the candidate. When nothing verifies, the work fails with `LYRICS_NOT_FOUND` rather than attaching a stranger's lyrics.
4. **Lyric analysis** (`worker` + `translation`): `ANALYZE_LYRICS` (lyric translation ∥ segmentation → rules → dictionary, both branches in one message) -> `SELECT_SENSES` -> `TRANSLATE_SENSES` -> `COMPLETE`. These are the steps of `KoreanLyricTranslationService.runPipeline()`, called one at a time, reading the lyric lines from the `FETCH_LYRICS` output.
5. **Completion**: `COMPLETE` assembles the lines and, in one transaction, creates the song (or reuses one with the same title/artist) and a new active lyric holding `analyzed_content`, sets `song_id`, `lyric_id`, and `player_ready_at` on the work, and marks it `COMPLETED`. A failed work therefore leaves no song behind, and a song an older pipeline left unanalyzed is repaired by the next request, which gives it a new analyzed active lyric. Work that went through the old `CREATE_SONG_AND_LYRIC` already has `lyric_id`; it analyzes and completes that lyric instead. For admin reanalysis of an existing song, completion is also the active-result switch boundary: the old active lyric/MV remains visible until completion atomically moves the song to the candidate lyric and work-produced MV.

`YoutubeMvSearchService` picks the MV from the cached artist uploads playlist first, then broad video search. A candidate must contain the track title (or, for bilingual iTunes titles like `ピースサイン - Peace Sign`, either separator-delimited half), and is filtered by length against `duration_seconds`: at most half the track (Shorts, teasers, clips) or more than twice the track (concerts, full albums) is rejected; without a track length only the fixed 60s floor applies. A surviving candidate must also be attributable to the artist — the channel name matches the artist, or the title names the artist — otherwise another artist's song of the same title wins on an `Official Music Video` marker alone. Both paths' candidates are then ranked by the same tiers: an official MV (artist channel, known publisher, or an official marker in the title), else the `- Topic` upload of the studio track (exempt from the artist check, since it names neither artist nor MV), else a live/tour clip from an official source, else a reupload on a stranger's channel. A live clip ranks that low because its timings do not match the synced lyrics, but some songs have no MV at all, so it beats failing the work. Covers, karaoke, lyric videos, and cut-down uploads (`Short Version`, `TV size`, which fit inside the duration bounds) score below the acceptance floor and are never taken. Only a channel that is the artist's own or a known publisher may be cached as the artist's channel; an official-looking title is not enough.

Work status uses only `PENDING`, `RUNNING`, `COMPLETED`, and `FAILED`. Delivery is at-least-once through RabbitMQ; idempotency comes from the stage claim, not from the broker. A stage failure is recorded as `FAILED` on the stage row and the work row and the message is acked, so `song-analysis.work.dlq` only collects infrastructure failures (e.g. the worker cannot reach MySQL). On failure, work becomes `FAILED`, which drops the row out of the active set so the same song can create a new work later; a user who asks again starts over from `FETCH_LYRICS` in a new work. `lyrics` stores original/analyzed content only; `song_analysis_work` owns the state machine.

## Stage ledger

`song_analysis_work_stage` (V35) has one row per `(work_id, stage)`: `status` (`PENDING`/`RUNNING`/`COMPLETED`/`FAILED`), `attempt`, `output` (JSON, the next stages' input), and on failure `error_code`, `error_class`, `error_message` (the exception's cause chain). `song_analysis_work.current_stage` is the stage the work is running or waiting for. Every change happens under the work row's `FOR UPDATE` lock.

- **Claim.** `claimStage(workId, stage, redelivered)` takes a message only if the work is waiting for that stage and its row is not already running or finished. The first claim moves the work `PENDING` -> `RUNNING` and stamps `started_at`. A duplicate delivery meets a `RUNNING` row and is skipped. A *redelivered* message — RabbitMQ only redelivers after the consumer's connection dropped, so the worker holding it is dead — takes the running stage over. That is how a pod killed mid-stage resumes within seconds instead of waiting for the sweeper.
- **Fence.** Each claim bumps `attempt`; every ledger write carries the attempt it was claimed with and is refused if it is no longer current. A worker that was taken over or timed out by the sweeper cannot write late results, and the transactional stages (`COMPLETE`, and the legacy `CREATE_SONG_AND_LYRIC`) roll their own writes back when refused.
- **Partial output.** `ANALYZE_LYRICS` records each branch (`translation`, `segmentation`, `words`) as soon as it finishes. A retry of that stage skips the finished branches; segmentation is kept apart from `words` so a dictionary failure does not repeat the Gemini segmentation. These writes also move `updated_at`, which is the sweeper's heartbeat.
- **Resume.** `POST /admin/api/song-analysis-works/{id}/resume` reopens a `FAILED` work at its failed stage, reusing every earlier output, with a fresh time budget. It is refused (409) while another work for the song is active and for works that failed before the ledger existed (no stage rows). Works an old pod was still running at deploy time (`RUNNING` with no `started_at`) are never taken over: the old pod may still be alive and there are no earlier outputs, so they finish or time out. Resume updates an existing row instead of inserting one, so it does not get the gap-lock protection: a user request that lands in the same instant can still create a second work. Accepted because it needs an operator action and a user request on the same song within milliseconds.
- **Sweeper** (every minute). Republishes the waiting stage for `PENDING` work, or `RUNNING` work whose current stage is not running, when `updated_at` has not moved for 3 minutes (lost publish; a duplicate is skipped by the claim, and the margin keeps a busy queue from being republished). Fails `RUNNING` work with no progress for 10 minutes as `SONG_ANALYSIS_WORK_TIMEOUT`, together with its running stage row.

## Retries and the time budget

The user waits for `COMPLETE`, and analysis must finish within **5 minutes** (`song-analysis.worker.time-budget`). A retry that would end past that is worth nothing, so:

- **No error-driven message retry.** A failed stage is not requeued. Prod data (Sept 2026) showed every transient failure to be either over within ~2 minutes (Gemini per-minute 429 bursts, lrclib/VocaDB 503s), which an in-process retry absorbs, or far longer (Gemini hanging 180 s three times in a row), which no retry can bring under the budget. A message retry would rerun the whole stage — every Gemini chunk, with different LLM output — for what one HTTP call needed.
- **In-process retry per HTTP call**, for transport failures, 5xx and 429 only (`TransientHttpErrors`): Gemini (`gemini.retry`), jisho (`jisho.retry`), and whole lyric-provider / YouTube searches (`song-analysis.provider-retry`). Waits use coroutine `delay`, never `Thread.sleep`, and stop at the deadline (`started_at + time-budget`, carried as `RetryDeadline` in the coroutine context): a wait that would end past it is not taken.
- **Timeouts.** `spring.http.client.read-timeout: 120s` (worker). Without it Gemini held a call for 180 s.
- **Outage vs. miss.** Lyric providers throw transient errors instead of returning "no lyrics". If any provider stayed down and none found lyrics, the stage fails with `SONG_ANALYSIS_PROVIDER_UNAVAILABLE`, not `LYRICS_NOT_FOUND`. jisho is the exception: a lookup that stays down still ships the word without a meaning and logs a `PROVIDER_ERROR` defect.
- **Error codes.** The work row gets one of: the domain's own code (`LYRICS_NOT_FOUND`, ...), `SONG_ANALYSIS_PROVIDER_UNAVAILABLE` (a transient error survived its retries), or `SONG_ANALYSIS_WORK_FAILED` (anything else). The stage row keeps the exception class and message chain for operators.

The listener runs each stage with `runBlocking(Dispatchers.IO)`: the listener thread blocks so the ack follows the work, and the coroutines inside run on the IO pool so the parallel branches and Gemini chunks really run in parallel. A bare `runBlocking` puts them all on the listener thread, one after another.

`trigger_source` values:

- `USER_APP`: user app `/api/songs/analyze`
- `ADMIN`: reserved for admin-triggered analysis
- `RECOMMENDATION`: admin recommendation dispatch after candidate approval


## One Active Work Per Song

`createOrReuse` reads `(raw_title, raw_artist)` with `FOR UPDATE` before inserting. When no active row
matches, InnoDB takes a gap lock on the slot that key would occupy, so a concurrent request for the same
song blocks on the insert instead of creating a second work. A terminal row drops out of the
`status IN (PENDING, RUNNING)` filter, so nothing has to be cleared when work finishes. This replaced an
`active_dedup_key` UNIQUE column, which emulated a partial unique index and had to be nulled on every
terminal transition.

**The replaced columns are still in the table.** `deploy.sh` runs the Flyway Job to completion *before*
`kubectl rollout status`, so between those two steps the previous pods are still serving and their entity
still maps `active_dedup_key`, `locked_by` and `locked_until`. Dropping a column there makes every
statement touching `song_analysis_work` fail with `Unknown column` until the rollout finishes. So V33/V34
only change indexes, and the three `DROP COLUMN`s wait for a follow-up migration in a later deploy, once
no running pod maps them. During the rollout window new pods leave `active_dedup_key` NULL (MySQL UNIQUE
permits many NULLs) while old pods still fill it, so an old pod's `findByActiveDedupKey` cannot see a new
pod's row and one song can get two active works. That is bounded by the window and costs one duplicate
analysis.

Two preconditions, both silent if broken:

- **`idx_song_analysis_work_raw_song`** must exist. Without it the locking read scans the table and locks
  every row it touches, serializing analysis requests for unrelated songs.
- **REPEATABLE READ.** InnoDB does not take gap locks under READ COMMITTED, so setting the datasource or a
  single transaction to READ COMMITTED removes the protection with no error. Nothing configures isolation
  today, which leaves MySQL's REPEATABLE READ default in place.

The tradeoff accepted here: two simultaneous requests for one song end in a deadlock (error 1213) rather
than a duplicate-key error, and a deadlock rolls back the whole transaction, so the loser cannot re-read
and return the winner's row. Both call sites map it to `409 SONG_ANALYSIS_WORK_ALREADY_EXISTS`; retrying
the request finds the existing work. This is accepted because concurrent requests for the same song are
not expected in practice.

## Admin Song Reanalysis

Admin song detail can trigger `POST /admin/api/songs/{songId}/reanalysis`. The endpoint creates or returns a `song_analysis_work` with `trigger_source=ADMIN` and `song_id` set to the target song. Any active `PENDING` or `RUNNING` work for the song blocks a new admin work, regardless of trigger source: it first looks for an active work already bound to `song_id` (which catches a work whose raw strings no longer match because an admin edited the title), then takes the same `(raw_title, raw_artist)` lock a user request takes.

Admin reanalysis reruns lyric lookup, YouTube lookup, analysis, and lyric creation for the existing song. It creates a new lyric row rather than reusing the current active lyric, and only at completion.

Completion is the active switch boundary: it locks the work row and target song row, creates the new lyric with its analyzed content, updates `songs.active_lyric_id`, overwrites current `songs.youtube_url` with the work-produced MV, updates `songs.updated_at`, and marks the work `COMPLETED`. Failures never mutate the active song pointer or MV and leave no candidate lyric. Previous lyric rows remain queryable for audit/comparison; previous active MV values are not guaranteed to be retained. Do not add `previous_youtube_url`; only the newly produced MV belongs on `song_analysis_work.youtube_url`.

## Word Meaning Pipeline

Detailed design: `docs/translation-pipeline.md`.

Flow: `(translation || [segment -> surface/reading check + retry -> grammar rules -> jisho entry-select]) -> sense-select -> sense-translate -> assemble`.

`KoreanLyricTranslationService` is the orchestrator. Concrete steps live in `translation.service.pipeline.stage` as `PipelineStage<I, O>` implementations, and stage DTOs live in `translation.model`.

1. **translate lyrics** (LLM, `gemini.translation-model`): original line -> Korean lyrics. This gives sense-select context. It no longer produces a pronunciation.
2. **segment** (LLM, `gemini.segmentation-model`): original line -> segments, each with `surface`, `headword`, `usedReading`, `baseFormReading` (both katakana), and a short English `contextGloss`. Replaces Kuromoji. This stage carries the pipeline's disambiguation signal, so its model tier is configured separately from the cheaper downstream calls. Sent in `SEGMENT_CHUNK_LINES` chunks.
3. **surface/reading check + retry** (code): validates that segmented surfaces cover the original Japanese text in order and that both readings are kana-only. Hiragana is normalized to katakana rather than retried; kanji left in a reading fails that line, which is retried on its own.
4. **grammar rules** (code): deterministically handles only grammar tokens that lexical lookup cannot reliably recover, such as `ている/てる`, particles, and the `どうも こうも` rewrite. Ambiguous words such as `ない` and `から` stay out of the rule table.
5. **jisho entry-select** (code): a lookup keyed by headword returns every dictionary entry it touched, boundaries intact — one entry per `(headword, reading)` pair. `LexicalResolver` narrows to the entry matching the segment's `(headword, baseFormReading)` pair and offers only that entry's senses — or, when the pair still matches several entries (a kana headword such as かける does this), offers them all with entry labels attached. See the grade table in `docs/translation-pipeline.md`. i-adjective adverbials such as `高く` can still be normalized through a `高い` probe.
6. **sense-select** (Jev, `jev.model`): chooses the matching sense ID for each word, using the lyric translation and the segment's `contextGloss` as context. One request per line, one `choice` question per word; the word is marked with 【】 inside the line so two identical surfaces in one line get different questions. It can only answer with an offered option, so it never creates meanings. **A word with only one candidate sense is settled in code without a request.** `SenseCandidateNarrowing` first drops candidates no line could mean (repeated glosses of variant spellings; content-word homophones of a word the `contextGloss` calls a particle/auxiliary/suffix). An answer under confidence `0.25` is stored as "no sense" (`-1`). Sense candidates carry headword/reading only in the `AMBIGUOUS_HEADWORD` grade.
7. **sense-translate** (LLM): translates each chosen Japanese sense to one Korean meaning. Multiple English glosses for one sense are treated as one sense description, not concatenated gloss translations.
8. **assemble** (code): `Token.reading` is the segment's inflected `usedReading` and `Token.baseFormReading` is the chosen entry's dictionary reading, so 行って keeps イッテ while its headword 行く reads イク. POS, JLPT, and meaning come from the rule result or the selected sense. If no sense exists, leave it empty. Punctuation, English, and numbers normally get no token at all — segment anchoring drops them and the app rebuilds them from the gaps between tokens; a non-Japanese surface that reaches this stage anyway is marked `SYMBOL` rather than sent to the dictionary. No line-level reading is stored — the tokens carry it.

### Readings are katakana on the tokens; the line's reading is assembled by the client

Nothing stores a line-level reading. `Token.reading` is the katakana actually sung for that token, and
the client joins the tokens in position order, copying the raw text of the gaps between them
(`convertLineReading` in app-rn, `buildLineReading` in admin-web).

The Hangul transcription that used to come from the translation prompt — including its rule forcing
voiceless K/T rows to aspirated Korean against 외래어 표기법's word-initial rule — is now
`app-rn/src/utils/readingConverter.ts`'s `katakanaToKorean`, which already encoded the same mapping.
The prompt's few-shot pairs live on as `readingConverter.test.ts`. One divergence: that function writes
a long vowel as a hyphen (`ドウ` → `도-`), where the prompt asked for `도우`. It runs **per token** —
its long-vowel state would otherwise cross a word boundary and swallow the next word's leading ウ/イ.

Failures end as `song_analysis_work.status=FAILED` without work-level retry. Only individual Gemini calls retry, and only on transport failures (see `docs/translation-pipeline.md`). If the user requests the same song again, a new work is created.

### How the numbers below were measured

A throwaway harness ran the real stage objects in `runPipeline`'s order while keeping every
intermediate, so it could report what the finished `AnalyzedLine` does not carry — each token's jisho
provenance and whether sense-select answered `-1`. It was deleted after the measurement rather than
kept: it only earns its keep when the model choice is reopened, and a live-API test sitting in the
tree costs more in upkeep than in rewriting.

To redo the comparison, rebuild it against `KoreanLyricTranslationService.runPipeline` (commit
`ae13c2e` has the version used here) and feed it golden lyrics regenerated from the `lyrics` table —
they are copyrighted and never committed. The set used below was chosen by script composition:
`晴る` (kanji 0.37), `Lemon` (kana 0.78), `バッカアノ` (latin 0.12).

Prompt-level experiments still live under `gemini-playground/src/experiments/`. A pipeline-level
harness belongs with the pipeline, not there: a re-implementation would measure a copy of
`distill`/`LexicalResolver`, not the code that ships.

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

### Sense-select model: Jev replaced Gemini flash-lite

Replayed the prod `select` requests of five songs (779 words; 丸ノ内サディスティック, 遺書, D/N/A,
Bad Apple!!, 匿名M) against Jev and hand-graded the disagreements.

| | Gemini flash-lite | Jev (final request format) |
|---|---|---|
| same gloss as Gemini | — | 623–631 / 779 |
| answers `-1` when no sense fits (proper nouns, coinages) | never | yes (リッケン, ハツネ, やんなっちゃう) |
| cost per song (sense-select only) | ~$0.024 | ~$0.003 |
| confidence per word | no | yes |

- **Position marker.** Without 【】, the two て of one line got identical questions and identical
  answers; marking fixed て/する cases and cut low-confidence answers 126 → 105.
- **Candidate narrowing.** Candidates per word 11.3 → 7.5, answers under 0.5 confidence
  105 → 79, input tokens −15%; no sense Gemini had picked was removed. It did not fix Jev's
  remaining errors — わ is still read as "emphasis" with four candidates left.
- **Confidence cut at 0.25.** Of 8 answers under 0.25, 6 were plainly wrong and 1 right; between
  0.25 and 0.5 right answers outnumbered wrong ones about five to one. Cutting at 0.5 would have
  dropped ~52 right meanings to hide ~16 wrong ones.
- **No Gemini fallback.** Re-asking Gemini for Jev's low-confidence words fixed about 17 and broke
  about 10 — a net of ~1%, inside Jev's ~3% run-to-run answer flips.
- **Known weak spots:** request て after a verb (殴って read as "and then"), auxiliary いく after
  て (流れてく), sentence-final わ nuance, する in 〜にする.

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
