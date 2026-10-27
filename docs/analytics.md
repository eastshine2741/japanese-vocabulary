# Analytics: KPI 와 측정 방법

두 가지만 본다.

- **리텐션/스트릭** — 매일 돌아와 복습하는가. `daily_study_summary` 만으로 계산한다.
- **곡 탐색** — 곡을 찾아 가사(`SongDetail`)를 보는가. GA4 → BigQuery.

앱 이벤트는 `app-rn/src/services/analytics.ts` 가 전부다. 서버 이벤트 테이블은 만들지 않는다.

## 리텐션 쿼리 (prod MySQL)

```bash
kubectl --context kotonoha-prod -n kotonoha exec -i mysql-0 -- \
  sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < query.sql
```

운영자 계정(`users.id IN (1, 32)`)은 항상 제외한다. 스트릭은 freeze 규칙 때문에 `date_kst` 를 직접 세지 말고 `StreakCalculator` 를 쓴다.

```sql
-- D1 / D7 리텐션 (가입일 코호트별)
SELECT
  DATE(CONVERT_TZ(u.created_at, '+00:00', '+09:00'))        AS cohort,
  COUNT(*)                                                   AS users,
  SUM(d1.user_id IS NOT NULL)                                AS d1_returned,
  SUM(d7.user_id IS NOT NULL)                                AS d7_returned
FROM users u
LEFT JOIN daily_study_summary d1
  ON d1.user_id = u.id
 AND d1.date_kst = DATE(CONVERT_TZ(u.created_at, '+00:00', '+09:00')) + INTERVAL 1 DAY
 AND d1.review_count > 0
LEFT JOIN daily_study_summary d7
  ON d7.user_id = u.id
 AND d7.date_kst = DATE(CONVERT_TZ(u.created_at, '+00:00', '+09:00')) + INTERVAL 7 DAY
 AND d7.review_count > 0
WHERE u.id NOT IN (1, 32)
GROUP BY cohort
ORDER BY cohort;
```

```sql
-- 주간 활성 복습 유저
SELECT YEARWEEK(date_kst, 3) AS iso_week, COUNT(DISTINCT user_id) AS active_reviewers
FROM daily_study_summary
WHERE review_count > 0 AND user_id NOT IN (1, 32)
GROUP BY iso_week
ORDER BY iso_week;
```

## 리텐션 (Grafana '사용자' 대시보드)

Grafana 엔 MySQL 데이터소스가 없어 GA4 로 따로 센다. 위 MySQL 쿼리와 분모가 다르다.

- 분모는 가입이 아니라 **신규 설치**(`first_open`, 재설치 제외)다. 설치하고 로그인 전에 나간 사람도 리텐션에서 빠진 것으로 본다.
- 복귀는 그날 `card_rate` 가 한 번이라도 있는 것이다. 오늘 학습이 카드 1장 단위로 기록되는 것과 맞췄다.
- `card_rate` 는 2026-10-05 부터 남아 그 전 설치는 코호트에서 뺀다.
- D1·D2·D7 만 본다. 하루 설치가 5명 안팎이라 일별 코호트는 흔들려 주 단위로 묶는다. D14 이상은 코호트가 쌓이면 더한다.

## 학습 시간 (Grafana '사용자' 대시보드)

같은 유저의 `card_reveal`·`card_rate` 사이 간격을 더하고, 2분 넘게 빈 간격은 쉰 것으로 보고 뺀다.

- 홈 카드 학습엔 화면 체류 이벤트가 없어 홈과 곡 진입 복습을 같은 방식으로 재려고 이벤트 간격을 쓴다.
- `review_exit.dwell_sec` 은 화면을 켜 두고 쉰 시간까지 들어가고, 한 번 열린 화면에 여러 건이 남아 합이 하루 수백 분씩 튄다. 평소 날엔 곡 진입 쪽 간격 합과 거의 같다.
- 간격의 95% 가 1분 안이고 그 위는 2분과 5분 사이에서 1%p 남짓만 는다. 상한을 바꿔도 추세는 그대로다.
- 세션 첫 카드를 펼치기 전 시간은 앞 이벤트가 없어 빠진다. 카드 한 장 분량만큼 덜 잡힌다.

## 체류 시간 (BigQuery)

앱은 체류를 재지 않는다. SongDetail `screen_view` 와 그 다음 `screen_view` 의 간격으로 계산한다.
SongDetail `screen_view` 에는 `song_id`, `origin`(진입 경로) 파라미터가 붙는다.

- 화면 이름은 BigQuery 에 `screen_name` 이 아니라 `firebase_screen` / `firebase_screen_class` 로 들어온다.
- SDK 가 네이티브 화면(`MainActivity`, `RNSScreen`, `UIViewController` 등)도 자동으로 찍는다. 이 이벤트에는 `firebase_screen` 이 없으니 `firebase_screen IS NOT NULL` 로 걸러 앱이 찍은 RN 화면만 남긴다.
- `ga_session_id` 가 빠진 `screen_view` 가 있어(약 13%) 세션이 아니라 `user_pseudo_id` 로 묶고 30분 상한으로 자른다.

```sql
WITH excluded AS (  -- 운영자 설치·스토어 테스트 기기 (해석 주의 참고)
  SELECT DISTINCT user_pseudo_id
  FROM `japanese-vocabulary-490916.analytics_539684755.events_*`
  WHERE user_id IN ('1', '32')
     OR device.mobile_model_name = 'IN2025'
     OR (app_info.install_source = 'manual_install' AND device.mobile_brand_name IS NULL)
),
events AS (
  SELECT
    user_pseudo_id,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'firebase_screen') AS screen,
    event_timestamp
  FROM `japanese-vocabulary-490916.analytics_539684755.events_*`
  WHERE event_name = 'screen_view'
    AND app_info.id = 'dev.eastshine.kotonoha'
    AND user_pseudo_id NOT IN (SELECT user_pseudo_id FROM excluded)
),
spans AS (
  SELECT
    screen,
    LEAD(event_timestamp) OVER (PARTITION BY user_pseudo_id ORDER BY event_timestamp)
      - event_timestamp AS dwell_us
  FROM events
  WHERE screen IS NOT NULL
)
SELECT APPROX_QUANTILES(dwell_us / 1e6, 10) AS dwell_seconds_deciles
FROM spans
WHERE screen = 'SongDetail'
  AND dwell_us BETWEEN 0 AND 30 * 60 * 1e6;  -- 백그라운드 시간 상한
```

다음 `screen_view` 가 없으면 그 화면에서 앱을 껐다는 뜻이다.

## 가사 → 복습 이벤트

가사만 보고 복습하지 않는 유저가 어디서 멈추는지 보려고 남긴다.

| 이벤트 | 시점 | 파라미터 |
|---|---|---|
| `screen_view` (SongReview) | 곡 진입 복습 화면이 열림 | `song_id`(전체 단어장이면 없음), `trigger`(곡 상세의 `cta` 상단 학습 버튼 / `tier` 단계 카드 / `word` 단어 탭, 전체 단어장의 `streak` 연속 학습 / `schedule` 복습 스케줄, 곡 카드 상세의 `reward_card`, 줄 공부에서 줄 단어 풀기 `line`, `unknown` 그 밖) |
| `card_reveal` | 카드 뒷면을 처음 펼침 | `mode`(`home`/`source`), `position`(이 카드 앞에 평가한 장 수), `is_preview` |
| `card_rate` | 평가가 저장됨 | 위와 같음 + `rating` |
| `review_complete` | 한 장 이상 평가한 세션이 완주 카드에 닿음 (홈·곡 진입 모두) | `mode`, `song_id`·`deck_id`(완주한 곡 단어장, 전체 단어장이면 없음), `tier_key`(단계 학습일 때), `reviewed` |
| `review_continue` | 완주 카드에서 다음 학습 버튼을 누름 | `kind`(`next_due` 복습 남은 다른 곡 / `song_new` 방금 끝낸 곡의 안 배운 단어 / `recommended` 추천곡 / `search` 새 곡 검색), `song_id`(이어갈 곡, 검색이면 없음), `reviewed`(이번 세션에서 평가한 장 수) |
| `review_exit` | 곡 진입 복습 화면을 떠나거나 앱이 백그라운드로 감 | `song_id`(전체 단어장이면 없음), `deck_id`, `how`(`leave`/`background`), `reviewed`, `revealed`, `completed`, `status`, `dwell_sec` |

- `review_exit` 의 `song_id`·`deck_id` 는 화면을 연 곡이다. 완주 카드에서 다른 곡으로 이어가도 바뀌지 않으니 실제로 복습한 곡은 `review_continue`·`review_complete` 로 본다.
- `review_exit` 는 앱을 끄면 언마운트가 오지 않아 백그라운드 전환 때도 남긴다. 한 번 열린 화면에 여러 건이 생길 수 있으니 열림마다 마지막 건을 본다.

## 줄 공부 이벤트

줄 공부(`SongLineStudy`)에서 몇 줄까지 가다 멈추는지 보려고 남긴다. 줄을 풀러 가면 SongReview(`trigger=line`)가 위에 쌓이므로, 체류는 `screen_view` 간격이 아니라 `line_study_exit` 의 `dwell_sec` 로 본다.

| 이벤트 | 시점 | 파라미터 |
|---|---|---|
| `screen_view` (SongLineStudy) | 줄 공부 화면이 열림 | `song_id` |
| `line_study_exit` | 줄 공부 화면을 떠나거나 앱이 백그라운드로 감 | `song_id`, `how`(`leave`/`background`), `lines_total`, `lines_reached`(가장 멀리 간 줄까지의 줄 수), `lines_opened`(이번 열림에서 풀어 연 줄 수), `replays`, `completed`(마지막 줄에서 다음을 누름), `dwell_sec` |

- 줄을 풀러 SongReview 에 있는 동안 백그라운드로 가도 아래 깔린 줄 공부가 한 건 남긴다. `review_exit` 처럼 열림마다 마지막 건을 본다.

## 알림 탭 이벤트

Android 연속 학습 알림만 커스텀 레이아웃이라 OS·레이아웃별 탭률을 비교하려고 남긴다. GA4 자동 `notification_open` 은 앱이 직접 그린 알림(Android data-only) 탭을 못 세서 대신 쓸 수 없다.

| 이벤트 | 시점 | 파라미터 |
|---|---|---|
| `notification_tap` | 푸시 알림을 눌러 앱에 들어옴 | `type`(payload `data.type`), `style`(`custom` 네이티브 레이아웃 / `plain` 앱이 띄운 일반 알림 / `system` OS 가 띄운 알림, iOS 는 전부 이것) |

- 분모(발송)는 GA 에 없다. prod `notification_logs` 를 `user_id` 로 붙이고, 연속 학습 슬롯은 발송 시각(20시·23시 KST)으로 가른다.
- iOS 는 같은 탭이 FCM·expo-notifications 양쪽으로 들어올 수 있어 앱이 같은 `type` 3초 안 중복을 한 건으로 친다.

## 해석 주의

- **스토어 자동 테스트 기기는 빼고 센다.** Play 에 빌드(rc 포함, 내부 테스트 트랙)를 올릴 때마다 사전 출시 보고서 로봇이 새 설치로 찍히고 로그인 화면을 수십 번 오가, 설치·로그인 이탈이 두 배로 부풀었다.
  - Android: `device.mobile_model_name = 'IN2025'`(Play 설치, 위치 없음, 업로드 날에 몰림), `app_info.install_source = 'manual_install' AND device.mobile_brand_name IS NULL`(미국, Google 테스트 환경)
  - iOS 심사: 위치가 San Jose·Santa Clara 등 실리콘밸리인 iPad·iPhone 이 로그인 화면만 보고 나간다. 기기 키로는 못 거르니 이탈 수가 작을 땐 눈으로 확인한다.
- **운영자는 이벤트가 아니라 설치 단위로 뺀다.** 운영자는 빌드마다 재설치해 로그인 전 이벤트가 `user_id` 없이 남는다. `user_id IN ('1','32')` 가 한 번이라도 찍힌 `user_pseudo_id` 를 통째로 빼지 않으면 "로그인 화면에서 나간 신규"로 잡힌다.
- **재설치는 새 유저가 아니다.** GA `user_pseudo_id` 는 설치마다 바뀐다. `first_open` 의 `previous_first_open_count > 0` 이면 같은 기기 재설치다.
- `song_analyze_result` 는 **앱이 본 결과**다. 유저가 기다리지 않고 나가면 유실되므로 `song_analysis_work` 와 수가 다르다. 그 차이가 이 이벤트를 남기는 이유다.
- GA4 `user_id` 는 `users.id`. DB 지표와 같은 키로 조인한다.
- dev/prod 는 Firebase 프로젝트를 공유하고 패키지명으로 스트림이 갈린다. 분석은 prod 스트림(`dev.eastshine.kotonoha`)만 본다.

## Grafana 에서 BigQuery 보기

Grafana(데이터소스 uid `bigquery`)는 GA4 export 를 직접 쿼리한다. 스캔한 바이트만큼 과금되므로 패널 쿼리는 `events_*` 를 반드시 대시보드 시간 범위로 자른다. 안 자르면 새로고침마다 전체 기간을 긁고, 데이터소스의 쿼리당 상한(1GiB)에 걸리면 패널이 에러로 뜬다.

```sql
WHERE (_TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE($__timeFrom(), 'Asia/Seoul')) AND FORMAT_DATE('%Y%m%d', DATE($__timeTo(), 'Asia/Seoul'))
    OR _TABLE_SUFFIX BETWEEN CONCAT('intraday_', FORMAT_DATE('%Y%m%d', DATE($__timeFrom(), 'Asia/Seoul')))
                         AND CONCAT('intraday_', FORMAT_DATE('%Y%m%d', DATE($__timeTo(), 'Asia/Seoul'))))
```

- 아직 확정되지 않은 날(오늘)은 `events_intraday_YYYYMMDD` 에만 있다. `'intraday_…'` 는 숫자 범위 `BETWEEN` 에 안 걸리므로 따로 넣어야 오늘이 보인다.
- 날짜는 `'Asia/Seoul'` 로 자른다. 테이블은 GA4 프로퍼티 시간대(KST) 날짜로 나뉘어서, UTC 로 자르면 KST 00–09시 동안 오늘 intraday 테이블이 범위 밖이 된다. 일별 집계 패널도 `event_date` 로 묶는다.

## GA4 프로퍼티 설정

- Google Signals **OFF** — 켜면 소규모 데이터가 thresholding 으로 가려진다.
- 데이터 보존 14개월.
- BigQuery export 는 **소급되지 않는다.** 새 이벤트를 늘리기 전에 켜져 있어야 한다. Sandbox 는 테이블 60일 만료·스트리밍 불가라 빌링 계정이 필요하다 (무료 범위 안, 예산 알림 $1).
- 커스텀 파라미터는 측정기준으로 등록해야 **GA4 UI 리포트**에 나온다. BigQuery 는 등록과 무관하게 다 들어온다.
- iOS 는 IDFA 를 수집하지 않는다 (ATT 프롬프트 불필요).
