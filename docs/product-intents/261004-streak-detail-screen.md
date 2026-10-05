# 연속 학습 상세 화면 (ST1~ST3)

Pencil `japanese-vocabulary.pen` 의 `TsAfi` / `K3EjF6` / `M1JTh` 프레임과
그 옆 context 노트(`mjJyC`)가 원본이다.

## 무엇

홈 헤더의 연속 학습 칩(불꽃 + N일 연속)을 누르면 푸시되는 화면.
기존에는 마이페이지 탭으로 보냈다.

- 크림 히어로 밴드 — 상태 칩 / 큰 숫자 N / 오른쪽 불꽃 124px + glow

불꽃은 축하 화면과 같은 3겹(`FlameMark`)이다. 점화 연출만 떼고 타오르는 부분만 남겨, 밝은 배경 위에서도 같은 불로 읽힌다.
- 통계 줄 — 최장 기록 · 총 학습일 · 보유 프리즈 n/2 (구분선만, 카드 없음). 보유 프리즈를 누르면 마이페이지와 같은 `FreezeInfoSheet` 바텀시트
- 학습 달력 — 달 단위 가로 페이징, 칩 색 = 그날 복습량, 셀 배경 띠 = 현재 연속 구간
- CTA — 오늘 복습이 남은 상태에서만 "복습 시작하기" (= 홈 스택으로 돌아가기)

상태 3종은 `studiedToday` 와 어제 행의 `freezeUsed` 로 갈린다.

| 상태 | 조건 | 히어로 |
| --- | --- | --- |
| ST1 done | `studiedToday` | 불꽃 풀컬러 + glow, "오늘 복습 완료" |
| ST2 pending | `!studiedToday`, 어제 정상 | 3겹 그대로 색만 식히고 너울도 멈춘다, 숫자는 주황 유지 |
| ST3 frozen | `!studiedToday` + 어제 `freezeUsed` | 불꽃 자리에 같은 빛무리 + 눈 결정, 파란 히어로, 오늘 칩 링도 파랑 |

달력은 세 상태 모두 주황 그대로다. 잔디(학습량)와 띠는 "기록"이라 연속 상태색을 따르지 않는다.

## 서버 지원

| 엔드포인트 | 쓰는 값 |
| --- | --- |
| `GET /api/study-stats/profile` | `currentStreak`, `longestStreak`, `totalStudyDays`, `freezeCount`, `freezeMax` |
| `GET /api/study-stats/home` | `studiedToday` |
| `GET /api/study-stats/calendar?before=yyyy-MM&months=3` | `days[{date, reviewCount, freezeUsed}]`, `nextBefore` |

달력은 첫 기록이 있는 달까지 거슬러 넘길 수 있다. `calendar` 는 달 단위 커서 페이지다.

- `before` 없음 → 이번 달 포함 직전 `months`(기본 3, 최대 12) 개월. `before` 가 있으면 그 달은 빼고 그 앞 개월.
- `days` 는 첫 달 1일부터 (끝 달 말일, 오늘) 중 이른 날까지 빈 날 없이 채운다. 첫 페이지의 마지막 날이 오늘(KST 04:00 경계)이다.
- `nextBefore` 는 이 페이지보다 이전 기록이 있을 때만 페이지 첫 달(`yyyy-MM`)을 주고, 없으면 null.

앱은 첫 달에서 한 장 남으면 다음 페이지를 미리 받아 앞에 붙이고, 보던 달을 유지한다.
화면을 다시 열어 갱신할 때는 첫 페이지만 다시 받고 이미 넘겨 본 과거 달은 남긴다.
칸 강도는 그 달의 최대 복습 수 기준이라 과거 달을 더 받아도 색이 바뀌지 않는다. 올해가 아닌 달은 `2025년 12월` 로 표시한다.

`GET /api/study-stats/heatmap`(최근 112일 고정)은 그대로 둔다. 2개월 달력을 그리는 구버전 앱과
마이페이지 16주 잔디가 쓴다.

달력 칸 상태 · 강도 레벨 · 연속 구간 띠 · ST1/ST2/ST3 판정은 클라이언트가 만든다
(`app-rn/src/components/streak/streakCalendar.ts`).

### 나중에 필요해질 수 있는 것

- **요청 수**: 화면 진입마다 profile/home/calendar 3회를 친다. 기존 store 캐시를 그대로 타므로
  홈/마이페이지를 거쳤다면 profile/home 은 추가 호출이 없다.
- **프리즈 지급 주기(7일)**: context 노트의 "7칸 게이지"를 넣게 되면 `FREEZE_MILESTONE_INTERVAL`
  이 클라이언트 하드코딩이 된다. 그때는 `profile` 에 주기를 실어주는 편이 낫다.

## 디자인 대비 구현 차이

- **히어로 7칸 프리즈 게이지**: context 노트에는 있으나 ST1~ST3 프레임 어디에도 없어 구현하지 않았다.
  프레임을 원본으로 따랐다.
- **아이콘**: 디자인은 phosphor, 앱은 `@expo/vector-icons` Ionicons —
  `flame-fill→flame`, `snowflake→snow`, `check-circle-fill→checkmark-circle`, `clock→time-outline`.
- **프리즈 색**: 프로필 히트맵이 이미 쓰는 `Colors.freezeFill/freezeStroke` 를 재사용했다.
  Pencil 토큰(`#E6F0FF`/`#3D8BFF`)과 미세하게 다르지만 두 화면이 같은 파랑을 쓰는 쪽을 택했다.
- **가장 진한 칸 글자**: 디자인은 띠 안 l4 칩에도 `$streak-ink` 를 쓰는데, 대비가 부족해
  l4 에서는 흰 글자(`$streak-ink-on`)로 간다. 잔디 l4 와 같은 규칙이다.
- **달 페이지 간격**: 디자인의 6px gap 없이 화면 폭 단위로 페이징한다.
- **미구현(디자인 노트의 "열린 것")**: 홈 칩의 chevron 어포던스.
- **칸 탭 읽기**: 노트의 "N회 · 10월 2일 (금)" 대신 범례 줄 왼쪽에 "10월 2일 (금) · N장"(프리즈 날은 "프리즈")을 띄운다.
  같은 칸을 다시 누르면 지워지고, 미래 칸은 눌리지 않는다.

## 코드

- `app-rn/src/screens/StreakScreen.tsx` — 화면 조립, 세 store slice 로딩 (`calendar` 는 페이지를 이어 붙인다)
- `app-rn/src/components/streak/streakCalendar.ts` — 달력 격자 · 띠 · 상태 판정 (유닛 테스트 있음)
- `app-rn/src/components/streak/StreakHero.tsx` / `StreakStatsRow.tsx` / `StreakCalendar.tsx`
- 라우트: `RootStackParamList.Streak`, 진입은 `HomeTab` 의 `onPressStreak`
