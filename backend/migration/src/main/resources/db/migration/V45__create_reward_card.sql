-- 곡 카드. 유저·곡마다 한 장이고 등급은 오르기만 한다. rating 트랜잭션이 만들거나 등급을 올린다.
-- seen_grade 가 NULL 이면 서명 전(획득 연출이 남음), grade 와 다르면 등급 오름 연출이 남았다.
CREATE TABLE song_card (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    song_id BIGINT NOT NULL,
    -- 곡의 아티스트 연결이 나중에 바뀌어도 아티스트 카드의 마스터 수가 흔들리지 않게 박제한다.
    artist_id BIGINT NULL,
    grade VARCHAR(10) NOT NULL,
    seen_grade VARCHAR(10) NULL,
    acquired_seq INT NOT NULL,
    lyric_line_indexes JSON NOT NULL,
    signature JSON NOT NULL,
    mastered_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT uk_song_card_user_song UNIQUE (user_id, song_id),
    CONSTRAINT uk_song_card_song_seq UNIQUE (song_id, acquired_seq),
    INDEX idx_song_card_user_artist_mastered (user_id, artist_id, mastered_at)
);

-- 아티스트 카드. 그 아티스트의 첫 곡 카드와 함께 생긴다.
-- 구간 값을 다시 맞춰도 얻은 등급은 내리지 않으므로 마스터 곡 수에서 계산하지 않고 저장한다.
CREATE TABLE artist_card (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    artist_id BIGINT NOT NULL,
    grade VARCHAR(10) NOT NULL,
    seen_grade VARCHAR(10) NULL,
    acquired_seq INT NOT NULL,
    signature JSON NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT uk_artist_card_user_artist UNIQUE (user_id, artist_id),
    CONSTRAINT uk_artist_card_artist_seq UNIQUE (artist_id, acquired_seq)
);

-- 곡·아티스트별 카드 순번 발급기. MAX()+1 은 REPEATABLE READ 에서 갭 락끼리 데드락이 나서 행 하나를 원자적으로 올린다.
CREATE TABLE reward_card_seq (
    kind VARCHAR(10) NOT NULL,
    target_id BIGINT NOT NULL,
    last_seq INT NOT NULL,
    PRIMARY KEY (kind, target_id)
);
