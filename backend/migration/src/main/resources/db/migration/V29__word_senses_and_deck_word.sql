-- word 도메인을 sense 단위로 승격하고 song 도메인과의 물리적 결합을 decks.song_id 하나로 축소한다.
-- 설계 근거: .omc/specs/deep-interview-word-schema-decoupling.md

-- 1. words.senses 추가
ALTER TABLE words ADD COLUMN senses JSON NULL;

-- 2. meanings 원소를 sense 로 변환한다. jlpt 는 기존 데이터에 없으므로 null, examples 는 3단계에서 채운다.
UPDATE words w
JOIN (
    SELECT id,
           JSON_ARRAYAGG(
               JSON_OBJECT(
                   'meaning', meaning,
                   'partOfSpeech', part_of_speech,
                   'jlpt', NULL,
                   'examples', JSON_ARRAY()
               )
           ) AS senses
    FROM (
        SELECT w2.id,
               m.ord,
               JSON_UNQUOTE(JSON_EXTRACT(m.item, '$.text')) AS meaning,
               COALESCE(JSON_UNQUOTE(JSON_EXTRACT(m.item, '$.partOfSpeech')), '') AS part_of_speech
        FROM words w2,
             JSON_TABLE(w2.meanings, '$[*]' COLUMNS (ord FOR ORDINALITY, item JSON PATH '$')) m
        ORDER BY w2.id, m.ord
    ) ordered
    GROUP BY id
) s ON s.id = w.id
SET w.senses = s.senses;

UPDATE words SET senses = JSON_ARRAY() WHERE senses IS NULL;

-- 3. song_words 를 첫 sense 의 예문으로 부착한다.
--    sense 정보가 없던 테이블이므로 올바른 sense 로 배분할 수 없다 — 첫 sense 에 몰아넣는 것은 의도된 손실.
--    신규 코드의 sense 당 상한과 맞추기 위해 word 당 오래된 순 5개만 남긴다.
UPDATE words w
JOIN (
    SELECT word_id,
           JSON_ARRAYAGG(
               JSON_OBJECT(
                   'text', lyric_line,
                   'translation', korean_lyric_line,
                   'songId', song_id,
                   'lineIndex', NULL
               )
           ) AS examples
    FROM (
        SELECT sw.word_id,
               sw.song_id,
               sw.lyric_line,
               sw.korean_lyric_line,
               ROW_NUMBER() OVER (PARTITION BY sw.word_id ORDER BY sw.id) AS rn
        FROM song_words sw
        WHERE sw.lyric_line IS NOT NULL
    ) ranked
    WHERE rn <= 5
    GROUP BY word_id
) e ON e.word_id = w.id
SET w.senses = JSON_SET(w.senses, '$[0].examples', e.examples)
WHERE JSON_LENGTH(w.senses) > 0;

-- 4. meanings 제거
ALTER TABLE words MODIFY COLUMN senses JSON NOT NULL;
ALTER TABLE words DROP COLUMN meanings;

-- 5. decks 를 3종(전체/곡/일반) 단어장으로 확장한다.
--    MySQL UNIQUE 는 NULL 을 중복 허용하므로 is_default 는 1 또는 NULL 마커로 쓴다.
ALTER TABLE decks MODIFY COLUMN song_id BIGINT NULL;
ALTER TABLE decks ADD COLUMN is_default BOOLEAN NULL;
ALTER TABLE decks ADD CONSTRAINT uq_decks_user_default UNIQUE (user_id, is_default);

-- 6. 기존 유저 전원에게 전체 단어장을 실체화한다.
INSERT INTO decks (user_id, song_id, is_default, title, description, created_at)
SELECT u.id, NULL, TRUE, '전체 단어장', '', CURRENT_TIMESTAMP(6)
FROM users u;

-- 7. deck 멤버십을 flashcard 가 아닌 word 기준으로 재정의한다.
CREATE TABLE deck_word (
    id      BIGINT PRIMARY KEY AUTO_INCREMENT,
    deck_id BIGINT NOT NULL,
    word_id BIGINT NOT NULL,
    UNIQUE KEY uq_deck_word (deck_id, word_id),
    KEY idx_deck_word_word (word_id),
    CONSTRAINT fk_deck_word_deck FOREIGN KEY (deck_id) REFERENCES decks(id),
    CONSTRAINT fk_deck_word_word FOREIGN KEY (word_id) REFERENCES words(id)
);

INSERT IGNORE INTO deck_word (deck_id, word_id)
SELECT df.deck_id, f.word_id
FROM deck_flashcards df
JOIN flashcards f ON f.id = df.flashcard_id;

INSERT IGNORE INTO deck_word (deck_id, word_id)
SELECT d.id, w.id
FROM words w
JOIN decks d ON d.user_id = w.user_id AND d.is_default IS TRUE;

-- 8. 곡↔단어 매핑 테이블과 flashcard 기반 멤버십을 제거한다.
DROP TABLE song_words;
DROP TABLE deck_flashcards;
