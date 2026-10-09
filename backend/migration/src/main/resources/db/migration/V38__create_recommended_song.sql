-- song_recommendation / song_recommendation_candidate 는 구 pod 가 validate 하는 동안 남겨 두고, 다음 릴리스에서 지운다.
CREATE TABLE recommended_song (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,

    song_id BIGINT NOT NULL,
    order_index INT NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    CONSTRAINT uk_recommended_song_song UNIQUE (song_id),
    INDEX idx_recommended_song_order (order_index, id),
    CONSTRAINT fk_recommended_song_song FOREIGN KEY (song_id) REFERENCES songs(id)
);
