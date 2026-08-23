ALTER TABLE songs
    ADD COLUMN active_lyric_id BIGINT NULL AFTER artwork_url,
    ADD COLUMN updated_at DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) AFTER created_at;

UPDATE songs s
    LEFT JOIN lyrics l ON l.song_id = s.id
SET s.active_lyric_id = l.id
WHERE s.active_lyric_id IS NULL;

ALTER TABLE lyrics DROP FOREIGN KEY lyrics_ibfk_1;
ALTER TABLE lyrics DROP INDEX song_id;
CREATE INDEX idx_lyrics_song_id ON lyrics (song_id);
ALTER TABLE lyrics
    ADD CONSTRAINT fk_lyrics_song FOREIGN KEY (song_id) REFERENCES songs(id);

ALTER TABLE song_analysis_work
    ADD COLUMN youtube_url VARCHAR(500) NULL AFTER lyric_id;

CREATE INDEX idx_song_analysis_work_song_id ON song_analysis_work (song_id);

ALTER TABLE songs
    ADD CONSTRAINT fk_songs_active_lyric FOREIGN KEY (active_lyric_id) REFERENCES lyrics(id);
