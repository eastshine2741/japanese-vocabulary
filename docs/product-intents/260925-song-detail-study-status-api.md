# Song Detail 학습 현황 (260925) — 프론트가 필요로 하는 API

Pencil 프레임 `jBwuD`(17a 0%) · `uGG5c`(17b 진행 중) · `i7qEd`(17c 완곡 선택) ·
`a71Emf`(17d 이해도 도움말 시트) 의 곡 상세 홈 탭 개편을 앱에 반영하면서, 서버가 아직
주지 않는 값이 드러났다. 이 문서는 그 값을 받기 위해 서버에 필요한 변경 목록이다.

새 개념은 만들지 않는다. 3단계 학습은 기존 **word tier** 를 새 key 로 바꿔 표현하고,
이해도만 별도 API 로 둔다.

| API | 변경 |
|---|---|
| `GET /api/songs/{id}/coverage` | **신규** — 이 곡 이해도 (가사 줄 기준) |
| `GET /api/songs/{id}/word-tiers` | 응답의 `tiers` 를 새 key 3개로 교체, 필드 추가 |
| `POST /api/songs/{id}/word-tiers/{key}/study` | 새 key 는 due 단어만 연다 |

`coverage` 나 `word-tiers` 가 실패하면 앱은 그 값을 `null` 로 두고 해당 섹션을 **아예 그리지
않는다** — 없는 값을 추정해서 채우면 "이해도 62%" 가 거짓이 되기 때문이다. 곡 상세 자체는 열린다.

## 무엇이 바뀌었나

| | 기존 | 개편 |
|---|---|---|
| 상단 섹션 | `나의 진도` — 곡 단어 중 아는 단어 비율 | `이 곡 이해도` — **전체 가사 줄 중 이해하는 줄** 비율 |
| 학습 섹션 | `단어 학습` 4단계 카드 (핵심/입문/기초/심화) | `완곡까지 3단계` (후렴 정복 / 따라 부르기 / 완곡), 항상 1개만 펼침 |
| 진행 바 분류 | 아는 단어 / 익히는 중 / 아직 | **장기기억 / 단기기억 / 남음** |
| 학습 진입 | 단계 단어 **전부** | 그 단계의 **due 단어만** |

## 0. 용어 — 장기기억 / 단기기억 / 남음

곡 단어 하나하나를 셋 중 하나로 분류한다. 단어의 flashcard 는 유저 기준이다(다른 곡에서
담아 익힌 단어도 이 곡에서 아는 단어로 센다) — 기존 `word-tiers` 의 집계 기준과 같다.

| 분류 | 정의 |
|---|---|
| 장기기억 | 지금부터 7일 뒤에 떠올릴 확률이 90% 이상인 단어 |
| 단기기억 | 한 번이라도 리뷰한 적 있으나 장기기억이 아닌 단어 |
| 남음 | 한 번도 리뷰하지 않은 단어 (아직 곡 단어장에 담기지 않은 단어 포함) |

FSRS 에서 stability `S` 는 정의상 **retrievability 가 0.9 로 떨어지는 경과일수**다
(`R(t) = (1 + FACTOR·t/S)^DECAY`, `R(S) = 0.9`). 따라서

> 장기기억 ⟺ `flashcards.stability >= 7.0` (일) 이고 리뷰 이력(`last_review`)이 있음

으로 한 줄 비교로 판정된다. 임계값은 상수 하나로 뺀다 (`LONG_TERM_STABILITY_DAYS = 7.0`).

- flashcard 가 없거나 리뷰 이력이 없는 단어 → 남음.
- `stability < 7.0` 인 모든 리뷰 경험 단어 → 단기기억 (LEARNING·RELEARNING·REVIEW 무관).
- 기존 `knownCount`(= FSRS REVIEW) / `learningCount` 와 **판정 기준이 다르다**. REVIEW 라도
  stability 가 7일 미만이면 단기기억이다.

## 1. tier 단어 집합

tier 와 이해도가 세는 단어는 같은 집합이다.

> tier 단어 = 기본 필터(`WordFilterDefaultsDto`: 명사·동사·형용사·형용동사·부사)를 통과하고
> **뜻이 있는** 곡 단어

- 대명사·연체사·감동사처럼 기본 필터 밖 단어는 어느 tier 에도 없다. 이해도에서도 세지 않는다 —
  세면 그 단어가 든 줄은 3단계를 다 끝내도 "이해하는 가사" 가 될 수 없다.
- 뜻이 없는 단어는 카드가 될 수 없어 영원히 남음이다. tier 에 넣으면 그 tier 가 완료되지 않고,
  그 단어가 든 줄은 이해도에 잡히지 않는다. 그래서 tier·이해도 모두에서 뺀다.

## 2. `GET /api/songs/{id}/coverage` (신규)

```jsonc
{
  "songId": 123,
  "totalLines": 45,   // tier 단어가 1개 이상 있는 가사 줄 수
  "knownLines": 28    // 그 줄의 tier 단어가 전부 장기기억인 줄 수
}
```

도움말 시트(17d)에 적은 계산식이다.

1. 줄마다 그 줄에 나오는 tier 단어를 모은다 (`GET /api/songs/{id}/words` 의
   `lineWordIndexes[line]` 중 tier 단어).
2. 그 줄의 tier 단어가 **전부 장기기억**이면 "이해하는 가사".
3. `knownLines / totalLines` 가 이해도. 앱은 `Math.round(ratio * 100)` 으로 %를 만든다.
4. tier 단어가 0개인 줄(간주·기호·조사만 있는 줄)은 `totalLines` 에서도 뺀다 — 공짜로
   채워지는 줄이 있으면 이해도가 부풀어 보인다.

- 곡·가사가 없으면 404.
- 앱은 이 계산을 못 한다. 단어별 복습 상태(stability)를 어떤 API 도 내려주지 않기 때문이다.

## 3. `GET /api/songs/{id}/word-tiers` (응답 변경)

`tiers` 를 새 key 3개로 **교체**한다. 기존 key(`CORE`/`STARTER`/`BASIC`/`ADVANCED`)는
응답에 더 이상 나오지 않는다.

```jsonc
{
  "songId": 123,
  "tiers": [
    {
      "key": "CHORUS",             // CHORUS | SINGALONG | FULL
      "order": 1,                  // 1..3
      "name": "후렴 정복",
      "description": "후렴에 나오는 핵심 단어 10개부터 공부해요",
      "wordJapanese": ["胸", "戻る"],
      "totalCount": 10,
      "knownCount": 5,             // 기존 필드 유지 (구버전 앱 selectCurrentTier 용)
      "learningCount": 2,          // 기존 필드 유지
      "longTermCount": 4,          // 장기기억
      "shortTermCount": 3,         // 단기기억
      "dueCount": 6,               // 지금 학습할 수 있는 단어 수 (3-2)
      "duePreviewWords": ["儚い", "沈む", "奪う"]
    }
    // SINGALONG, FULL
  ]
}
```

- `tiers` 는 항상 3개, `order` 오름차순. 단어가 없는 곡도 `totalCount: 0` 으로 3개.
- `남음 = totalCount - longTermCount - shortTermCount` 는 앱이 계산한다.
- 예상 소요시간(`약 3분`)은 앱이 `dueCount` 로 계산한다 (단어당 20초, 올림, 최소 1분).
- `name`·`description` 은 서버 문구를 그대로 그린다.

### 3-1. 분류 — 단계끼리 겹치지 않는다

한 단어는 정확히 한 tier 에 들어간다. 기존 `SongWordTierClassifier` 규칙을 그대로 쓰고
입문·기초만 하나로 합친다.

| key | 이름 | 단어 | 정렬 | 설명 문구 |
|---|---|---|---|---|
| `CHORUS` | 후렴 정복 | 기존 `CORE` | 중요도 | `후렴에 나오는 핵심 단어 {n}개부터 공부해요` |
| `SINGALONG` | 따라 부르기 | 기존 `STARTER + BASIC` | 등장순 | `자주 나오는 단어까지 알면 흥얼거리며 부를 수 있어요` |
| `FULL` | 완곡 | 기존 `ADVANCED` | 등장순 | `여기까지 알면 이 곡을 완전히 마스터해요!` |

`{n}` 은 서버가 채운다. `totalCount` 는 그 tier 단어 수다 (앞 tier 를 포함하지 않는다).

### 3-2. `dueCount` / `duePreviewWords`

CTA 라벨(`지금 학습할 단어 8개`)과 `study` 가 실제로 여는 카드 수가 **정확히 같아야 한다**.

> `dueCount` = 그 tier 단어 중 (a) 남음인 단어 + (b) 리뷰 이력이 있고 `due <= now` 인 단어

- 남음이 due 에 들어가야 17a(0%) 화면이 성립한다 — 아무것도 안 담은 곡에서 `dueCount = 0`
  이면 CTA 가 영원히 비활성이다.
- `duePreviewWords` 는 due 집합을 `study` 의 카드 순서(tier 정렬)대로 놓고 앞 3개의 `japanese`.
  3개 미만이면 있는 만큼. 앱이 이 배열을 롤링 애니메이션으로 돌린다.
- `dueCount == 0` 이면 앱은 CTA 를 회색 비활성으로 둔다.

### 3-3. tier 완료 — 남음 0

> 완료 ⟺ `longTermCount + shortTermCount == totalCount` (남음 0)

- 한 번 리뷰한 단어는 남음으로 돌아가지 않으므로 완료된 tier 는 계속 완료다. 나중에 due 가
  돌아온 카드는 히어로의 `오늘 복습 N개` (곡 단어장 due) 가 맡는다.
- 단어가 없는 tier 도 완료로 본다.
- 앱의 `selectCurrentTier` 는 앞에서부터 처음 만나는 미완료 tier 를 현재 tier 로 고른다
  (판정만 `knownCount` 에서 남음 0 으로 바뀐다).

## 4. `POST /api/songs/{id}/word-tiers/{key}/study` (동작 변경)

```jsonc
{ "deckId": 45, "cards": [ /* FlashcardDto, tier 정렬 순서 */ ], "totalCount": 6 }
```

- 새 key(`CHORUS`/`SINGALONG`/`FULL`) 는 3-2 의 **due 단어만** 연다. 카드 수 = `dueCount`.
- 기존 key(`CORE`/`STARTER`/`BASIC`/`ADVANCED`) enum 은 남겨 두고 지금처럼 단계 단어 전부를 연다.
  새 응답에는 기존 key 가 없으므로 정상 경로로는 오지 않는다.
- 담기는 그대로 서버가 한다(`batchAddWords` upsert) — due 집합에 미저장 단어가 들어 있다.
- due 가 0이면 409 `NO_ELIGIBLE_WORDS`. 앱은 CTA 를 비활성으로 두므로 정상 경로에선 안 온다.

## 5. 히어로 CTA

라벨과 상태 판정은 그대로다 (`학습 준비 중` / `오늘 복습 {곡 단어장 dueCount}개` / `학습 시작`).
`학습 시작` 만 현재 tier 의 due 단어를 연다 (기존: 현재 tier 단어 전부).

## 6. 구버전 앱

구버전 `SongDetailWordTierCards` 는 기존 key 4개를 `find` 로 찾아 그린다. 새 응답에는 기존
key 가 없으므로 카드 영역이 비고 `단어 학습 N단어` 헤더만 남는다. 크래시는 없고 이를 감수한다.

- 구버전 히어로 `학습 시작` 은 응답의 tier key 로 `study` 를 부르므로 새 key 경로로 계속
  동작한다. 구버전 `selectCurrentTier` 가 `knownCount` 를 쓰므로 `knownCount`/`learningCount` 는
  응답에 남긴다.

## 7. 구현 상태

서버·앱 모두 구현됐다. 현재 동작은 `docs/architecture/song-word-tiers.md` 가 기준이다.

## 8. 캐싱·성능 메모

- 줄별 tier 단어 인덱스는 유저와 무관하다 — 곡 단위로 캐시할 수 있다.
- 복습 직후 곡 상세로 돌아올 때마다 다시 호출하므로 유저 단위 캐시는 두지 않는다.
