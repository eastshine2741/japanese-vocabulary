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
   reading checks agree.
5. `ApplyRuleMeaningsStage`: resolves deterministic grammar tokens through
   `RuleMeaningProvider`.
6. `ResolveLexicalSensesStage`: uses `LexicalResolver` and Jisho entries to find
   candidate dictionary senses.
7. `SelectSensesStage`: Gemini chooses sense IDs when code cannot decide. A word
   with one candidate sense is settled in code.
8. `TranslateSensesStage`: Gemini translates each selected dictionary sense to one
   Korean meaning.
9. `AssembleAnalyzedLinesStage`: creates final `AnalyzedLine` / `Token` data.

```text
translate lyrics
        \
         -> sense-select -> sense-translate -> assemble
        /
segment -> anchor/retry -> rules -> jisho entry-select
```

## Core Invariants

- One dictionary sense gets one `senseId` for the whole song. A repeated chorus
  must not send the same sense to sense-translate once per occurrence.
- Sense translation returns exactly one Korean meaning per dictionary sense.
  Comma-separated Korean strings are split into word senses later by the word
  save path.
- Jisho entry identity is `(headword, reading)`, not just headword. Ambiguous
  kana headwords are sent to sense-select with entry labels.
- Readings are normalized to katakana through `JapaneseText.toKatakana`.
- `Token.reading` is the sung reading for that token. No line-level reading is
  stored; app and admin clients assemble display readings from tokens.
- Japanese token surfaces must appear in the original line in order. Whitespace,
  punctuation, latin text, and digits should not be emitted as word tokens.
- Identical raw lyric lines are segmented once and copied to each occurrence.
- Tokens without `koreanText` are not surfaced as word candidates.

## Guardrails

- LLM responses are chunked by stage (`SEGMENT_CHUNK_LINES`,
  `SELECT_CHUNK_LINES`, `TRANSLATE_CHUNK_SENSES`) to avoid whole-song responses
  being cut off.
- `GeminiResponseGuard.verifyComplete` rejects non-`STOP` responses before they
  look like downstream data mismatches.
- `ExponentialBackoff` + `TransientHttpErrors` (`common/retry`) replay a call on
  transport failures only — dropped connection, 5xx, 429 — doubling with jitter,
  capped, `Retry-After` honored. Gemini uses `gemini.retry.max-attempts` /
  `initial-backoff`; 4xx, parse errors, and truncated responses are not retried,
  and each attempt writes its own `gemini_call_log` row.
- Segmentation retries raise temperature; retrying at temperature 0 reproduced
  identical invalid output.
- `JishoClient` uses the same policy under `jisho.retry.*`. A lookup that errors
  on every attempt is `FETCH_ERROR`, never cached, and never mistaken for "no
  entry".
- `MAX_DEFECT_RETRIES` covers incomplete anchored text and unresolved headwords.
  Exhaustion keeps the best anchored line instead of failing a whole song for a
  missing word, and reports each word left without a meaning as one
  `ANALYSIS_DEFECT {json}` warning (`AnalysisDefectReporter`; causes
  `DICTIONARY_MISS`, `UNCOVERED`, `SENSE_REJECTED`, `SENSE_MISSING`,
  `PROVIDER_ERROR`). A headword
  jisho never answered is resent without feedback — the model's headword was not
  wrong — and if it still errors it ships like any other defect, tagged
  `PROVIDER_ERROR` so it counts as an outage rather than a word to fix. The log
  line is the input of `.github/scripts/analysis-feedback` (see its README).
- Katakana-only surfaces are exempt from the dictionary headword check because
  many are loanwords, sounds, or lyric coinages that Jisho should not hold.

## Rule Table Policy

`RuleMeaningProvider` is for deterministic grammar handling that Jisho and
sense-select cannot reliably recover after coarse segmentation.

Allowed:

- particles and unambiguous grammar tokens
- ongoing-action auxiliaries such as `ている` / `てる`
- narrow rewrites such as `どうも` + `こうも` into grammar pieces

Do not add ambiguous lexical words such as `ない` or `から`; they must flow through
Jisho and sense selection.

## Pronunciation

Server-side rules:

- `JapaneseText.particleReading` handles particles whose sung reading differs
  from spelling, such as `は` -> `ワ` and `へ` -> `エ`.
- Uninflected unambiguous surfaces prefer the dictionary reading when the model's
  reading conflicts with Jisho.
- Rule-table readings are fallback values, not overrides for longer sung
  surfaces.

Client-side assembly:

- app-rn: `convertLineReading`
- admin-web: `buildLineReading`

The old `AnalyzedLine.pronounciation` / `koreanPronounciation` fields are gone.
Old JSON rows still deserialize because unknown keys are ignored, but rows from
before token-level sung readings may need reanalysis.

## Jisho Cache

The Redis key is versioned as `jisho:v5:`. Bump the version whenever the cached
DTO shape changes or when `JishoClient.distill` would interpret the same raw
response differently. The cached value is already distilled, so stale distillation
can preserve bad entry decisions until TTL expiry.
