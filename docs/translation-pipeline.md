# Translation Pipeline

This document describes the lyric word-meaning pipeline owned by
`backend/domains/translation`.

## Problem

The production pipeline produced wrong meanings when it trusted one model output
or one dictionary fallback too much:

- segmentation could mutate or drop lyric text, leaving tokens without meanings
- Jisho fallback could pick unrelated entries and readings, such as `高く` →
  `高くつく`
- unmapped Jisho POS strings could erase part-of-speech information
- grammar tokens such as `ている` and `も` were sent through lexical lookup even
  when their meaning is deterministic in context
- multiple English glosses for one Japanese sense could be translated as a long
  concat of glosses instead of one Korean meaning
- **a lookup answered with no entry boundary at all**: every sense of every
  entry the query touched arrived as one flat list, so a query for `前` returned
  前[マエ], 前[ゼン], and — because jisho's `先` entry lists `前` as an alternate
  spelling — 先[サキ]'s meanings, with nothing marking which belonged to which
  word. Sense-select was being asked to choose between meanings of *different
  words* on their English glosses alone, and "before / earlier" reads the same
  for 前[ゼン] and 前[マエ].

The current design keeps LLM calls for context-sensitive decisions, but adds code
guardrails for deterministic checks and transformations.

## Runtime Flow

`KoreanLyricTranslationService.runPipeline()` is the orchestrator. It wires
`PipelineStage<I, O>` implementations in this order:

1. `TranslateLyricsStage`: calls Gemini for Korean lyric translation and
   validates line indices. It does not produce a pronunciation — see
   **Pronunciation** below.
2. `SegmentLyricsStage`: calls Gemini for segmentation/lemmatization/readings,
   then `SegmentAnchoringValidator` checks the result. Sent in chunks of
   `SEGMENT_CHUNK_LINES` lines: each word now carries five fields instead of two,
   so a whole-song response is long enough to stop mid-array. Validation is per
   line: the validator returns anchored tokens for the lines that passed plus a
   reason per failing line, and the stage retries **only the failing lines** with
   that line's own error attached — chunking bounds the request, it does not
   scope the retry. Lines that already anchored are kept, so one bad line neither
   discards the rest nor lets a correct line regress on a later attempt. The
   stage throws only if some line is still invalid after
   `MAX_SEGMENTATION_ATTEMPTS`.
3. `ApplyRuleMeaningsStage`: rewrites and resolves deterministic grammar tokens
   through `RuleMeaningProvider`.
4. `ResolveLexicalSensesStage`: sends unresolved Japanese tokens to
   `LexicalResolver`, which narrows the Jisho lookup to one dictionary entry and
   performs i-adjective normalization.
5. `SelectSensesStage`: builds context input from lyric translation, the
   segment's `contextGloss`, and the entry's senses, and asks Gemini to choose
   sense IDs only. **A word with a single candidate sense never reaches the
   model** — the stage settles it in code. Sent in chunks of
   `SELECT_CHUNK_LINES` lines.
6. `TranslateSensesStage`: translates chosen senses to Korean using
   `SenseTranslationPreparer`. Sent in chunks of `TRANSLATE_CHUNK_SENSES` senses.
7. `AssembleAnalyzedLinesStage`: creates final `AnalyzedLine` and `Token`
   objects from rule results, selected senses, and sense translations, and
   assembles the line's `pronounciation`.

The lyric translation branch and the word-preparation branch run in parallel:

```text
translate lyrics
        \
         -> sense-select -> sense-translate -> assemble
        /
segment -> surface/reading check -> rules -> jisho entry-select
```

## Response Length Guardrails

Response length scaled with song length, and past a point the model stopped
mid-array: it returned valid JSON holding only the first N lines, which surfaced
as a downstream "line indices mismatch". Three code-level guards:

- `ChunkedGeminiCall.flatMap` splits segmentation, sense-select, and
  sense-translation into fixed-size chunks and concatenates the responses in
  input order, so no single response has to carry a whole song. Chunk sizes live
  on the stages (`SegmentLyricsStage.SEGMENT_CHUNK_LINES`,
  `SelectSensesStage.SELECT_CHUNK_LINES`,
  `TranslateSensesStage.TRANSLATE_CHUNK_SENSES`).
- The sense-select response carries only `{tokenId, senseId}` per word.
  `tokenId` is `lineIndex:charStart:charEnd:surface`, so matching it already pins
  the token identity — echoing `surface`/`dictionaryForm` only doubled the output.
- `GeminiResponseGuard.verifyComplete` rejects any response whose
  `finishReason` is not `STOP`, naming the reason and token counts instead of
  letting a truncated response look like a bad line index. Set
  `gemini.max-output-tokens` to raise the cap explicitly; unset (`0`) sends no
  `maxOutputTokens` and uses the model default.

`TranslateSensesStage` is chunked for a different failure than sense-select: a
short response there does not throw, it silently leaves `koreanText` null for the
senses that never came back.

## Package Layout

- `translation.service.KoreanLyricTranslationService`: orchestration and DB save.
- `translation.service.pipeline.stage`: stage implementations and
  `PipelineStage<I, O>`.
- `translation.service.pipeline`: reusable pipeline helpers such as
  `RuleMeaningProvider`, `LexicalResolver`, `SegmentAnchoringValidator`, and
  `JapaneseText`.
- `translation.model`: stage input/output models and pipeline token models.
- `translation.client.gemini.dto`: external LLM DTOs.
- `translation.client.jisho.dto`: external/cache Jisho DTOs.

## Rule Table Policy

`RuleMeaningProvider` is intentionally small. It is only for deterministic
grammar handling that Jisho/sense-select cannot reliably recover after coarse
segmentation.

Allowed examples:

- `ている`, `てる` as ongoing-action auxiliaries
- unambiguous particles such as `も`
- coarse segmentation rewrites such as `どうも` + `こうも` → `どう`, `も`,
  `こう`, `も`

Do not add ambiguous lexical items to this table. For example, `ない` can mean a
negative auxiliary or `無い`, and `から` can be a particle or `空`. These must
flow through Jisho and sense selection.

A rewrite discards the LLM's segmentation for its span, readings included, so it
supplies its own by transliterating the replacement surface. That only works
because every replacement in the table is a kana surface whose reading is itself
(`どう`, `も`, `ここ`, `まで`). **A rule whose replacement contains kanji must
carry explicit readings instead** — transliterating one would put kanji in a
reading field.

## Kana Normalization

`JapaneseText.toKatakana` / `isKanaOnly` is the **single** place readings are
normalized. Readings enter from three sources that disagree on script — the
segmentation LLM (asked for katakana, sometimes answers hiragana), Jisho (always
hiragana), and `RuleMeaningProvider`'s hand-written table (hiragana surfaces) —
and all three pass through it: at segment anchoring, at Jisho distillation, and
in the rule table's helpers. No stage converts on its own.

Katakana is the storage script because the app's
`readingConverter.convertReading` assumes it: its `KANA_MAP` keys are katakana,
so a hiragana reading silently broke both the katakana and the Korean display
modes.

`containsJapanese` and `isKanaOnly` have to agree on which characters exist, or
`SegmentAnchoringValidator` can demand a reading nothing can supply. So
`containsJapanese` admits exactly the characters that **have** a reading. `・`
(U+30FB), `゠` (U+30A0), `ヿ` (U+30FF) and the combining dakuten sit inside the
katakana Unicode block but are punctuation — counting them as Japanese made
`ロックン・ロール` fail every retry and take the whole song's analysis down.
Conversely `々` (U+3005) sits outside every kana and kanji block yet is read
aloud, so leaving it out let `人々` pass with `々` uncovered and leak a raw glyph
into the assembled reading.

## Pronunciation

`AnalyzedLine.pronounciation` is the line's reading in katakana, assembled in
`AssembleAnalyzedLinesStage` by joining the tokens' `usedReading` in `charStart`
order and copying the raw text of the gaps between them, so spaces, punctuation,
and latin runs survive.

The Hangul transcription the translation prompt used to generate is now derived
on the client by `katakanaToKorean`, which already implemented the same
aspirated-consonant rule the prompt's `[PRONUNCIATION_OVERRIDE]` section
enforced. Those few-shot pairs now live in `readingConverter.test.ts`. The one
divergence: that function writes a long vowel as a hyphen (`ドウ` → `도-`) where
the prompt asked for `도우`.

`AnalyzedLine.koreanPronounciation` is legacy — always null in new output, kept
on the model only so pre-`pronounciation` rows still deserialize. Because the
clients read only `pronounciation`, **a song analyzed before this change shows no
pronunciation line until it is re-analyzed.**

## Jisho Entry Select

An entry is a `(headword, reading)` pair. `JishoClient.distill` expands the
response into one `JishoDictionaryEntryDto` per pair the query touched, keeping
each entry's own senses and JLPT together, and converts Jisho's hiragana readings
to katakana on the way in. It does **not** narrow: the lookup key is the headword
alone, one headword lookup is shared by tokens that read it differently, and the
value is cached — so the cached value has to hold every entry the headword can
mean.

`LexicalResolver` narrows, comparing the segment's `(headword, baseFormReading)`
against those entries. The reading comes from an LLM and can be wrong, so a miss
is graded rather than dropped:

| Condition | Provenance | Candidates sent to sense-select |
|---|---|---|
| the pair matches exactly **one** entry | `EXACT` | that entry's senses only |
| the pair matches **several** entries | `AMBIGUOUS_HEADWORD` | all matched entries' senses, each **labelled with its own headword/reading** |
| reading misses, but exactly **one** entry carries the headword | `APPROVED_FALLBACK` | that entry's senses only |
| reading misses and **several** entries carry the headword | `AMBIGUOUS_HEADWORD` | all candidate entries' senses, each **labelled with its own headword/reading** |
| no entry carries the headword | `REJECTED_FALLBACK` | none |
| no result / fetch failed | `NOT_FOUND` / `FETCH_ERROR` | none |

A matching pair can still name more than one word, so a match is not automatically `EXACT`. Lyrics
write かける in kana, which makes かける the headword, and 掛ける / 賭ける / 欠ける all read カケル — the
pair matches three entries. Grading that `EXACT` would send "to hang" / "to bet" / "to be chipped"
with nothing marking them as different words, which is the failure this whole section exists to
prevent.

`AMBIGUOUS_HEADWORD` is the only grade where headword/reading are repeated on
each sense. Every other grade has already been narrowed to one entry, so
repeating them would restate a constant the model cannot act on.

`LexicalResolver` still probes i-adjective base forms for tokens ending in `く`
when the pair match finds nothing. Segmentation now usually supplies `高い` as the
headword directly, but the probe stays as a net for when it supplies `高く`.

## Cache Note

The Jisho Redis key carries a schema version (currently `jisho:v4:`). **Bump it
whenever the cached DTO changes.** Unknown-field-tolerant deserialization turns
an old cached value into an empty result, which silently removes meanings and POS
with no error in the logs. Bumping retires the old keys on their own TTL — no
manual flush.

## Payload Log (temporary)

Every Gemini call's input payload and raw response is written to
`gemini_call_log` by `GeminiCallLogger`, called from the single choke point in
`GeminiClient.callGemini`. It exists so a wrong pipeline result can be read back
against what the model actually saw — which sense candidates a homograph was
offered, which lines a chunk held, what a cut-off response contained.

- Rows carry `song_id` / `lyric_id` from `GeminiCallContext`, threaded through
  `TranslationPipelineSource.callContext` and `SenseTranslationStageInput`. The
  scheduler analyzes a batch of works concurrently, so calls from different songs
  interleave and a timestamp alone cannot separate them.
- `select` and `translate-sense` are chunked, so one lyric produces several rows
  per call name. The line indices inside `request_json` identify the chunk.
- The system prompt is not stored (compile-time constant). `response_json` is the
  whole Gemini response, including `finishReason` and `usageMetadata`.
- Failures are recorded too: `response_json` holds whatever came back and
  `error_message` the exception. Logging never fails the pipeline.

Example — the sense candidates `前` was offered in one song:

```sql
SELECT request_json FROM gemini_call_log
WHERE song_id = ? AND call_name = 'select' AND request_json LIKE '%前%';
```

TODO: this is temporary. There is no log collector in the cluster yet
(`k8s/observability` runs Prometheus + Grafana only), which is the only reason
this lives in MySQL. Once Loki or an equivalent is in place, delete the table,
`GeminiCallLogger`, `GeminiCallLogEntity`, `GeminiCallLogRepository`,
`GeminiCallContext`, and the JPA dependency in `domains/translation`, and emit
the same payloads as structured stdout logs. Until then there is no retention
policy — delete old rows by hand when the table grows.
