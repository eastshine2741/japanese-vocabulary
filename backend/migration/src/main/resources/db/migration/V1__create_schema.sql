CREATE TABLE songs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(255) NOT NULL,
    duration_seconds INT,
    lyric_type ENUM('SYNCED', 'PLAIN') NOT NULL,
    lyric_content JSON NOT NULL,
    vocabulary_content JSON NOT NULL,
    lrclib_id BIGINT,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE KEY uk_artist_title (artist, title)
);
