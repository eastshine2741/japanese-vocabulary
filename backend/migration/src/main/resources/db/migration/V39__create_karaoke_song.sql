-- 노래방(TJ·금영)에 새로 등재된 일본곡. 노래방별로 한 행이고, 분석이 끝난 곡만 song_id 가 채워진다.
CREATE TABLE karaoke_song (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    vendor VARCHAR(10) NOT NULL,
    number INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(255) NOT NULL,
    artwork_url VARCHAR(500) NULL,
    listed_on DATE NOT NULL,
    song_id BIGINT NULL,
    notified_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT uk_karaoke_song_vendor_number UNIQUE (vendor, number),
    INDEX idx_karaoke_song_listed_on (listed_on),
    INDEX idx_karaoke_song_title_artist (title, artist)
);
