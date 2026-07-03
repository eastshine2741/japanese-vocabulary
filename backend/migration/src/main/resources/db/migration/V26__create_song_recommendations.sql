CREATE TABLE song_recommendation_candidate (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,

    source VARCHAR(40) NOT NULL,
    source_song_id VARCHAR(128) NOT NULL,
    week_start_date DATE NOT NULL,
    source_rank INT NOT NULL,

    status VARCHAR(40) NOT NULL,
    title VARCHAR(255) NOT NULL,
    artist_name VARCHAR(255) NOT NULL,
    duration_seconds INT NULL,
    artwork_url VARCHAR(500) NULL,
    source_url VARCHAR(500) NULL,
    source_artist_id VARCHAR(128) NULL,
    source_artist_url VARCHAR(500) NULL,
    release_date DATE NULL,
    genres_json JSON NULL,

    song_analysis_work_id BIGINT NULL,
    song_id BIGINT NULL,
    lyric_id BIGINT NULL,

    approved_at DATETIME(6) NULL,
    rejected_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    CONSTRAINT uk_song_rec_candidate_source_week_song UNIQUE (source, week_start_date, source_song_id),
    INDEX idx_song_rec_candidate_status_week_rank (status, week_start_date, source_rank),
    INDEX idx_song_rec_candidate_work (song_analysis_work_id),
    INDEX idx_song_rec_candidate_song (song_id),
    CONSTRAINT fk_song_rec_candidate_work FOREIGN KEY (song_analysis_work_id) REFERENCES song_analysis_work(id),
    CONSTRAINT fk_song_rec_candidate_song FOREIGN KEY (song_id) REFERENCES songs(id),
    CONSTRAINT fk_song_rec_candidate_lyric FOREIGN KEY (lyric_id) REFERENCES lyrics(id)
);

CREATE TABLE song_recommendation (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,

    candidate_id BIGINT NOT NULL,
    week_start_date DATE NOT NULL,
    status VARCHAR(40) NOT NULL,
    song_id BIGINT NOT NULL,
    lyric_id BIGINT NOT NULL,
    order_index INT NOT NULL DEFAULT 0,
    published_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    CONSTRAINT uk_song_rec_candidate UNIQUE (candidate_id),
    CONSTRAINT uk_song_rec_week_song UNIQUE (week_start_date, song_id),
    INDEX idx_song_rec_status_week_order_created (status, week_start_date, order_index, created_at),
    CONSTRAINT fk_song_rec_candidate FOREIGN KEY (candidate_id) REFERENCES song_recommendation_candidate(id),
    CONSTRAINT fk_song_rec_song FOREIGN KEY (song_id) REFERENCES songs(id),
    CONSTRAINT fk_song_rec_lyric FOREIGN KEY (lyric_id) REFERENCES lyrics(id)
);
