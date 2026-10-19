-- Apple Music 카탈로그 아티스트. 곡은 분석이 끝난 뒤 카탈로그에서 찾은 첫 아티스트에 이어진다.
CREATE TABLE artist (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    apple_music_id VARCHAR(32) NOT NULL,
    name VARCHAR(255) NOT NULL,
    artwork_url VARCHAR(500) NULL,
    apple_music_url VARCHAR(500) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT uk_artist_apple_music_id UNIQUE (apple_music_id)
);

ALTER TABLE songs
    ADD COLUMN artist_id BIGINT NULL,
    ADD INDEX idx_songs_artist_id (artist_id);
