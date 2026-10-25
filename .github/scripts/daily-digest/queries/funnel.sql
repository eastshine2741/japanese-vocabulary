-- 날짜별 퍼널 단계 인원(user_pseudo_id). @start..@end(KST, YYYYMMDD) 의 확정 테이블과 intraday 를 함께 읽는다.
-- 같은 날이 두 테이블에 다 있어도 DISTINCT 로 세서 겹쳐 세지 않는다.
WITH raw AS (
  SELECT *
  FROM `japanese-vocabulary-490916.analytics_539684755.events_*`
  WHERE (_TABLE_SUFFIX BETWEEN @start AND @end
      OR _TABLE_SUFFIX BETWEEN CONCAT('intraday_', @start) AND CONCAT('intraday_', @end))
    AND app_info.id = 'dev.eastshine.kotonoha'
),
-- docs/analytics.md 해석 주의: 운영자 설치, 스토어 테스트 기기. 운영자는 재설치 뒤 다음 날에야 로그인하기도 해서
-- 집계 구간보다 넓게(@excl_start..오늘) 본다.
excluded AS (
  SELECT DISTINCT user_pseudo_id
  FROM `japanese-vocabulary-490916.analytics_539684755.events_*`
  WHERE (_TABLE_SUFFIX BETWEEN @excl_start AND @today
      OR _TABLE_SUFFIX BETWEEN CONCAT('intraday_', @excl_start) AND CONCAT('intraday_', @today))
    AND (user_id IN ('1', '32')
     OR device.mobile_model_name = 'IN2025'
     OR (app_info.install_source = 'manual_install' AND device.mobile_brand_name IS NULL))
),
events AS (
  SELECT
    event_date,
    user_pseudo_id,
    user_id,
    event_name,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'firebase_screen') AS screen,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'mode') AS mode,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'previous_first_open_count') AS prev_open
  FROM raw
  WHERE user_pseudo_id NOT IN (SELECT user_pseudo_id FROM excluded)
),
installs AS (
  SELECT DISTINCT event_date, user_pseudo_id FROM events
  WHERE event_name = 'first_open' AND COALESCE(prev_open, 0) = 0
)
SELECT
  e.event_date AS date,
  -- 신규 설치 경로: 그날 처음 설치한 기기가 같은 날 어디까지 갔나
  COUNT(DISTINCT i.user_pseudo_id) AS install,
  COUNT(DISTINCT IF(i.user_pseudo_id IS NOT NULL AND e.user_id IS NOT NULL, e.user_pseudo_id, NULL)) AS install_login,
  COUNT(DISTINCT IF(i.user_pseudo_id IS NOT NULL AND e.event_name = 'card_reveal', e.user_pseudo_id, NULL)) AS install_reveal,
  COUNT(DISTINCT IF(i.user_pseudo_id IS NOT NULL AND e.event_name = 'card_rate', e.user_pseudo_id, NULL)) AS install_rate,
  -- 전체 활성 기기
  COUNT(DISTINCT e.user_pseudo_id) AS active,
  COUNT(DISTINCT IF(e.event_name = 'card_reveal', e.user_pseudo_id, NULL)) AS reveal,
  COUNT(DISTINCT IF(e.event_name = 'card_rate', e.user_pseudo_id, NULL)) AS rate,
  -- 곡 탐색 경로
  COUNT(DISTINCT IF(e.event_name = 'search_submit', e.user_pseudo_id, NULL)) AS search,
  COUNT(DISTINCT IF(e.event_name = 'screen_view' AND e.screen = 'SongDetail', e.user_pseudo_id, NULL)) AS song_detail,
  COUNT(DISTINCT IF(e.event_name = 'screen_view' AND e.screen = 'SongReview', e.user_pseudo_id, NULL)) AS song_review,
  -- 홈 세션 완주는 곡 탐색 경로가 아니라 뺀다
  COUNT(DISTINCT IF(e.event_name = 'review_complete' AND e.mode = 'source', e.user_pseudo_id, NULL)) AS review_complete
FROM events e
LEFT JOIN installs i ON i.event_date = e.event_date AND i.user_pseudo_id = e.user_pseudo_id
GROUP BY date
ORDER BY date
