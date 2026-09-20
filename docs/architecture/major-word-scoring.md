# Major Word Scoring

Major words are ranked in `WordCandidateGenerator` from one lyric's analyzed
tokens. The score is not a corpus-wide TF-IDF calculation and does not scan other
lyrics.

## Source Of Truth

- Implementation: `backend/domains/song/.../WordCandidateGenerator.kt`
- Score DTO: `WordScoreComponents`
- User/admin API field: `importanceScore`

Keep this document as a short orientation only. Update code and tests first when
the scoring behavior changes.

## Current Formula

For each candidate group:

```text
lineCoverage = distinctLinesContainingWord / totalLines
logFrequency = ln(frequency + 1)
dispersion = 0 if one line, otherwise (lastLine - firstLine) / totalLines
titleBoost = 1 if title contains the base form or surface, otherwise 0
posWeight = POS_WEIGHTS[partOfSpeech] or 0.6
commonPenalty = 0.3 if partOfSpeech in COMMON_POS
                or (baseForm, partOfSpeech) in COMMON_WORDS, otherwise 1.0

importanceScore =
( lineCoverage * 35
+ logFrequency * 20
+ dispersion * 10
+ titleBoost * 12
+ posWeight * 10 ) * commonPenalty
```

`COMMON_POS` is pronoun / adnominal / conjunction / prefix / suffix.
`COMMON_WORDS` is the static list in `song/model/CommonWords.kt` (ない, する, いる,
なる, こと, もう, ...) — shared with the song word stages as the 입문 stage — picked from prod lyrics by document frequency and how often each word
landed in a song's top 5. Content words that are merely frequent (忘れる, 笑う,
夢) stay unpenalized.

Candidates are emitted in song appearance order. Consumers that want important
words must sort by `importanceScore`; do not infer importance from array order.

## Design Notes

- The ranking is intentionally local to one lyric.
- The score favors repeated, well-distributed words and title words.
- POS weight keeps function-like or low-learning-value tokens lower without
  needing a separate semantic model.
- The in-lyric signals cannot tell "repeated because it matters here" from
  "repeated because it is everywhere" (ない, する, 君). `commonPenalty` is the
  one out-of-lyric signal, kept as a static list on purpose: a maintained corpus
  table was judged more complexity than the problem warrants at the current
  song count. Re-score existing lyrics with the word-candidate backfill
  (`regenerate = true`) after changing the list.
- If corpus statistics or semantic boosts are added later, store derived data in
  explicit tables instead of parsing all `lyrics.analyzed_content` on read.
