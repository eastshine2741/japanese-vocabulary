-- 아티스트 카드는 회원 카드라 아티스트마다 한 장이고 등급이 오른다. 팬 번호는 BRONZE 에 닿을 때 한 번 매긴다 — 기본 카드엔 없다.
-- issued_at 이 NULL 이면 서명 전(획득 연출이 남음), seen_grade 가 grade 와 다르면 강화 연출이 남았다.
ALTER TABLE artist_card
    ADD COLUMN seen_grade VARCHAR(10) NULL,
    ADD COLUMN fan_no INT NULL;

-- 등급마다 따로 나온 카드를 가장 먼저 받은 카드(첫 서명) 한 장으로 합친다. 팬 번호는 BRONZE 카드의 순번이다.
CREATE TEMPORARY TABLE artist_card_merge AS
SELECT user_id,
       artist_id,
       MIN(id) AS keep_id,
       ELT(MAX(FIELD(grade, 'BASIC', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND')),
           'BASIC', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND') AS top_grade,
       MAX(CASE WHEN grade = 'BRONZE' THEN acquired_seq END) AS fan_no
FROM artist_card
GROUP BY user_id, artist_id;

DELETE c FROM artist_card c
    JOIN artist_card_merge m ON c.user_id = m.user_id AND c.artist_id = m.artist_id
WHERE c.id <> m.keep_id;

UPDATE artist_card c
    JOIN artist_card_merge m ON c.id = m.keep_id
SET c.grade = m.top_grade, c.seen_grade = m.top_grade, c.fan_no = m.fan_no;

DROP TEMPORARY TABLE artist_card_merge;

ALTER TABLE artist_card
    DROP INDEX uk_artist_card_user_artist_grade,
    DROP INDEX uk_artist_card_artist_grade_seq,
    DROP COLUMN acquired_seq,
    ADD CONSTRAINT uk_artist_card_user_artist UNIQUE (user_id, artist_id),
    ADD CONSTRAINT uk_artist_card_artist_fan_no UNIQUE (artist_id, fan_no);

-- 아티스트 순번은 팬 번호 하나만 남는다. 발급기 행은 BRONZE 키를 그대로 쓴다.
DELETE FROM reward_card_seq WHERE kind = 'ARTIST' AND grade <> 'BRONZE';
