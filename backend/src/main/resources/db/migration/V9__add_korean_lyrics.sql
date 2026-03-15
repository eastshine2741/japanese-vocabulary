CREATE TABLE korean_lyrics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    song_id BIGINT NOT NULL UNIQUE,
    status ENUM('PENDING','PROCESSING','COMPLETED','FAILED') NOT NULL DEFAULT 'PENDING',
    content JSON NULL,
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (song_id) REFERENCES songs(id)
);

CREATE INDEX idx_korean_lyrics_created_at ON korean_lyrics (created_at);

INSERT INTO korean_lyrics (song_id, status)
SELECT id, 'PENDING' FROM songs
WHERE lyric_content IS NOT NULL AND JSON_LENGTH(lyric_content) > 0;
