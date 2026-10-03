-- 활성 작업 중복 차단이 active_dedup_key UNIQUE 제약에서 (raw_title, raw_artist) 를
-- FOR UPDATE 로 읽는 갭 락으로 옮겨간다. 이 인덱스가 없으면 그 락이 풀스캔하며 스캔한
-- 행을 모두 잠가서, 서로 무관한 곡의 분석 요청까지 직렬화된다. 선택이 아니라 전제다.
CREATE INDEX idx_song_analysis_work_raw_song ON song_analysis_work (raw_title, raw_artist);

-- active_dedup_key 칼럼과 그 UNIQUE 제약은 여기서 지우지 않는다 — V33 과 같은 이유로,
-- 마이그레이션과 rollout 사이에 살아 있는 구 파드가 이 칼럼을 매핑한다.
--
-- 그 창에서 두 방식이 공존한다. 신 파드는 이 칼럼을 NULL 로 두고(MySQL UNIQUE 는 NULL
-- 중복을 허용한다) 갭 락으로 막고, 구 파드는 여전히 키를 채워 UNIQUE 로 막는다. 신 파드가
-- 만든 행은 키가 NULL 이라 구 파드의 findByActiveDedupKey 에 걸리지 않으므로, rollout
-- 동안 같은 곡에 작업이 둘 생길 수 있다. 한 배포 창에 한정되고 결과는 곡 하나가 두 번
-- 분석되는 것이라 받아들인다.
