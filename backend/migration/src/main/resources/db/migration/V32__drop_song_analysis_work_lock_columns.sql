-- 곡 분석 작업의 임대(lease) 컬럼 제거.
--
-- locked_until 은 폴링 시절 worker 가 claim 시점에 적던 마감이고, locked_by 는 그 소유자였다.
-- 상호배제는 status 전이(PENDING -> RUNNING)와 행 잠금이 이미 보장하므로 둘 다 필요 없다.
-- 멈춘 작업 판정은 updated_at 기준으로 옮긴다 — claim 과 단계 기록마다 갱신되므로
-- "총 실행 시간" 이 아니라 "진행이 멈춘 시간" 을 재게 된다.
ALTER TABLE song_analysis_work
    DROP COLUMN locked_by,
    DROP COLUMN locked_until;

-- 사라진 claim 쿼리용 인덱스를 sweeper 의 두 쿼리에 맞춰 교체한다.
--   RUNNING + updated_at   : 진행이 멈춘 행
--   PENDING + created_at   : 메시지를 잃은 행
DROP INDEX idx_song_analysis_work_claim ON song_analysis_work;
CREATE INDEX idx_song_analysis_work_stale_running ON song_analysis_work (status, updated_at);
CREATE INDEX idx_song_analysis_work_stale_pending ON song_analysis_work (status, created_at);
