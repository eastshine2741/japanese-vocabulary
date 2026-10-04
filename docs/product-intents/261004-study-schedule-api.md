# 오늘의 복습 스케줄 (261004) — 프론트가 필요로 하는 API

Pencil 프레임 `RQaUQ`(H6 오늘의 복습 스케줄) · `RUvac`(H6a 선정 기준 시트) ·
`lTxfw`(H5-B7 홈 헤더) 를 앱에 반영했다. 30일 예보는 처음엔 앱이 임시로 꾸며 냈고, 이
문서가 요청한 `GET /api/study-schedule` 이 이제 서버에 있다
(`StudyScheduleController` → `domains:word` 의 `StudyScheduleService`). 앱은 아직
`USE_MOCK_FORECAST = true` 다 — 서버 배포 뒤 끄면 된다.

- 앱 쪽 임시 구현: `app-rn/src/api/studyScheduleApi.ts` 의 `USE_MOCK_FORECAST`,
  `app-rn/src/api/mock/studyScheduleMock.ts`
- 서버가 `GET /api/study-schedule` 를 내려 주면 `USE_MOCK_FORECAST = false` 하나만 바꾸면
  된다. 응답 타입은 `app-rn/src/types/studySchedule.ts` 와 1:1 이다.

## 지금 진짜 값인 것 / 가짜인 것

| 화면 요소 | 출처 | 상태 |
|---|---|---|
| `17개 복습 대기` | `GET /api/flashcards/stats` → `due` | 진짜 |
| `단어 664장 중` | `GET /api/flashcards/stats` → `total` | 진짜 |
| 단어 칩 3개 + `외 N개` | `GET /api/flashcards/due?limit=3` | 진짜 |
| `약 7분` 류 소요 시간 | 앱 상수 `SECONDS_PER_CARD = 25` | 앱 계산 (서버 불필요) |
| 내일 `오늘 하면 / 미루면` 비교 | 예보 1일차 | **가짜** |
| 30일 막대 그래프 | 예보 전체 | **가짜** |
| 슬라이더(하루 N장) 반영 | 예보 재요청 | **가짜** |

## `GET /api/study-schedule` (신규)

```
GET /api/study-schedule?dailyTarget=30
```

`dailyTarget` 은 0~100 정수, 슬라이더 값이다. 상한 100 은 앱 고정 상수다.

```jsonc
{
  "dueToday": 17,        // 지금 due 인 카드 수 (= /api/flashcards/stats 의 due)
  "totalCards": 664,     // 보유 카드 수 (= stats 의 total)
  "previewWords": [      // 오늘 큐 앞쪽 단어, 최대 3개
    { "wordId": 101, "japanese": "手放す" }
  ],
  "dailyTarget": 30,     // 이 응답이 시뮬레이션에 쓴 값 (요청값 그대로 echo)
  "days": [              // 오늘부터 30개 고정
    { "date": "2026-10-04", "scheduledDue": 17, "simulatedReview": 17 },
    { "date": "2026-10-05", "scheduledDue": 6,  "simulatedReview": 6 }
    // ... 총 30개
  ]
}
```

### `scheduledDue` — 아무것도 복습하지 않을 때 그날 due 가 되는 카드 수

- 0일차는 이미 밀린 것까지 전부 포함한다 (`dueToday` 와 같은 값).
- 1일차부터는 그 학습일(KST 04:00 경계, `KstClock`)에 `flashcards.due` 가 걸린 카드 수다.
  오늘 남은 시간에 due 가 되는 카드는 1일차로 센다. 복습을 안 한다는 가정이므로
  재스케줄은 일어나지 않는다.
- 그래프의 주황 막대(`매일 미루면 쌓이는 양`)는 이 값을 앱에서 **누적**한 것이다. 서버가
  누적값을 따로 내려 줄 필요는 없다.

### `simulatedReview` — 매일 N장씩 했을 때 그날 실제로 복습하는 카드 수

서버가 30일을 하루씩 돌리는 시뮬레이션 결과다. 규칙은 이것뿐이다.

1. 하루마다, 그 시점에 due 인 카드를 **실제 큐 순서(`due ASC, id ASC`)** 로 앞에서부터
   최대 `dailyTarget` 장 집는다.
2. 집은 카드는 전부 **`알고 있음`(GOOD)** 으로 평가한다. 다른 rating 은 쓰지 않는다.
3. FSRS 로 다음 `due` 를 계산해 넣고 다음 날로 넘어간다.

몬테카를로, 확률적 실패 모델, 새 카드 추가 같은 가정은 넣지 않는다. 그날 집은 장수가
`simulatedReview` 다.

- `dailyTarget = 0` 이면 모든 날이 0 이다.
- 시뮬레이션은 **읽기 전용**이다. 실제 flashcard 를 건드리지 않는다.

## 화면이 이 값을 쓰는 방식 (서버가 계산하지 않아도 되는 것들)

| 화면 문구 | 계산 |
|---|---|
| `오늘 미루면 내일 17장을 더 공부해야 해요!` | `dueToday` |
| `오늘 하면 → 23장` | `days[1].scheduledDue` |
| `미루면 → 40장` | `days[1].scheduledDue + dueToday` |
| `약 N분` | `round(장수 × 25초 / 60)`, 최소 1분 |
| 주황 막대 | `scheduledDue` 누적 |
| 초록 막대 | `simulatedReview` |

## 홈 헤더(H5-B7) 가 쓰는 값

헤더는 전부 기존 API 의 진짜 값이다. 모킹한 것은 없다.

| 화면 요소 | 출처 |
|---|---|
| `오늘 복습할 단어가 N개 남았어요` | `GET /api/flashcards/stats` → `due` |
| 연속 학습 칩 `N일 연속` | `GET /api/study-stats/home` → `currentStreak` |
| 덱 타일 due 배지 | `GET /api/decks` → `songDecks[].dueCount` |

두 숫자 모두 홈 진입 시 한 번 받고, 카드를 한 장 평가할 때마다 앱이 1씩 깎는다 — FSRS 는
리뷰 직후 `due` 를 항상 미래로 미루므로 서버를 다시 부르지 않아도 값이 맞는다. 헤더 숫자는
세션 큐가 아니라 전체 due 라서, 탭하면 열리는 복습 스케줄 화면의 `N개 복습 대기` 와 같은 값이다.

### 서버 지원이 필요한 것 — `due` 의 '오늘' 정의

`stats.due` 는 `due <= now` 다. 디자인 문구는 `오늘 복습할 단어` 지만 실제로는 `지금 복습할
단어` 라서, 오늘 중 늦게 due 가 걸리는 카드는 빠진다. 아침에 5개로 보이던 숫자가 저녁에
12개로 **늘어날 수 있다**.

같은 화면이라도 KST 04:00 학습일 경계까지 포함한 `dueToday` 가 맞다. `GET /api/study-schedule`
를 만들 때 `dueToday` 를 `due < 다음 학습일 04:00` 기준으로 세 주면 홈 헤더도 그 값으로
갈아끼운다 (`useStudyStack` 의 `dueTodayCount`). 그 전까지는 `stats.due` 를 그대로 쓴다.

## 미해결 — 제품 확인이 필요한 것

- **소요 시간 기준**: 디자인 수치가 서로 맞지 않는다 (17장 7분 ≈ 25초/장인데, 같은 화면의
  `매일 30장씩 하면 약 5분` 은 10초/장이다). 앱은 25초/장 하나로 통일했다. 실제 리뷰 로그로
  보정할지, 서버가 `estimatedMinutes` 를 내려줄지는 미정.
- **due 0일 때의 화면**: 디자인에 상태가 없다. 지금은 홈 헤더가 `Kotonoha` 워드마크로
  돌아가서 진입점 자체가 사라지고, 화면에 직접 들어오면 경고 카드와 CTA 가 빠진다.
- **덱 배지 상한**: 99 를 넘으면 `99+` 로 줄인다. 디자인에 두 자리 이상 상태가 없어서
  앱이 정한 값이다.
- **슬라이더 기본값**: 30 고정 상수다. 설정의 `dailyGoal` 과는 연결하지 않았다 —
  디자인에서 `목표로 설정` 버튼이 빠졌기 때문에 저장 경로가 없다.
