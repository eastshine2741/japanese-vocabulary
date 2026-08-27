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
- **one dictionary sense was minted once per occurrence**: senseIds were handed
  out per token, so a word sung on six lines reached sense-translate six times
  and the model wrote a different Korean gloss for each. `シャイ` — a single-sense
  entry whose only gloss is "shy" — came back as 수줍음이 많은 / 수줍은 / 수줍어하다
  in one song. Every distinct string became its own word candidate and, once
  saved, its own sense, so one word held six near-identical meanings.
- sense-translation was allowed "the most natural 1-2 Korean meanings", and the
  meaning string is split on commas when a word is saved — so a synonym pair
  turned into two senses of the same word
- **compounds the dictionary has no entry for arrived as one token**: 長くない,
  わからない, 置いてった, 飛んでった, そうでもない, 納豆巻き. Their headwords are not
  dictionary headwords, so the lookup missed and the word ended up with no
  meaning at all
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
   `MAX_SEGMENTATION_ATTEMPTS`. Retries raise the temperature by
   `SEGMENT_TEMPERATURE_STEP` per attempt (0.0, 0.3, …, capped at
   `SEGMENT_MAX_TEMPERATURE`) — see **Anchoring** below.
   **Identical lines are asked about once** and the answer is copied onto every
   index holding that text — see **Repeated Lines**. The anchored result then goes
   through `GluedParticleSplitter` (**Glued Particles**) and a headword
   resolvability check (**Unresolvable Headwords**), which is the second thing
   that can send a line back for a retry.
3. `ApplyRuleMeaningsStage`: rewrites and resolves deterministic grammar tokens
   through `RuleMeaningProvider`.
4. `ResolveLexicalSensesStage`: sends unresolved Japanese tokens to
   `LexicalResolver`, which narrows the Jisho lookup to one dictionary entry and
   performs i-adjective normalization. **One dictionary sense gets one senseId
   for the whole song**, shared by every token that means it — see
   **Sense Identity** below.
5. `SelectSensesStage`: builds context input from lyric translation, the
   segment's `contextGloss`, and the entry's senses, and asks Gemini to choose
   sense IDs only. **A word with a single candidate sense never reaches the
   model** — the stage settles it in code. Sent in chunks of
   `SELECT_CHUNK_LINES` lines.
6. `TranslateSensesStage`: translates chosen senses to Korean using
   `SenseTranslationPreparer`. Sent in chunks of `TRANSLATE_CHUNK_SENSES` senses.
7. `AssembleAnalyzedLinesStage`: creates final `AnalyzedLine` and `Token`
   objects from rule results, selected senses, and sense translations. No
   line-level reading is stored — each token carries the reading sung in that
   line and the client assembles from those.

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

Raising `gemini.max-output-tokens` does not rescue a thinking model. The flash
tiers above `gemini-3.1-flash-lite` think by default and spend that budget on
thoughts before the answer starts: a 20-line segmentation chunk on
`gemini-3-flash-preview` still stopped at `MAX_TOKENS` with 1,298 candidate
tokens against `maxOutputTokens=32768`. `gemini.segmentation-thinking-level`
(`minimal`/`low`/`high`) bounds the thinking for the segmentation call; blank —
the default — sends no `thinkingConfig` at all. It is scoped to segmentation
because the levels are not portable: `gemini-3.1-pro-preview` rejects `minimal`
with HTTP 400. Measurements are in `docs/architecture/song-analysis.md`.

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

## Repeated Lines

A chorus repeats whole lines, and each occurrence used to be segmented on its own.
Chunking made that worse: two copies of a line usually land in different chunks,
which are different requests, so the same text came back segmented two different
ways. In song 63 one copy of `雨が降り止むまでは帰れない` resolved completely while the
other returned `までは` and `帰れない` as their own headwords and lost both meanings —
and the app then held `帰る` and `帰れない` as two separate word candidates, one of
them without a meaning.

`SegmentLyricsStage` therefore sends the **distinct** texts of the lines it needs
and copies each answer onto every index holding that text. Repeats are consistent
by construction rather than by luck, and the request shrinks by however much the
song repeats itself. Positions need no adjustment: the text is identical, so the
anchoring offsets are too.

## Glued Particles

The prompt asks for particles as their own words. Nothing enforced it, so
`幸せがある` arrived as `幸せ` + `がある`: the headword (`ある`) was right, the surface
carried the particle, and the reading `ガアル` reached the app as one word — shown
as 가아루. Anchoring cannot catch this. A glued surface is still an exact substring
in the right order with a kana reading, which is everything the validator checks.

`GluedParticleSplitter` splits the particle out, and it fires only on the model
contradicting **itself**:

| shape | example | meaning of the shape |
|---|---|---|
| `surface` = `headword` + one particle | `何を` (`何`), `までは` (`まで`) | the model said the dictionary form is the surface minus this particle |
| `surface` starts with a particle the `headword` does not | `がある` (`ある`), `がいなきゃ` (`いる`) | same statement, from the front |

Three checks then have to agree, and any of them failing leaves the token whole:

- **the dictionary gate**: if the glued form is itself an entry, keep it. `いつも`,
  `ように` and `何を` are real words, and splitting them would break an entry into
  two grammar fragments. A fetch error is not an answer either — a network blip
  must not read as "not a word".
- **the reading has to divide**: the model writes it either with the particle
  (`ガアル` → `ガ` + `アル`) or without it (`までは` came back `マデ`, so there is
  nothing to take off). In the trailing shape `baseFormReading` settles which,
  because the word half is not inflected — `母は` read `ハハ` is 母 read ハハ, not 母
  read ハ plus a particle. The leading shape falls back to how the particle is
  *sung*: 僕は is ボクワ, and leaving ワ on 僕 would mispronounce the word.
- **something has to be left** for both halves.

Leaving a glued token whole costs a mis-rendered surface and reading on a meaning
that is already right; splitting a word that was never glued destroys a real
dictionary entry. The checks are asymmetric on purpose.

`TRAILING_PARTICLES` is `は を が も` and `LEADING_PARTICLES` is `が を の も`. Every
one is in `RuleMeaningProvider`'s particle table, so the split-off token takes its
meaning from there and never reaches jisho or sense-select. `で` and `ね` are
excluded because `です` (headword `だ`) and `ねばった` (headword `粘る`) match the
leading shape without being glued; `に` is excluded because its hits are mostly
`ように`, which reads better whole than as `よう` + `に`. Measured over 24,161 stored
tokens the rule fires 15 times with no false positive.

Mid-word gluing (`ありはしない`, headword `ある`) is out of reach: neither shape
matches and the headword is a real entry, so the meaning is right and only the
surface reads oddly. Catching it would need a rule loose enough to hit real words.

A prompt rule caused the mirror-image mistake, and it is worth recording because
the fix is not code. A bullet under the `headword` field said a particle-carrying
form is not a headword — `までは→まで(+は)` — and the model applied it to that field
only: surface `にも`, headword `に`, plus a separate `も` token. Both claim the same
kana, so anchoring matched `にも` to the end of the line and then looked for `も` in
what was left. Nothing outside the model can tell whether the surface or the extra
token is the wrong one, so the rule moved to the segmentation rules where it
belongs and now names the output — `まで` + `は` — under the invariant *every
character of the line belongs to exactly one surface*.

## Incomplete Lines

The two anchoring outcomes are not equally severe, and treating them alike killed
a song: `晴れ舞台（イェイ）` came back as `晴れ舞台` on all four attempts, because a
parenthesized ad-lib does not read as a lyric word to the model.

- **Positions unusable** — a surface the line does not hold, one out of order, a
  duplicate index, a non-kana reading. Nothing in the line can be trusted, so it
  is retried to exhaustion and then fails the song.
- **Text left out** — every surface was found where it really is, so the tokens
  that exist carry correct offsets and the raw text still renders. The reader
  loses one word card. Retried once, then kept.

`SegmentAnchoringResult` reports them separately: `failuresByIndex` withholds the
line from `anchoredByIndex`, while `incompleteByIndex` names what was skipped for a
line that is kept anyway.

## Unresolvable Headwords

A headword that is not a dictionary form (`帰れない` for `帰る`, `淋しさ` for `淋しい`)
leaves the token with **no candidate sense at all**, and every stage downstream
reads that as "nothing to choose": `SelectSensesStage` skips the token,
`AssembleAnalyzedLinesStage` writes `partOfSpeech = OTHER` with a null
`koreanText`, and nothing logs a thing. Song 63 shipped five such tokens.

`LexicalResolver.unresolvedTokens` answers the same question `resolve` would,
early enough for the segmentation stage to retry the line. Order matters: the
check runs **after** `RuleMeaningProvider`'s rewrite and resolve, or every
particle and auxiliary would be reported as a missing word. The rewrite applied
there is thrown away — `ApplyRuleMeaningsStage` does it for real — and the lookups
are cached, so asking twice costs one Redis hit.

A dictionary miss and a line with text left out are the same kind of loss — the
model returned less than the line holds, and the reader loses a word rather than
the song — so they share one budget, `MAX_DEFECT_RETRIES` (1), one comparison, and
one policy: **never throw**. One resampled retry is worth it, since the same line
is often segmented correctly elsewhere in the same song, but a word the dictionary
genuinely does not hold would otherwise spend the whole budget and take the
analysis down with it.

Katakana-only surfaces are exempt from the dictionary check: `ステンバイミー`,
`チリン`, `ダラッ` have no entry to find, and retrying them can only fail. A retried
line is accepted only if it carries **fewer** defects than the version already
kept, counting unresolvable headwords and uncovered text together, so a resample
cannot make a line worse; a line that becomes unanchorable on its retry keeps its
earlier version instead of failing the song.

What survives is logged as a WARN naming the tokens, and a second WARN naming the
text no surface claimed. `WordCandidateGenerator` also drops
tokens with no `koreanText`, so a meaning the pipeline could not find no longer
reaches the app as a word card with an empty meaning.

## Anchoring

`SegmentAnchoringValidator` anchors each word by searching the raw line for its
surface from the previous match onward, so a surface must be an exact substring
appearing in the line's own order. **Only Japanese surfaces are anchored.**
Whitespace, punctuation, quotes, latin runs and digits are dropped: they carry no
reading and no meaning, and both the assembled pronunciation and the app read
them back out of the raw text by position, so nothing downstream needs a token
for them. The prompt therefore asks for Japanese words only — it used to ask for
the gaps as tokens too.

Anchoring a whitespace token is not merely useless, it is unsound. A space the
model invented as a word separator matches whichever **real** space comes next,
which drags the cursor past every word in between; the next real word then fails
to match and gets reported as missing. `涼しい風吹く 青空の匂い` failed four
identical attempts over a `風` sitting at offset 3, because a bogus space after
`涼しい` had already consumed the one at offset 6, and the retry feedback asked
the model to fix a word that was already correct.

Two consequences shape the retry feedback:

- A "not present in order" failure names where the search stood — the surface
  that last matched and the text still unmatched after it — not just the surface
  it could not find. An uncovered-text report quotes the whole run of Japanese
  characters no surface claimed, not its first character.
- The retry raises the temperature. At temperature 0 the model is deterministic,
  so a retry whose only difference is the two extra feedback fields reproduces
  the rejected output verbatim; the song-77 failure burned three retries on
  byte-identical responses.

## Pronunciation

**The line's reading is not stored.** `Token.reading` is the reading actually sung
in that line and `charStart`/`charEnd` say where the token sits, so a client
assembles it: tokens in position order. `convertLineReading` (app-rn) and
`buildLineReading` (admin-web) each hold that rule.

Two rules are server-side because the sources disagree:

- **A particle's reading is not its spelling.** `JapaneseText.particleReading`
  rewrites は → ワ and へ → エ positionally, compounds included (には → ニワ). The
  segmentation model answers ワ only about three times in four, and
  `RuleMeaningProvider`'s table produced ハ every time by transliterating its own
  surface. を stays ヲ: it reads 오 either way, and オ can be swallowed as a long
  vowel (トモ + オ → 토모-).
- **The rule table's reading is a fallback, never an override.** The table is keyed
  by headword and `resolve` falls back to it, so a longer surface (なんだ→だ,
  だった→だ, って→と) took the headword's reading and lost morae: 馬鹿だった read
  바카다. `AssembleAnalyzedLinesStage` prefers `usedReading` and reaches for the
  table only for a rewrite's token (どうも → どう + も), which has no reading.

Four are client-side:

- **Words are separated.** Japanese writes none, and segmentation splits finer than
  a reader reads, so grammar stays attached: particles/auxiliaries/suffixes, a
  reading opening with ッ/ン, an all-hiragana surface after one that is not
  (揺ら + せば). It still over-splits two adjacent nouns (六弦 → 로쿠 겐); attaching
  too little is a display nit, attaching too much invents a word.
- **Japanese no token claimed is a word break.** Punctuation and latin runs between
  tokens are copied, but text anchoring left uncovered (an ad-lib, a ruby gloss) has
  no reading, and copying it put Japanese in a Korean line (叫べべベノム →
  사케베べ베노무). A parenthesised ad-lib that *was* tokenised keeps its reading.
- **A 받침 crosses a token boundary; a long vowel does not.** `appendKorean` writes
  one syllable per array element and resets only the vowel state per token. Without
  the reach-back a leading ッ/ン left the kana in the line (だ + って → 다ッ테);
  without the reset one word's vowel ate the next word's ウ/イ (ボクノ + ウタ →
  보쿠노-타). A stored line reading can do neither — assembling it destroys the
  boundaries.
- **Korean-side spelling** in `katakanaToKorean`: a 받침 looks past a long vowel sign
  (ワンシーン → 완신-), a long vowel is spent once written (エイエン → 에-엔), and a
  촉음 with nowhere to sit is dropped (喰わん + って → 쿠완테).

The Hangul transcription the translation prompt used to generate is now derived on
the client by `katakanaToKorean`, which already implemented the prompt's
`[PRONUNCIATION_OVERRIDE]` aspirated-consonant rule; those few-shot pairs live in
`readingConverter.test.ts`. It writes a long vowel as a hyphen (`ドウ` → `도-`) where
the prompt asked for `도우`. Loanword kana pairs (`イェ ティ ファ` …) are one syllable
and cannot be lengthened by a following vowel kana — loanwords use ー, so イェイ is
예이.

`AnalyzedLine.pronounciation` and `AnalyzedLine.koreanPronounciation` are gone,
along with their DTO fields. Rows written with them still read back:
`JsonListConverter` ignores unknown keys. **Those rows need re-analysis** — their
tokens hold base-form readings (`欲しかった` → `ホシイ`), and rows written before the
two server-side rules above need it too (particles read ハ, rule-resolved tokens
missing morae). Nothing on a row says so.

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

### Katakana Headwords

Jisho's *search* is script-sensitive, so a lyric that writes a native word in
katakana needs two things:

- **The reading comparison in `distill` normalizes script.** Jisho answers `アタシ`
  with 私[あたし] as its top hit, but comparing `あたし` to `アタシ` literally rejected
  it — the same normalization `expandEntry` already applies to the stored reading.
- **A missed katakana-only headword is queried again in hiragana**
  (`LexicalResolver.hiraganaProbe`), because `アンタ` answers with アンタレス and
  アンタナナリボ, never 貴方. The accepted entry reports `あんた` as the base form, which
  also merges the word with the lines where segmentation normalized the script
  itself — lyric 93 had `アタシ` with no meaning on one line and `あたし` → 나 on the
  next.

The rescue switches the script; it does not invent an entry. A coinage
(`ステンバイミー`) misses in hiragana too, and katakana-only surfaces stay exempt from
the headword check for that reason.

## Sense Identity

A senseId names a dictionary sense, not a token occurrence. `LexicalResolver`
keys the id on everything a `PipelineSenseOption` carries — base form, the
entry's headword and reading, the English gloss, the raw POS list, and the
provenance grade — so the six tokens of a word repeated through a chorus all
point at the same option.

That is what makes the word's meaning stable. Sense-translate is one LLM call per
senseId, and asking it the same question six times got six different phrasings of
the same meaning; the app then saved each phrasing as a separate sense of the same
word. Sharing the id also shrinks the sense-translate payload to the song's
distinct senses.

Provenance is part of the identity because it decides whether sense-select is told
the entry's headword and reading, so the same sense reached through `EXACT` and
through `AMBIGUOUS_HEADWORD` is not interchangeable in the prompt.

The option therefore holds nothing occurrence-scoped: the surface as sung lives on
the token, and sense-translate identifies the word by `baseForm` + `reading`.

**Sense-translate returns exactly one Korean meaning per sense.** The meaning
string is split on commas at save time (`splitMeaningText`), so a synonym list
becomes several senses of one word. Particles are the exception — "~에, ~에게" is
how a Korean dictionary writes に — and they are listed in the prompt.

## Compound Splitting

A token is only useful if the dictionary can answer it. Segmentation is asked to
split combinations that are not dictionary headwords into the words they are made
of, each with its own headword:

| lyric | tokens (headword) |
|---|---|
| 長くない | 長く (長い) / ない (ない) |
| わからない | わから (わかる) / ない (ない) |
| わからなすぎ | わから (わかる) / なすぎ (ない) |
| 置いてった | 置いて (置く) / った (いく) |
| 飛んでった | 飛んで (飛ぶ) / った (いく) |
| そうでもない | そう / でも / ない |
| 打たれ弱い | 打たれ (打つ) / 弱い (弱い) |
| 納豆巻き | 納豆 / 巻き |

The rule is stated twice on purpose: once as a segmentation rule with examples,
and once as a headword constraint — a headword that is itself two words joined
(長くない, 置いていく) is the sign the split was missed. Compounds that **are**
dictionary entries stay whole (飛び立つ, 粘り強い).

## Cache Note

The Jisho Redis key carries a schema version (currently `jisho:v5:`). **Bump it
whenever the cached DTO changes, and whenever `distill` would distill the same
response differently** — the cached value is the distilled one, so a stale
`REJECTED_FALLBACK` for `アタシ` would outlive the fix by a TTL.
Unknown-field-tolerant deserialization turns an old cached value into an empty
result, which silently removes meanings and POS with no error in the logs.
Bumping retires the old keys on their own TTL — no manual flush.

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
