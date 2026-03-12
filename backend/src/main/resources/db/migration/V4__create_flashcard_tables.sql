CREATE TABLE flashcards (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    word_id BIGINT NOT NULL UNIQUE,
    user_id BIGINT NOT NULL,
    due TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    stability DOUBLE NOT NULL DEFAULT 0,
    difficulty DOUBLE NOT NULL DEFAULT 0,
    state INT NOT NULL DEFAULT 0,
    last_review TIMESTAMP(6) NULL,
    fsrs_card_json JSON NOT NULL,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (word_id) REFERENCES words(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_flashcards_user_due (user_id, due),
    INDEX idx_flashcards_user_state (user_id, state)
);

CREATE TABLE user_settings (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL UNIQUE,
    request_retention DOUBLE NOT NULL DEFAULT 0.9,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
