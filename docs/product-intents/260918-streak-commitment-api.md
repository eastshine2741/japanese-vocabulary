# Streak Commitment (260918) — 프론트가 필요로 하는 API

`260918-streak-commitment.md` 의 A·B·C 를 프론트에 먼저 반영하면서, 서버가 아직 주지 않는
것을 목업으로 채웠다. 이 문서는 그 목업을 걷어내기 위해 서버에 필요한 변경 목록이다.

서버 반영 상태 (2026-09-20): 1번(`studiedToday`/`hasStudiedBefore`)과 3번(`StreakReminderScheduler`,
20:00/23:00, `review_reminder` 폐기)은 구현됨. 2번(rating 응답 `streak` 블록)은 하지 않기로 결정.
프론트 남은 일: `streakMock.ts` 와 `withStreakMock` 호출 제거, `pushNotifications.ts` 의 `review_reminder` 분기 제거.

## 프론트 목업 위치

| 파일 | 역할 | 서버가 준비되면 |
|---|---|---|
| `app-rn/src/api/streakMock.ts` | `/api/study-stats/home` 응답에 `studiedToday` 가 없으면 시나리오 값으로 덮는다 (`EXPO_PUBLIC_MOCK_STREAK` = `pending`/`done`/`broken`/`first`/`off`, 기본 `pending`) | 파일과 `studyStatsApi.getHome` 의 `withStreakMock` 호출을 지운다 |
| `app-rn/src/stores/streakStore.ts` | 헤더 칩 숫자·넛지·완료 배너 상태. 오늘 첫 rating 을 클라이언트가 판정한다 | 그대로 둔다 (서버 필드가 들어오면 목업 없이 동작) |

## 1. `GET /api/study-stats/home` 에 필드 두 개 추가 (B·A 필수)

현재 응답:

```json
{ "currentStreak": 3, "freezeCount": 1, "freezeMax": 2, "weekDots": [...] }
```

추가할 필드:

| 필드 | 타입 | 뜻 |
|---|---|---|
| `studiedToday` | boolean | 오늘(KST 04:00 경계, `KstClock.todayStudyDate()`) `daily_study_summary` 행이 있는지. freeze 로 채워진 날은 `false` — 넛지가 떠야 한다 |
| `hasStudiedBefore` | boolean | 오늘 이전 날짜에 `daily_study_summary` 행이 하나라도 있는지. A-2 의 `첫날` 과 `끊긴 뒤 재시작` 을 가른다 |

`currentStreak` 은 현재 `StreakCalculator.currentStreak` 의미 그대로 쓴다 — 오늘 기록이 있으면 오늘
포함, 없으면 어제까지 이어진 일수, 끊겼으면 0. B-1 표의 숫자와 정확히 같다.

프론트 사용처:

- B 넛지: `!studiedToday` 일 때 칩 아래 말풍선.
- A 배너: 홈 통계를 받은 뒤 rating 이 성공하면 `studiedToday` 가 `false` → `true` 로 바뀌는 그 한 번에만
  띄운다. N = `currentStreak + 1`, 문구 분기는 `hasStudiedBefore`.
- `weekDots` 의 `today` 상태는 학습 여부와 무관하게 오늘 날짜 표시라 이 용도로 못 쓴다.

## 2. (선택) rating 응답에 오늘 첫 리뷰 여부 (A 정확도)

지금은 클라이언트가 "홈 통계 시점의 `studiedToday`" 로 첫 rating 을 판정한다. 다른 기기에서 먼저
학습했거나 홈 통계를 받은 뒤 04:00 을 넘긴 경우 한 번 어긋날 수 있다. 정확히 하려면
`POST /api/flashcards/{id}/review` 와 `POST /api/songs/{id}/study-bootstrap` 응답에 아래를 실어 준다.

```json
{ "...": "기존 필드", "streak": { "firstReviewToday": true, "currentStreak": 4, "hasStudiedBefore": true } }
```

들어오면 `useStudyStack` 의 `useStreakStore.getState().recordRating()` 호출을 이 값 기반으로 바꾼다.
없어도 A 는 동작한다.

## 3. 연속 학습 알림 (C) — 서버 전담

프론트는 탭 처리만 한다: `data.type === "streak_reminder"` 면 홈 탭으로 이동
(`app-rn/src/services/pushNotifications.ts`). 알림 문구·대상·시각은 전부 서버(batch) 몫이다.

### payload

```json
{ "type": "streak_reminder", "title": "🔥 3일 연속 학습 중! 오늘은 아직이에요", "body": "카드 한 장만 넘기면 4일째로 이어져요" }
```

`title`/`body` 는 기존 `ReviewReminderScheduler` 처럼 data 에 같이 싣는다 (앱이 data-only 메시지를
로컬 알림으로 그린다). Android 채널은 기존 `review-reminders` 를 그대로 쓴다.

### 규칙 (intent C-1·C-2 그대로)

- 슬롯: 20:00 / 23:00 KST, 전원 같은 시각, 하루 최대 2건.
- 공통 대상: 알림 켜짐(`notificationsEnabled`) + 학습 이력 있음 + 발송 시점 오늘 미학습. 오늘 학습했으면 그날은 없음.
- N = 어제까지 이어진 연속 일수 (`currentStreak` 의 오늘 미학습 값).

| 슬롯 | 조건 | 제목 | 본문 |
|---|---|---|---|
| 20:00 | N = 1 | `어제의 첫 걸음을 이어가볼까요?` | `카드 한 장만 넘기면 연속 학습 2일째예요!` |
| 20:00 | N ≥ 2 | `🔥 N일 연속 학습 중! 오늘은 아직이에요` | `카드 한 장만 넘기면 N+1일째로 이어져요` |
| 23:00 | N = 1 | `⚠️ 어제 시작한 연속 학습이 끊기기 직전` | `자기 전에 카드 한 장만 넘겨주세요` |
| 23:00 | N ≥ 2 | `⚠️ N일 연속이 끊기기 직전` | `지금 카드 한 장만 넘겨주세요` |
| 20:00 | N = 0, 끊긴 다음날 | `오늘 카드 한 장으로 다시 시작해요` | `어제 끊긴 연속 학습을 오늘 1일째부터 다시 쌓아요` |
| 20:00 | N = 0, 끊긴 뒤 2~3일째 | `오늘 다시 시작해볼까요?` | `카드 한 장만 넘기면 연속 학습 1일째예요` |
| 23:00 | N = 0 | 보내지 않음 | |

- 끊긴 유저는 끊긴 다음날부터 3일간 20:00 만, 나흘째부터 멈춤. 다시 학습하면 처음부터.
- 한 번도 학습 안 한 유저(`daily_study_summary` 없음)는 대상 아님.
- 기존 09:00 / 18:00 `review_reminder`(단어 회상) 는 폐기. 앱의 `review_reminder` 탭 처리는 서버가
  끊을 때까지 남겨 두었다.
- 곡 분석 완료 알림(`song_analysis_completed`)은 무관.

### 관련 문서 갱신

서버 구현 시 `docs/architecture/push-notification.md` 의 스케줄(09/18시) 설명을 20/23시 연속 학습
알림으로 바꾼다.
