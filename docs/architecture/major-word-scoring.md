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

importanceScore =
  lineCoverage * 35
+ logFrequency * 20
+ dispersion * 10
+ titleBoost * 12
+ posWeight * 10
```

Candidates are emitted in song appearance order. Consumers that want important
words must sort by `importanceScore`; do not infer importance from array order.

## Design Notes

- The ranking is intentionally local to one lyric.
- The score favors repeated, well-distributed words and title words.
- POS weight keeps function-like or low-learning-value tokens lower without
  needing a separate semantic model.
- If corpus statistics or semantic boosts are added later, store derived data in
  explicit tables instead of parsing all `lyrics.analyzed_content` on read.
