-- run.sh 가 맨 앞에 SET @d = 'YYYY-MM-DD'(KST 어제); 를 붙인다. DB 세션은 UTC 라 CURDATE() 를 쓰지 않는다.
-- 운영자(users.id 1, 32)는 docs/analytics.md 대로 뺀다. daily_study_summary 는 날짜 인덱스가 없어
-- 8일 범위만 읽는다. 전 기간을 긁지 말 것.
WITH RECURSIVE days AS (
  SELECT @d - INTERVAL 7 DAY AS d
  UNION ALL SELECT d + INTERVAL 1 DAY FROM days WHERE d < @d
),
study AS (
  SELECT date_kst, COUNT(*) AS reviewers, SUM(review_count) AS cards
  FROM daily_study_summary
  WHERE date_kst BETWEEN @d - INTERVAL 7 DAY AND @d
    AND review_count > 0
    AND user_id NOT IN (1, 32)
  GROUP BY date_kst
),
signups AS (
  SELECT DATE(CONVERT_TZ(created_at, '+00:00', '+09:00')) AS date_kst, COUNT(*) AS signups
  FROM users
  WHERE created_at >= CONVERT_TZ(@d - INTERVAL 15 DAY, '+09:00', '+00:00')
    AND id NOT IN (1, 32)
  GROUP BY date_kst
),
-- 어제 복귀한 코호트: D1 은 그제 가입자, D7 은 8일 전 가입자
cohort AS (
  SELECT
    u.id,
    DATEDIFF(@d, DATE(CONVERT_TZ(u.created_at, '+00:00', '+09:00'))) AS age,
    EXISTS (SELECT 1 FROM daily_study_summary s
            WHERE s.user_id = u.id AND s.date_kst = @d AND s.review_count > 0) AS returned
  FROM users u
  WHERE u.created_at >= CONVERT_TZ(@d - INTERVAL 7 DAY, '+09:00', '+00:00')
    AND u.created_at <  CONVERT_TZ(@d, '+09:00', '+00:00')
    AND u.id NOT IN (1, 32)
)
SELECT JSON_OBJECT(
  'date', DATE_FORMAT(@d, '%Y-%m-%d'),
  'days', (SELECT JSON_ARRAYAGG(JSON_OBJECT(
             'date', DATE_FORMAT(days.d, '%Y-%m-%d'),
             'reviewers', COALESCE(study.reviewers, 0),
             'cards', COALESCE(study.cards, 0),
             'signups', COALESCE(signups.signups, 0)))
           FROM days
           LEFT JOIN study ON study.date_kst = days.d
           LEFT JOIN signups ON signups.date_kst = days.d),
  'd1', JSON_OBJECT('users', (SELECT COUNT(*) FROM cohort WHERE age = 1),
                    'returned', (SELECT COALESCE(SUM(returned), 0) FROM cohort WHERE age = 1)),
  'd7', JSON_OBJECT('users', (SELECT COUNT(*) FROM cohort WHERE age = 7),
                    'returned', (SELECT COALESCE(SUM(returned), 0) FROM cohort WHERE age = 7)),
  'reports', JSON_OBJECT(
    'pending', (SELECT COUNT(*) FROM song_reports WHERE status = 'PENDING'),
    'new', (SELECT COUNT(*) FROM song_reports
            WHERE created_at >= CONVERT_TZ(@d, '+09:00', '+00:00')
              AND created_at <  CONVERT_TZ(@d + INTERVAL 1 DAY, '+09:00', '+00:00')),
    'oldest_pending_days', (SELECT DATEDIFF(UTC_TIMESTAMP(), MIN(created_at)) FROM song_reports WHERE status = 'PENDING'),
    'new_by_type', (SELECT JSON_OBJECTAGG(type, n) FROM (
                      SELECT type, COUNT(*) AS n FROM song_reports
                      WHERE created_at >= CONVERT_TZ(@d, '+09:00', '+00:00')
                        AND created_at <  CONVERT_TZ(@d + INTERVAL 1 DAY, '+09:00', '+00:00')
                      GROUP BY type) t))
) AS j;
