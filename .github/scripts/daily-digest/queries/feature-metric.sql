-- 신기능 지표 하나의 날짜별 분자/분모 유저 수. 분모 이벤트가 '' 면 그날 활성 유저 전체.
-- 분자는 그날 분모에도 든 유저만 센다. 다른 경로로 같은 이벤트를 낸 유저까지 세면 비율이 100% 를 넘는다.
-- 파라미터 값은 string/int/double 어느 쪽으로 들어와도 문자열로 비교한다.
WITH raw AS (
  SELECT *
  FROM `japanese-vocabulary-490916.analytics_539684755.events_*`
  WHERE (_TABLE_SUFFIX BETWEEN @start AND @end
      OR _TABLE_SUFFIX BETWEEN CONCAT('intraday_', @start) AND CONCAT('intraday_', @end))
    AND app_info.id = 'dev.eastshine.kotonoha'
),
-- funnel.sql 과 같은 제외 규칙. 바꾸면 둘 다 바꾼다.
excluded AS (
  SELECT DISTINCT user_pseudo_id
  FROM `japanese-vocabulary-490916.analytics_539684755.events_*`
  WHERE (_TABLE_SUFFIX BETWEEN @excl_start AND @today
      OR _TABLE_SUFFIX BETWEEN CONCAT('intraday_', @excl_start) AND CONCAT('intraday_', @today))
    AND (user_id IN ('1', '32')
     OR device.mobile_model_name = 'IN2025'
     OR (app_info.install_source = 'manual_install' AND device.mobile_brand_name IS NULL))
),
ev AS (
  SELECT
    event_date,
    user_pseudo_id,
    event_name,
    (SELECT COALESCE(value.string_value, CAST(value.int_value AS STRING), CAST(CAST(value.double_value AS INT64) AS STRING))
     FROM UNNEST(event_params) WHERE key = @num_param) AS num_v,
    (SELECT COALESCE(value.string_value, CAST(value.int_value AS STRING), CAST(CAST(value.double_value AS INT64) AS STRING))
     FROM UNNEST(event_params) WHERE key = @den_param) AS den_v
  FROM raw
  WHERE user_pseudo_id NOT IN (SELECT user_pseudo_id FROM excluded)
),
user_day AS (
  SELECT
    event_date,
    user_pseudo_id,
    LOGICAL_OR(event_name = @num_event AND (@num_param = '' OR num_v = @num_value)) AS n,
    LOGICAL_OR(@den_event = '' OR (event_name = @den_event AND (@den_param = '' OR den_v = @den_value))) AS d
  FROM ev
  GROUP BY event_date, user_pseudo_id
)
SELECT event_date AS date, COUNTIF(n AND d) AS num, COUNTIF(d) AS den
FROM user_day
GROUP BY date
ORDER BY date
