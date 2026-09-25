# Song Word Tiers (완곡까지 3단계)

곡 상세 홈 탭의 **완곡까지 3단계**는 곡의 단어를 3단계(후렴 정복 → 따라 부르기 → 완곡)로
나눠 유저의 학습 부담을 줄이는 기획이다. 원래 "학습 시작" 이 곡 단어 100개 이상을
한 번에 담던 것을 단계 단위로 바꾼다. 같은 탭의 **이 곡 이해도**(가사 줄 기준)도 같은
단어 집합과 기억 상태로 계산한다.

서버는 `GET /api/songs/{id}/word-tiers` 로 분류와 단계별 기억 상태를, `GET /api/songs/{id}/coverage`
로 이해도를 준다. 분류는 `SongWordTierClassifier`(api 모듈), 집계는 `SongWordTierService`,
기억 상태 판정은 `FlashcardMemory`(domains:word). 앱은 `songDetailStore.tiers` / `coverage` 에 둔다.

관련 Pencil 프레임: `jBwuD`(17a 0%) · `uGG5c`(17b 진행 중) · `i7qEd`(17c 완곡 선택) ·
`a71Emf`(17d 이해도 도움말). 기획 배경은 `docs/product-intents/260925-song-detail-study-status-api.md`.

## 앱이 직접 못 하는 이유

앱이 아는 것은 단어별 `importanceScore`·`jlpt`·`isSavedForSong` 과 곡 단어장 합계뿐이다.
후렴 줄 판정과 뼈대 단어 목록은 서버에만 있고, 곡 단어 목록 API 는 단어별 복습 상태(stability)를
노출하지 않는다.

## 기억 상태 — 장기기억 / 단기기억 / 남음

| 분류 | 정의 |
|---|---|
| 장기기억 | 리뷰 이력이 있고 `stability >= 7.0` (`LONG_TERM_STABILITY_DAYS`) |
| 단기기억 | 리뷰 이력이 있고 장기기억이 아님 (FSRS state 무관) |
| 남음 | flashcard 가 없거나 리뷰 이력(`last_review`)이 없음 |

같은 판정을 복습 스택도 쓴다 — `FlashcardDto.memory`(리뷰 전) 와 `ReviewResultDto.memory`(리뷰 후)
차이가 완주 카드의 "장기기억으로 / 단기기억으로" 다. 임계값이 한 곳에 있어야 곡 상세 이해도와
완주 카드가 같은 말을 한다.

프로필·단어장의 진행 바도 같은 판정을 쓴다. `GET /api/decks`·`GET /api/decks/{id}`·
`GET /api/decks/all` 은 `longTermCount`/`shortTermCount` 를, `GET /api/flashcards/stats` 는
`longTermCount`/`shortTermCount` 를 함께 내려준다 (SQL `CASE` 식이 `FlashcardMemory` 와 같은
판정이어야 한다). 같은 응답의 `masteredCount`/`studyingCount`/`newWordCount`·`review`/`learning` 은
FSRS state 기준이라 판정이 다르다 — 구버전 앱용으로만 남아 있다. `남음` 은 어느 API 도 내려주지
않고 앱이 `총합 - 장기 - 단기` 로 구한다.

FSRS stability `S` 는 정의상 retrievability 가 0.9 로 떨어지는 경과일수라, "7일 뒤 떠올릴 확률
90% 이상" 이 한 줄 비교가 된다. 기준은 **유저의 단어**다 — 다른 곡에서 담아 익힌 단어도 이 곡에서
센다. 단어는 저장 키(`addRequest.japanese`)로 먼저 찾고 없으면 `japanese` 로 찾는다.

## tier 단어

> 기본 필터(`WordFilterDefaultsDto`: 명사·동사·형용사·형용동사·부사, JLPT 미분류 포함)를 통과하고
> 뜻이 있는 곡 단어

- 대명사·연체사·감동사 등은 어느 단계에도, 이해도에도 없다.
- 뜻이 없는 단어는 카드가 될 수 없어 영원히 남음이다. 넣으면 그 단계가 끝나지 않으므로 뺀다.

## `GET /api/songs/{id}/word-tiers`

```jsonc
{
  "songId": 123,
  "tiers": [
    {
      "key": "CHORUS",        // CHORUS | SINGALONG | FULL
      "order": 1,
      "name": "후렴 정복",
      "description": "후렴에 나오는 핵심 단어 10개부터 공부해요",
      "wordJapanese": ["胸", "戻る"],   // WordInSongItemDto.japanese 와 같은 키
      "totalCount": 10,
      "knownCount": 5,        // 구버전 앱용 (FSRS REVIEW)
      "learningCount": 2,     // 구버전 앱용
      "longTermCount": 4,
      "shortTermCount": 3,
      "dueCount": 6,
      "duePreviewWords": ["儚い", "沈む", "奪う"]
    }
  ]
}
```

- `tiers` 는 항상 3개, `order` 오름차순. 단어가 없는 곡도 빈 단계 3개. 곡·가사가 없으면 404.
- `dueCount` = 남음 + (리뷰 이력 있고 `due <= now`). 같은 저장 키로 모이는 단어는 한 번만 센다.
  학습 진입이 여는 카드 수와 같다.
- `duePreviewWords` = due 단어를 카드 순서대로 놓은 앞 3개.
- 실패해도 곡 상세는 열린다 — 앱은 `catch → null` 로 받고 그 섹션을 그리지 않는다.

### 분류 규칙

곡 밖 데이터(코퍼스 빈도)는 쓰지 않는다. 단계끼리 단어가 겹치지 않는다. 내부적으로 4분류(핵심·입문·
기초·심화)를 만든 뒤 3단계로 묶는다.

| 단계 | key | 기준 | 정렬 |
| --- | --- | --- | --- |
| 후렴 정복 | `CHORUS` | 뼈대 단어가 아니면서 후렴 줄에 나오거나 두 줄 이상에 나오는 단어 전부 (개수 상한 없음) | 중요도 |
| 따라 부르기 | `SINGALONG` | 나머지 중 `CommonWords` 고정 목록(する·いる·こと·もう…) 또는 JLPT N5·N4 | 등장순 |
| 완곡 | `FULL` | 나머지 전부 (N3 이하·미분류) | 등장순 |

- 후렴 줄 = 공백을 뺀 텍스트가 두 번 이상 나오는 줄. 후렴 줄이 가사의 절반을 넘으면
  "후렴에 나온다" 가 변별력이 없어 등장 줄 수 → 중요도 순으로 뽑는다.
- jisho JLPT 는 쉬운 단어를 N1·미분류로 찍는 쪽으로만 틀리고 어려운 단어를 N5·N4 로 찍지는 않는다.
  그래서 "N5·N4 면 따라 부르기" 는 안전하고, 새는 방향은 완곡뿐이다.
- 설명 문구의 `{n}` 은 서버가 단계 단어 수로 채운다.

### 단계 완료

남음이 0이면(`longTermCount + shortTermCount >= totalCount`) 끝난 단계다. 한 번 리뷰한 단어는 남음으로
돌아가지 않으므로 끝난 단계는 계속 끝나 있다. 다시 due 가 된 카드는 히어로의 `오늘 복습 N개` 가 맡는다.
앱의 `selectCurrentTier` 는 앞에서부터 처음 만나는 미완료 단계를 현재 단계로 고르고, 펼침 카드도
기본으로 현재 단계다.

## `GET /api/songs/{id}/coverage`

```jsonc
{ "songId": 123, "totalLines": 45, "knownLines": 28 }
```

- 줄마다 `lineWordIndexes[line]` 중 tier 단어를 모은다. tier 단어가 없는 줄은 분모에서도 뺀다.
- 그 줄의 tier 단어가 전부 장기기억이면 "이해하는 가사". 앱은 `Math.round(knownLines / totalLines * 100)`.

## 학습 진입: `POST /api/songs/{id}/word-tiers/{key}/study`

```jsonc
{ "deckId": 45, "cards": [ /* FlashcardDto, 단계 순서 */ ], "totalCount": 6 }
```

- 그 단계의 **due 단어만** 연다. 카드 수 = `dueCount`.
- 서버가 연 단어를 `batchAddWords` 로 다시 담는다(upsert). 다른 곡에서 이미 담은 단어도 이 곡
  단어장에 연결된다. due 가 0이면 409 `NO_ELIGIBLE_WORDS`.
- 앱은 `SongReview` 에 `source.tierKey` 를 넘기고, 복습 스택이 이 응답 목록을 세션의 전부로 쓴다.

히어로 CTA 상태 판정은 그대로다(`학습 준비 중` / `오늘 복습 {곡 단어장 dueCount}개` / `학습 시작`).
`오늘 복습 N개` 면 곡 단어장 due 복습, `학습 시작` 이면 현재 단계의 due 단어를 연다.

## 구버전 키

`CORE`/`STARTER`/`BASIC`/`ADVANCED` 는 enum 에 남아 있고 `study` 가 받으면 예전처럼 그 단계 단어
전부(뜻 없는 단어 제외)를 연다. 응답에는 나오지 않는다. 구버전 앱의 4단계 카드는 이 키를 `find` 로
찾아 그리므로 카드 영역이 비고 헤더만 남는다 — 감수하기로 했다. 구버전 히어로는 응답의 새 키로
`study` 를 부르고 `knownCount` 로 현재 단계를 고르므로 계속 동작한다.
