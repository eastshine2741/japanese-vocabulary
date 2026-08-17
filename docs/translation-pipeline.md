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

The current design keeps LLM calls for context-sensitive decisions, but adds code
guardrails for deterministic checks and transformations.

## Runtime Flow

`KoreanLyricTranslationService.runPipeline()` is the orchestrator. It wires
`PipelineStage<I, O>` implementations in this order:

1. `TranslateLyricsStage`: calls Gemini for Korean lyric translation and
   validates line indices.
2. `SegmentLyricsStage`: calls Gemini for segmentation/lemmatization, then
   `SegmentAnchoringValidator` checks that token surfaces cover the original
   Japanese text in order. Validation is per line: the validator returns anchored
   tokens for the lines that passed plus a reason per failing line, and the stage
   retries **only the failing lines** with that line's own error attached. Lines
   that already anchored are kept, so one bad line neither discards the rest nor
   lets a correct line regress on a later attempt. The stage throws only if some
   line is still invalid after `MAX_SEGMENTATION_ATTEMPTS`.
3. `ApplyRuleMeaningsStage`: rewrites and resolves deterministic grammar tokens
   through `RuleMeaningProvider`.
4. `ResolveLexicalSensesStage`: sends unresolved Japanese tokens to
   `LexicalResolver`, which performs Jisho lookup and i-adjective normalization.
5. `SelectSensesStage`: builds context input from lyric translation plus Jisho
   senses and asks Gemini to choose sense IDs only. Sent in chunks of
   `SELECT_CHUNK_LINES` lines.
6. `TranslateSensesStage`: translates chosen senses to Korean using
   `SenseTranslationPreparer`. Sent in chunks of `TRANSLATE_CHUNK_SENSES` senses.
7. `AssembleAnalyzedLinesStage`: creates final `AnalyzedLine` and `Token`
   objects from rule results, selected senses, and sense translations.

The lyric translation branch and the word-preparation branch run in parallel:

```text
translate lyrics
        \
         -> sense-select -> sense-translate -> assemble
        /
segment -> surface check -> rules -> jisho/i-adjective normalize
```

## Response Length Guardrails

Response length scaled with song length, and past a point the model stopped
mid-array: it returned valid JSON holding only the first N lines, which surfaced
as a downstream "line indices mismatch". Three code-level guards:

- `ChunkedGeminiCall.flatMap` splits sense-select and sense-translation into
  fixed-size chunks and concatenates the responses in input order, so no single
  response has to carry a whole song. Chunk sizes live on the stages
  (`SelectSensesStage.SELECT_CHUNK_LINES`,
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
  `RuleMeaningProvider`, `LexicalResolver`, and `SegmentAnchoringValidator`.
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

## Jisho Guardrails

`JishoService` returns lookup provenance so the pipeline can distinguish exact
matches, approved fallbacks, rejected fallbacks, missing entries, and fetch
errors. Rejected fallbacks do not reach sense-select.

`LexicalResolver` probes i-adjective base forms for tokens ending in `く` when
the original lookup has no accepted entry. If the probed base form returns an
i-adjective sense, the final token uses the i-adjective base form, POS, reading,
and Korean meaning.

## Cache Note

When changing Jisho DTO schema, clear old `jisho:*` Redis cache entries. Old
cached values can deserialize with missing fields and silently remove meanings or
POS data.
