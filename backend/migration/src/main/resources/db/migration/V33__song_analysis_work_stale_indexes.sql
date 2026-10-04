-- claim 쿼리가 임대(locked_until) 검사를 버리고 status 전이만 보게 되면서
-- (status, locked_until, created_at) 인덱스는 아무 쿼리도 쓰지 않는다. sweeper 의 두 쿼리
-- — 멈춘 RUNNING(status, updated_at) 과 유실된 PENDING(status, created_at) — 에 맞춰 바꾼다.
DROP INDEX idx_song_analysis_work_claim ON song_analysis_work;
CREATE INDEX idx_song_analysis_work_stale_running ON song_analysis_work (status, updated_at);
CREATE INDEX idx_song_analysis_work_stale_pending ON song_analysis_work (status, created_at);

-- locked_by / locked_until 칼럼은 여기서 지우지 않는다.
--
-- deploy.sh 는 마이그레이션 Job 이 끝난 뒤에 rollout 하므로(`kubectl wait job/migration`
-- 다음이 `kubectl rollout status`), 그 사이 구 파드가 아직 살아서 두 칼럼을 매핑한다.
-- 지금 지우면 그 창에서 song_analysis_work 를 건드리는 모든 문장이 Unknown column 으로
-- 깨진다 — api 의 분석 요청, worker 의 claim/단계 기록, admin-api 의 작업 조회 전부.
-- 칼럼 제거는 rollout 이 끝난 뒤 다음 배포의 마이그레이션으로 미룬다.
--
-- 인덱스 제거는 안전하다. SQL 은 인덱스 이름을 참조하지 않으므로 구 파드의 claim 쿼리는
-- 느려질 뿐 깨지지 않는다.
