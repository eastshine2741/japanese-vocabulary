# Translation Pipeline

This document records the current lyric word-meaning pipeline owned by
`backend/domains/translation`. It is intentionally short; local edge-case
rationales should live beside the code or in focused tests.

## Runtime Flow

`KoreanLyricTranslationService.runPipeline()` orchestrates these stages:

1. `TranslateLyricsStage`: Gemini lyric translation. It validates line indices and
   does not produce pronunciation.
2. `SegmentLyricsStage`: Gemini segmentation with `surface`, `headword`,
   `usedReading`, `baseFormReading`, and `contextGloss`.
3. `SegmentAnchoringValidator`: checks Japanese token surfaces against the raw
   lyric line in order. Invalid lines retry; incomplete-but-anchored lines can be
   kept with warnings.
4. `GluedParticleSplitter`: splits model-glued particles only when dictionary and
   reading checks agree. `CompoundVerbMerger` then joins a verb stem and verb the
   model split (`握り` + `返せ`) when the dictionary has the compound as a verb.
5. `ApplyRuleMeaningsStage`: resolves deterministic grammar tokens through
   `RuleMeaningProvider`.
6. `ResolveLexicalSensesStage`: uses `LexicalResolver` and dictionary entries to find
   candidate dictionary senses.
7. `SelectSensesStage`: Jev (TypeSafe) chooses sense IDs when code cannot decide,
   one request per distinct line (a repeated chorus line is asked once). A word with one candidate sense is settled in code;
   `SenseCandidateNarrowing` drops impossible candidates first; an answer under
   confidence 0.25 becomes "no sense". No Gemini fallback.
8. `TranslateSensesStage`: Gemini translates each selected dictionary sense to one
   Korean meaning.
9. `AssembleAnalyzedLinesStage`: creates final `AnalyzedLine` / `Token` data.

```text
translate lyrics
        \
         -> sense-select -> sense-translate -> assemble
        /
segment -> anchor/retry -> rules -> dictionary entry-select
```

## Core Invariants

- One dictionary sense gets one `senseId` for the whole song. A repeated chorus
  must not send the same sense to sense-translate once per occurrence.
- Sense translation and rule-table tokens carry exactly one Korean meaning.
  The word save path splits on commas and merges the same sense across songs,
  so a "A, B" from one song and "A" from another pile up as "A, B, A".
  `KoreanMeaning.first` keeps only the first meaning if the model still lists
  several; `lyric-meaning-backfill` applies the same cut to lyrics analyzed before.
- Dictionary entry identity is `(headword, reading)`, not just headword. Ambiguous
  kana headwords are sent to sense-select with entry labels.
- Readings are normalized to katakana through `JapaneseText.toKatakana`.
- `Token.reading` is the sung reading for that token. No line-level reading is
  stored; app and admin clients assemble display readings from tokens.
- Japanese token surfaces must appear in the original line in order. Whitespace,
  punctuation, latin text, and digits should not be emitted as word tokens —
  but kana or kanji between or after them still are (`140と30字の` → と / 字 / の).
- Identical raw lyric lines are segmented once and sense-selected once, and copied to
  each occurrence.
- Tokens without `koreanText` are not surfaced as word candidates.

## Guardrails

- Gemini responses are chunked by stage (`SEGMENT_CHUNK_LINES`,
  `TRANSLATE_CHUNK_SENSES`) to avoid whole-song responses being cut off.
  Sense-select is one Jev request per line, so it has no chunk size.
- `GeminiResponseGuard.verifyComplete` rejects non-`STOP` responses before they
  look like downstream data mismatches.
- `ExponentialBackoff` + `TransientHttpErrors` (`common/retry`) replay a call on
  transport failures only — dropped connection, 5xx, 429 — doubling with jitter,
  capped, `Retry-After` honored. Gemini uses `gemini.retry.max-attempts` /
  `initial-backoff`; 4xx, parse errors, and truncated responses are not retried,
  and each attempt writes its own `gemini_call_log` row. `JevClient` uses the
  same policy under `jev.retry.*` (Jev's 529 overload is a 5xx) and logs to the
  same table as `call_name = select`, `model` = the answering Jev version.
- Segmentation retries raise temperature; retrying at temperature 0 reproduced
  identical invalid output.
- Dictionary lookups are local (`docs/architecture/dictionary.md`) and not retried. A lookup
  that cannot read the file is `FETCH_ERROR`, never mistaken for "no entry".
- `MAX_DEFECT_RETRIES` covers incomplete anchored text and unresolved headwords.
  Exhaustion keeps the best anchored line instead of failing a whole song for a
  missing word, and reports each word left without a meaning as one
  `ANALYSIS_DEFECT {json}` warning (`AnalysisDefectReporter`; causes
  `DICTIONARY_MISS`, `UNCOVERED`, `SENSE_REJECTED`, `SENSE_MISSING`,
  `PROVIDER_ERROR`). A headword
  the dictionary never answered is resent without feedback — the model's headword was not
  wrong — and if it still errors it ships like any other defect, tagged
  `PROVIDER_ERROR` so it counts as an outage rather than a word to fix. The log
  line is the input of `.github/scripts/analysis-feedback` (see its README).
- Katakana-only surfaces are exempt from the dictionary headword check because
  many are loanwords, sounds, or lyric coinages the dictionary does not hold.

## Rule Table Policy

`RuleMeaningProvider` is for deterministic grammar handling that the dictionary and
sense-select cannot reliably recover after coarse segmentation.

Allowed:

- particles and unambiguous grammar tokens
- ongoing-action auxiliaries such as `ている` / `てる`
- narrow rewrites such as `どうも` + `こうも` into grammar pieces

Do not add ambiguous lexical words such as `ない` or `から`; they must flow through
the dictionary and sense selection.

Particles with several functions (`で`, `と`, `の`, `って`, `じゃ`) pick one Korean
meaning per token from the token before them (`ないで`, a voiced te-stem `読ん`) and
the segment stage's `contextGloss`. This does not break the one-meaning rule:
particles and auxiliaries are never word candidates, so different meanings of `で`
across songs never merge into one word.

## Pronunciation

Server-side rules:

- `SungReading` turns a token reading into what is sung (`は` -> `ワ`, `へ` -> `エ`,
  a final topic `は` on any token). The pipeline and `lyric-reading-backfill` share it,
  so a rule change reaches old lyrics only by rerunning that backfill.
- app-rn `inflectionStartOf` matches a verb's trailing kana against its reading;
  it must accept the sung final `ワ`, or `ている` collapses into a long vowel.
- Uninflected unambiguous surfaces prefer the dictionary reading when the model's
  reading conflicts with the dictionary.
- Rule-table readings are fallback values, not overrides for longer sung
  surfaces.

Client-side assembly:

- app-rn: `convertLineReading`
- admin-web: `buildLineReading`

The old `AnalyzedLine.pronounciation` / `koreanPronounciation` fields are gone.
Old JSON rows still deserialize because unknown keys are ignored, but rows from
before token-level sung readings may need reanalysis or `lyric-reading-backfill`.

## Dictionary

Lookups read the bundled JMdict file. Build rules that the
resolver depends on (fixed POS labels, search-only spellings left out) are in
`docs/architecture/dictionary.md`.
