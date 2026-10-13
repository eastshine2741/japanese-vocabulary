-- 카드는 등급마다 새로 발급한다. 행 하나가 등급 하나이고 등급은 바뀌지 않는다. 순번도 (곡|아티스트, 등급)마다 따로 센다.
-- issued_at 이 NULL 이면 서명 전(획득 연출이 남음).
ALTER TABLE song_card ADD COLUMN issued_at DATETIME(6) NULL;
UPDATE song_card SET issued_at = updated_at WHERE seen_grade IS NOT NULL;
ALTER TABLE song_card
    DROP INDEX uk_song_card_user_song,
    DROP INDEX uk_song_card_song_seq,
    DROP INDEX idx_song_card_user_artist_mastered,
    DROP COLUMN seen_grade,
    DROP COLUMN mastered_at,
    ADD CONSTRAINT uk_song_card_user_song_grade UNIQUE (user_id, song_id, grade),
    ADD CONSTRAINT uk_song_card_song_grade_seq UNIQUE (song_id, grade, acquired_seq),
    ADD INDEX idx_song_card_user_artist_grade (user_id, artist_id, grade);

ALTER TABLE artist_card ADD COLUMN issued_at DATETIME(6) NULL;
UPDATE artist_card SET issued_at = updated_at WHERE seen_grade IS NOT NULL;
ALTER TABLE artist_card
    DROP INDEX uk_artist_card_user_artist,
    DROP INDEX uk_artist_card_artist_seq,
    DROP COLUMN seen_grade,
    ADD CONSTRAINT uk_artist_card_user_artist_grade UNIQUE (user_id, artist_id, grade),
    ADD CONSTRAINT uk_artist_card_artist_grade_seq UNIQUE (artist_id, grade, acquired_seq);

-- 이미 있던 카드의 순번은 곡·아티스트 단위로 뽑혔으므로, 등급별 발급기를 그 카드들의 최댓값에서 이어 간다.
DROP TABLE reward_card_seq;
CREATE TABLE reward_card_seq (
    kind VARCHAR(10) NOT NULL,
    target_id BIGINT NOT NULL,
    grade VARCHAR(10) NOT NULL,
    last_seq INT NOT NULL,
    PRIMARY KEY (kind, target_id, grade)
);
INSERT INTO reward_card_seq (kind, target_id, grade, last_seq)
SELECT 'SONG', song_id, grade, MAX(acquired_seq) FROM song_card GROUP BY song_id, grade;
INSERT INTO reward_card_seq (kind, target_id, grade, last_seq)
SELECT 'ARTIST', artist_id, grade, MAX(acquired_seq) FROM artist_card GROUP BY artist_id, grade;
