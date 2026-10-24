-- 가사 줄 시각을 MV 하나에 맞춘 결과이자 로컬 PC 실행기의 작업 원장. MV 마다 인트로·삽입 장면이 달라 (가사, MV) 마다 한 행이다.
CREATE TABLE lyric_mv_sync (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    lyric_id BIGINT NOT NULL,
    youtube_video_id VARCHAR(11) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- 점유할 때마다 오른다. 결과는 점유한 attempt 로만 쓸 수 있어, 점유 기한이 지나 넘겨진 뒤 늦게 온 결과는 거절된다.
    attempt INT NOT NULL DEFAULT 0,
    -- RUNNING: 이 시각이 지나면 다른 점유가 가져간다(PC 가 처리 중에 꺼진 경우). PENDING: 일시 오류 뒤 이 시각까지 쉰다.
    lease_until DATETIME(6) NULL,

    -- OFFSET: SYNCED 가사 시각을 구간별로 민 것, ALIGNED: 음성 인식으로 새로 찾은 것
    method VARCHAR(20) NULL,
    -- [{index, startTimeMs}]. 가사 raw_content 의 index 와 짝이다.
    line_timings JSON NULL,
    -- 실행기가 낸 판정과 지표. 반영 여부에는 쓰지 않고 틀린 곡을 찾을 때 본다.
    confidence JSON NULL,
    error_message VARCHAR(1000) NULL,
    completed_at DATETIME(6) NULL,

    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    UNIQUE KEY uk_lyric_mv_sync (lyric_id, youtube_video_id),
    INDEX idx_lyric_mv_sync_queue (status, id),
    CONSTRAINT fk_lyric_mv_sync_lyric FOREIGN KEY (lyric_id) REFERENCES lyrics(id)
);

-- 이미 있는 곡도 한 번씩 맞춘다. youtube_url 은 앱이 watch?v= 형태로만 저장한다.
INSERT IGNORE INTO lyric_mv_sync (lyric_id, youtube_video_id)
SELECT s.active_lyric_id, SUBSTRING(s.youtube_url, LOCATE('v=', s.youtube_url) + 2, 11)
FROM songs s
WHERE s.active_lyric_id IS NOT NULL
  AND s.youtube_url REGEXP 'v=[A-Za-z0-9_-]{11}';
