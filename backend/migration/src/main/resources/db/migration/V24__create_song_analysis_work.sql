CREATE TABLE song_analysis_work (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,

    raw_title VARCHAR(255) NOT NULL,
    raw_artist VARCHAR(255) NOT NULL,
    duration_seconds INT NULL,
    artwork_url VARCHAR(500) NULL,
    active_dedup_key VARCHAR(512) NULL,

    status VARCHAR(40) NOT NULL,
    current_stage VARCHAR(40) NULL,

    song_id BIGINT NULL,
    lyric_id BIGINT NULL,

    locked_by VARCHAR(128) NULL,
    locked_until DATETIME(6) NULL,

    error_code VARCHAR(80) NULL,
    error_message TEXT NULL,

    trigger_source VARCHAR(40) NOT NULL,
    created_by_user_id BIGINT NULL,

    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    player_ready_at DATETIME(6) NULL,
    completed_at DATETIME(6) NULL,
    failed_at DATETIME(6) NULL,

    CONSTRAINT uk_song_analysis_work_active_dedup UNIQUE (active_dedup_key),
    INDEX idx_song_analysis_work_claim (status, locked_until, created_at),
    INDEX idx_song_analysis_work_song (song_id),
    CONSTRAINT fk_song_analysis_work_song FOREIGN KEY (song_id) REFERENCES songs(id),
    CONSTRAINT fk_song_analysis_work_lyric FOREIGN KEY (lyric_id) REFERENCES lyrics(id)
);
