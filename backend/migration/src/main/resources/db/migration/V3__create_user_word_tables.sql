CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6)
);

CREATE TABLE words (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    japanese_text VARCHAR(255) NOT NULL,
    reading VARCHAR(255),
    korean_text VARCHAR(500),
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE song_words (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    word_id BIGINT NOT NULL,
    song_id BIGINT NOT NULL,
    lyric_line VARCHAR(500),
    FOREIGN KEY (word_id) REFERENCES words(id),
    FOREIGN KEY (song_id) REFERENCES songs(id)
);
