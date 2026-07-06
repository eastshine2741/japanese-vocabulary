# Major Word Scoring

This document records the current algorithm for ranking "major words" in a
lyric's analyzed content. A major word is a word that helps a learner understand
the whole lyric, while still being worth studying as Japanese vocabulary.

The algorithm intentionally does not use TF-IDF or an embedded corpus. It scores
one lyric at a time from `lyrics.analyzed_content`.

## Goals

- Rank the top words for each lyric after lyric analysis completes.
- Avoid scanning all `lyrics` rows or maintaining corpus-wide IDF statistics.
- Prefer words that explain the song's theme, repeated imagery, emotion, or core
  actions.
- Penalize words that are frequent but low-value for learning, such as pronouns,
  generic words, suffixes, and katakana loanwords.
- Keep the score deterministic enough for backend ranking and admin inspection.

## Input

Use tokens from `lyrics.analyzed_content`.

Relevant token fields:

- `baseForm`: preferred word key.
- `surface`: fallback when `baseForm` is missing.
- `partOfSpeech`: POS used for filtering and learning-value weight.
- `koreanText`: meaning signal for emotion/theme boosts.
- line `index`: used for line coverage and dispersion.

Normalize the word key as:

```text
wordKey = token.baseForm if present, otherwise token.surface
```

## Candidate Filtering

Exclude these POS values before scoring:

```text
PARTICLE
AUXILIARY_VERB
SYMBOL
SUPPLEMENTARY_SYMBOL
WHITESPACE
FILLER
```

Also exclude obvious function words and extremely generic helper words, for
example:

```text
する, いる, ある, なる, できる, いう, 行く, 来る, 見る, 思う,
こと, もの, よう, ため, それ, これ, あれ, どれ,
そこ, ここ, どこ, ない, いい, よい, そう, まま,
ところ, 時, 人, 中, 今, 何
```

Do not include empty tokens, pure punctuation, or non-Japanese fragments unless
the token is explicitly part of the title.

## Base Importance

For each candidate word in a lyric:

```text
lineCoverage = linesContainingWord / totalLyricLines
logFrequency = log(1 + frequency) / maxLogFrequencyInLyric
dispersion = (lastLineIndex - firstLineIndex) / (totalLyricLines - 1)
```

Then compute:

```text
lyricImportance =
  0.42 * lineCoverage
+ 0.24 * logFrequency
+ 0.18 * dispersion
+ 0.13 * titleBoost
+ 0.07 * emotionThemeBoost
+ 0.035 * repeatedContentBoost
```

Where:

- `titleBoost = 1` when the word appears in the title and is not a katakana
  loanword; otherwise `0`.
- `emotionThemeBoost = 1` when the word is an emotion/theme word or its meaning
  contains a strong theme signal such as sadness, pain, love, heart, tears,
  dream, loneliness, wound, fear, or dislike; otherwise `0`.
- `repeatedContentBoost = 1` when POS is one of `NOUN`, `VERB`, `ADJECTIVE`,
  `NA_ADJECTIVE`, the word appears in at least two lines, and it is not a
  katakana loanword; otherwise `0`.

## Learning Value

Apply POS weights to represent Japanese vocabulary learning value:

```text
NOUN:         1.00
VERB:         0.98
ADJECTIVE:    0.95
NA_ADJECTIVE: 0.90
ADVERB:       0.62
ADNOMINAL:    0.45
CONJUNCTION:  0.35
INTERJECTION: 0.35
PRONOUN:      0.28
PREFIX:       0.25
SUFFIX:       0.25
OTHER:        0.25
```

Initial score:

```text
score = lyricImportance * posWeight
```

Then apply penalties:

```text
if POS == PRONOUN:
  score *= 0.55

if word is a generic word:
  score *= 0.55

if word is a katakana loanword:
  score *= 0.42
  score = min(score, 0.18)

if POS in OTHER, PREFIX, SUFFIX and the word is not in the title:
  score *= 0.55
```

Generic words are words that often become high-scoring due to repetition but do
not explain the lyric well enough by themselves, for example:

```text
日, 目, 様, 方, 物, 朝, もう, その, あの, で, じゃ, たい
```

Katakana loanword detection:

```text
katakanaLoanword =
  Japanese letters exist
  AND at least 75% of Japanese letters are katakana
  AND the word contains no kanji
```

This intentionally lowers words such as `レモン` and
`キャトルミューティレーション`. They may be important symbols, but they have
lower Japanese vocabulary learning value.

## Why Not TF-IDF

TF-IDF requires a corpus-wide document frequency:

```text
idf(word) = log(totalLyrics / lyricsContainingWord)
```

Using it would require either scanning `lyrics.analyzed_content` repeatedly or
maintaining separate corpus statistics. The current requirement is to avoid
embedding a service corpus for this feature, so the algorithm uses only
single-lyric signals:

- coverage inside the lyric
- capped repetition
- line dispersion
- title/theme relevance
- POS and learning-value penalties

If corpus statistics are added later, they should be stored in derived tables,
not recomputed from the `lyrics` JSON on read.

## Example Results

The following sample was evaluated against prod data on 2026-07-03 using
`lyrics.analyzed_content` only.

### Lemon / 米津玄師

```text
忘れる, 光, 悲しみ, 苦しみ, 胸
```

`レモン` is thematically important, but it is demoted as a katakana loanword.
`あなた` is frequent, but it is demoted as a pronoun.

### 異星にいこうね / いよわ

```text
異星, いく, 知る, のる, 恋
```

`キャトルミューティレーション` is thematically strong, but it is demoted as a
katakana loanword. `異星` remains high because it is title-relevant, written with
kanji, and central to the lyric.

### あいつら全員同窓会 / ずっと真夜中でいいのに。

```text
全員, 同窓会, 置く, 飛ぶ, 空騒ぎ
```

LLM semantic review preferred `同窓会`, `どうでもいい`, `空騒ぎ`,
`自然体`, and `身勝手`. The deterministic score still ranks `全員`, `置く`,
and `飛ぶ` highly because they are repeated and well-distributed. This is an
acceptable tradeoff for the first deterministic version, but admin review should
watch whether broad repetition overpowers theme quality.

## Implementation Notes

- Compute this after `lyrics.analyzed_content` is saved.
- Store derived word stats separately if the result becomes part of a user-facing
  API. Do not repeatedly parse large JSON on every read.
- Keep raw components (`lineCoverage`, `frequency`, `lineCount`, `dispersion`,
  POS, and penalties) inspectable in admin tooling. Ranking bugs are much easier
  to diagnose when the score is decomposed.
- Treat missing or suspicious meanings as an analysis-quality issue, not only a
  scoring issue. For example, `異星` may need meaning correction from `이성` to
  `다른 별` or `외계 행성` in this song context.
