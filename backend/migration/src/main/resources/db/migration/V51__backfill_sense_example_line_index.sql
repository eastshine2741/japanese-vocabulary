-- V29 가 옮긴 예문은 lineIndex 가 비어 있어 앱이 예문의 가사 줄로 이동하지 못한다. 곡의 active 가사에서 text 가 같은 첫 줄로 채운다.
-- 한 UPDATE 는 행마다 한 번만 고치므로 단어당 null 예문 하나씩 채운다. V29 가 단어당 5개까지만 옮겨 다섯 번이면 끝난다.
-- 가사가 바뀌어 같은 text 줄이 없는 예문은 null 로 남긴다.

UPDATE words w
JOIN (
    SELECT word_id, path, line_index
    FROM (
        SELECT matched.*, ROW_NUMBER() OVER (PARTITION BY word_id ORDER BY s, e) AS rn
        FROM (
            SELECT w2.id AS word_id,
                   ex.s,
                   ex.e,
                   CONCAT('$[', ex.s - 1, '].examples[', ex.e - 1, '].lineIndex') AS path,
                   (SELECT MIN(r.idx)
                    FROM songs s
                    JOIN lyrics l ON l.id = s.active_lyric_id,
                    JSON_TABLE(l.raw_content, '$[*]' COLUMNS (idx INT PATH '$.index', text VARCHAR(1000) PATH '$.text')) r
                    -- 기본 collation 은 탁점·요음을 무시해 다른 줄과 맞을 수 있다.
                    WHERE s.id = ex.song_id AND r.text = ex.text COLLATE utf8mb4_bin) AS line_index
            FROM words w2,
                 JSON_TABLE(w2.senses, '$[*]' COLUMNS (
                     s FOR ORDINALITY,
                     NESTED PATH '$.examples[*]' COLUMNS (
                         e FOR ORDINALITY,
                         song_id BIGINT PATH '$.songId',
                         line_index INT PATH '$.lineIndex',
                         text VARCHAR(1000) PATH '$.text'
                     )
                 )) ex
            WHERE ex.song_id IS NOT NULL AND ex.line_index IS NULL
        ) matched
        WHERE matched.line_index IS NOT NULL
    ) ranked
    WHERE rn = 1
) target ON target.word_id = w.id
SET w.senses = JSON_SET(w.senses, target.path, target.line_index);

UPDATE words w
JOIN (
    SELECT word_id, path, line_index
    FROM (
        SELECT matched.*, ROW_NUMBER() OVER (PARTITION BY word_id ORDER BY s, e) AS rn
        FROM (
            SELECT w2.id AS word_id,
                   ex.s,
                   ex.e,
                   CONCAT('$[', ex.s - 1, '].examples[', ex.e - 1, '].lineIndex') AS path,
                   (SELECT MIN(r.idx)
                    FROM songs s
                    JOIN lyrics l ON l.id = s.active_lyric_id,
                    JSON_TABLE(l.raw_content, '$[*]' COLUMNS (idx INT PATH '$.index', text VARCHAR(1000) PATH '$.text')) r
                    WHERE s.id = ex.song_id AND r.text = ex.text COLLATE utf8mb4_bin) AS line_index
            FROM words w2,
                 JSON_TABLE(w2.senses, '$[*]' COLUMNS (
                     s FOR ORDINALITY,
                     NESTED PATH '$.examples[*]' COLUMNS (
                         e FOR ORDINALITY,
                         song_id BIGINT PATH '$.songId',
                         line_index INT PATH '$.lineIndex',
                         text VARCHAR(1000) PATH '$.text'
                     )
                 )) ex
            WHERE ex.song_id IS NOT NULL AND ex.line_index IS NULL
        ) matched
        WHERE matched.line_index IS NOT NULL
    ) ranked
    WHERE rn = 1
) target ON target.word_id = w.id
SET w.senses = JSON_SET(w.senses, target.path, target.line_index);

UPDATE words w
JOIN (
    SELECT word_id, path, line_index
    FROM (
        SELECT matched.*, ROW_NUMBER() OVER (PARTITION BY word_id ORDER BY s, e) AS rn
        FROM (
            SELECT w2.id AS word_id,
                   ex.s,
                   ex.e,
                   CONCAT('$[', ex.s - 1, '].examples[', ex.e - 1, '].lineIndex') AS path,
                   (SELECT MIN(r.idx)
                    FROM songs s
                    JOIN lyrics l ON l.id = s.active_lyric_id,
                    JSON_TABLE(l.raw_content, '$[*]' COLUMNS (idx INT PATH '$.index', text VARCHAR(1000) PATH '$.text')) r
                    WHERE s.id = ex.song_id AND r.text = ex.text COLLATE utf8mb4_bin) AS line_index
            FROM words w2,
                 JSON_TABLE(w2.senses, '$[*]' COLUMNS (
                     s FOR ORDINALITY,
                     NESTED PATH '$.examples[*]' COLUMNS (
                         e FOR ORDINALITY,
                         song_id BIGINT PATH '$.songId',
                         line_index INT PATH '$.lineIndex',
                         text VARCHAR(1000) PATH '$.text'
                     )
                 )) ex
            WHERE ex.song_id IS NOT NULL AND ex.line_index IS NULL
        ) matched
        WHERE matched.line_index IS NOT NULL
    ) ranked
    WHERE rn = 1
) target ON target.word_id = w.id
SET w.senses = JSON_SET(w.senses, target.path, target.line_index);

UPDATE words w
JOIN (
    SELECT word_id, path, line_index
    FROM (
        SELECT matched.*, ROW_NUMBER() OVER (PARTITION BY word_id ORDER BY s, e) AS rn
        FROM (
            SELECT w2.id AS word_id,
                   ex.s,
                   ex.e,
                   CONCAT('$[', ex.s - 1, '].examples[', ex.e - 1, '].lineIndex') AS path,
                   (SELECT MIN(r.idx)
                    FROM songs s
                    JOIN lyrics l ON l.id = s.active_lyric_id,
                    JSON_TABLE(l.raw_content, '$[*]' COLUMNS (idx INT PATH '$.index', text VARCHAR(1000) PATH '$.text')) r
                    WHERE s.id = ex.song_id AND r.text = ex.text COLLATE utf8mb4_bin) AS line_index
            FROM words w2,
                 JSON_TABLE(w2.senses, '$[*]' COLUMNS (
                     s FOR ORDINALITY,
                     NESTED PATH '$.examples[*]' COLUMNS (
                         e FOR ORDINALITY,
                         song_id BIGINT PATH '$.songId',
                         line_index INT PATH '$.lineIndex',
                         text VARCHAR(1000) PATH '$.text'
                     )
                 )) ex
            WHERE ex.song_id IS NOT NULL AND ex.line_index IS NULL
        ) matched
        WHERE matched.line_index IS NOT NULL
    ) ranked
    WHERE rn = 1
) target ON target.word_id = w.id
SET w.senses = JSON_SET(w.senses, target.path, target.line_index);

UPDATE words w
JOIN (
    SELECT word_id, path, line_index
    FROM (
        SELECT matched.*, ROW_NUMBER() OVER (PARTITION BY word_id ORDER BY s, e) AS rn
        FROM (
            SELECT w2.id AS word_id,
                   ex.s,
                   ex.e,
                   CONCAT('$[', ex.s - 1, '].examples[', ex.e - 1, '].lineIndex') AS path,
                   (SELECT MIN(r.idx)
                    FROM songs s
                    JOIN lyrics l ON l.id = s.active_lyric_id,
                    JSON_TABLE(l.raw_content, '$[*]' COLUMNS (idx INT PATH '$.index', text VARCHAR(1000) PATH '$.text')) r
                    WHERE s.id = ex.song_id AND r.text = ex.text COLLATE utf8mb4_bin) AS line_index
            FROM words w2,
                 JSON_TABLE(w2.senses, '$[*]' COLUMNS (
                     s FOR ORDINALITY,
                     NESTED PATH '$.examples[*]' COLUMNS (
                         e FOR ORDINALITY,
                         song_id BIGINT PATH '$.songId',
                         line_index INT PATH '$.lineIndex',
                         text VARCHAR(1000) PATH '$.text'
                     )
                 )) ex
            WHERE ex.song_id IS NOT NULL AND ex.line_index IS NULL
        ) matched
        WHERE matched.line_index IS NOT NULL
    ) ranked
    WHERE rn = 1
) target ON target.word_id = w.id
SET w.senses = JSON_SET(w.senses, target.path, target.line_index);
