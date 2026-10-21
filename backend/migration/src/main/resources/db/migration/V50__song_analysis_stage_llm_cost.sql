-- ALTER 가 메타데이터 락을 기다리는 동안 이 테이블의 뒤 쿼리가 모두 막히므로, 기본값(1년) 대신 5초 만에 실패시킨다.
SET SESSION lock_wait_timeout = 5;
-- 한 작업의 단계들은 서로 다른 worker 파드에서 돌아서, 작업 비용은 단계 행에 남긴 값을 끝날 때 합한다.
-- 구 파드가 이 칼럼을 모른 채 insert 해도 깨지지 않게 NOT NULL DEFAULT 0 이다.
ALTER TABLE song_analysis_work_stage ADD COLUMN llm_cost_usd DECIMAL(12, 6) NOT NULL DEFAULT 0;
