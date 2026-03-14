ALTER TABLE words ADD CONSTRAINT uq_words_user_japanese UNIQUE (user_id, japanese_text);
ALTER TABLE song_words ADD CONSTRAINT uq_song_words UNIQUE (word_id, song_id, lyric_line(255));
