-- 관리자가 확인한 아티스트의 공식 YouTube 채널. MV 검색은 이 채널의 영상을 아티스트 본인 영상으로 본다.
-- 채널 하나가 여러 아티스트를(ラブライブ!スーパースター!! → Liella! 와 유닛들), 아티스트 하나가 여러 채널을(본인·레이블) 가진다.
CREATE TABLE artist_youtube_channel (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    artist_id BIGINT NOT NULL,
    channel_id VARCHAR(64) NOT NULL,
    channel_title VARCHAR(255) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT uk_artist_youtube_channel UNIQUE (artist_id, channel_id),
    CONSTRAINT fk_artist_youtube_channel_artist FOREIGN KEY (artist_id) REFERENCES artist (id) ON DELETE CASCADE,
    INDEX idx_artist_youtube_channel_channel (channel_id)
);
