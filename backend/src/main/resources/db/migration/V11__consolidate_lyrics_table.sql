-- 1. korean_lyrics → lyrics 리네임
RENAME TABLE korean_lyrics TO lyrics;

-- 2. songs에서 가사 컬럼을 lyrics로 이동
ALTER TABLE lyrics
    ADD COLUMN lyric_type ENUM('SYNCED','PLAIN') NOT NULL DEFAULT 'SYNCED' AFTER song_id,
    ADD COLUMN raw_content JSON NULL AFTER lyric_type,
    ADD COLUMN lrclib_id BIGINT NULL,
    ADD COLUMN vocadb_id BIGINT NULL;

-- content → analyzed_content 리네임
ALTER TABLE lyrics CHANGE COLUMN content analyzed_content JSON NULL;

-- 3. songs에서 데이터 복사
UPDATE lyrics l
    JOIN songs s ON l.song_id = s.id
SET l.lyric_type = s.lyric_type,
    l.raw_content = s.lyric_content,
    l.lrclib_id = s.lrclib_id,
    l.vocadb_id = s.vocadb_id;

-- 4. songs에서 가사 컬럼 제거
ALTER TABLE songs
    DROP COLUMN lyric_type,
    DROP COLUMN lyric_content,
    DROP COLUMN vocabulary_content,
    DROP COLUMN lrclib_id,
    DROP COLUMN vocadb_id;
