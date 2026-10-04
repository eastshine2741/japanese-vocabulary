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

운영자 계정(`users.id = 1`)은 항상 제외한다. 스트릭은 freeze 규칙 때문에 `date_kst` 를 직접 세지 말고 `StreakCalculator` 를 쓴다.

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
WHERE u.id <> 1
GROUP BY cohort
ORDER BY cohort;
```

```sql
-- 주간 활성 복습 유저
SELECT YEARWEEK(date_kst, 3) AS iso_week, COUNT(DISTINCT user_id) AS active_reviewers
FROM daily_study_summary
WHERE review_count > 0 AND user_id <> 1
GROUP BY iso_week
ORDER BY iso_week;
```

## 체류 시간 (BigQuery)

앱은 체류를 재지 않는다. SongDetail `screen_view` 와 그 다음 `screen_view` 의 간격으로 계산한다.
SongDetail `screen_view` 에는 `song_id`, `origin`(진입 경로) 파라미터가 붙는다.

- 화면 이름은 BigQuery 에 `screen_name` 이 아니라 `firebase_screen` / `firebase_screen_class` 로 들어온다.
- SDK 가 네이티브 화면(`MainActivity`, `RNSScreen`, `UIViewController` 등)도 자동으로 찍는다. 이 이벤트에는 `firebase_screen` 이 없으니 `firebase_screen IS NOT NULL` 로 걸러 앱이 찍은 RN 화면만 남긴다.
- `ga_session_id` 가 빠진 `screen_view` 가 있어(약 13%) 세션이 아니라 `user_pseudo_id` 로 묶고 30분 상한으로 자른다.

```sql
WITH events AS (
  SELECT
    user_pseudo_id,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'firebase_screen') AS screen,
    event_timestamp
  FROM `japanese-vocabulary-490916.analytics_539684755.events_*`
  WHERE event_name = 'screen_view'
    AND app_info.id = 'dev.eastshine.kotonoha'
    AND COALESCE(user_id, '') <> '1'
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
| `screen_view` (SongReview) | 곡 진입 복습 화면이 열림 | `song_id`, `trigger`(`cta` 상단 학습 버튼 / `tier` 단계 카드 / `word` 단어 탭 / `unknown` 곡 상세 밖에서 염) |
| `card_reveal` | 카드 뒷면을 처음 펼침 | `mode`(`home`/`source`), `position`(이 카드 앞에 평가한 장 수), `is_preview` |
| `card_rate` | 평가가 저장됨 | 위와 같음 + `rating` |
| `review_exit` | 곡 진입 복습 화면을 떠나거나 앱이 백그라운드로 감 | `song_id`, `how`(`leave`/`background`), `reviewed`, `revealed`, `completed`, `status`, `dwell_sec` |

- `review_exit` 는 앱을 끄면 언마운트가 오지 않아 백그라운드 전환 때도 남긴다. 한 번 열린 화면에 여러 건이 생길 수 있으니 열림마다 마지막 건을 본다.

## 해석 주의

- `song_analyze_result` 는 **앱이 본 결과**다. 유저가 기다리지 않고 나가면 유실되므로 `song_analysis_work` 와 수가 다르다. 그 차이가 이 이벤트를 남기는 이유다.
- GA4 `user_id` 는 `users.id`. DB 지표와 같은 키로 조인한다.
- dev/prod 는 Firebase 프로젝트를 공유하고 패키지명으로 스트림이 갈린다. 분석은 prod 스트림(`dev.eastshine.kotonoha`)만 본다.

## GA4 프로퍼티 설정

- Google Signals **OFF** — 켜면 소규모 데이터가 thresholding 으로 가려진다.
- 데이터 보존 14개월.
- BigQuery export 는 **소급되지 않는다.** 새 이벤트를 늘리기 전에 켜져 있어야 한다. Sandbox 는 테이블 60일 만료·스트리밍 불가라 빌링 계정이 필요하다 (무료 범위 안, 예산 알림 $1).
- 커스텀 파라미터는 측정기준으로 등록해야 **GA4 UI 리포트**에 나온다. BigQuery 는 등록과 무관하게 다 들어온다.
- iOS 는 IDFA 를 수집하지 않는다 (ATT 프롬프트 불필요).
