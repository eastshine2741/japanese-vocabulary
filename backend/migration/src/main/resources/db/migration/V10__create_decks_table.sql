CREATE TABLE decks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    song_id BIGINT NOT NULL,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE (user_id, song_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (song_id) REFERENCES songs(id)
);

CREATE TABLE deck_flashcards (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    deck_id BIGINT NOT NULL,
    flashcard_id BIGINT NOT NULL,
    UNIQUE (deck_id, flashcard_id),
    FOREIGN KEY (deck_id) REFERENCES decks(id),
    FOREIGN KEY (flashcard_id) REFERENCES flashcards(id)
);

-- Backfill existing data
INSERT INTO decks (user_id, song_id, created_at)
SELECT DISTINCT w.user_id, sw.song_id, MIN(w.created_at)
FROM words w JOIN song_words sw ON sw.word_id = w.id
GROUP BY w.user_id, sw.song_id;

INSERT INTO deck_flashcards (deck_id, flashcard_id)
SELECT d.id, f.id
FROM decks d
JOIN song_words sw ON sw.song_id = d.song_id
JOIN words w ON sw.word_id = w.id AND w.user_id = d.user_id
JOIN flashcards f ON f.word_id = w.id
GROUP BY d.id, f.id;
