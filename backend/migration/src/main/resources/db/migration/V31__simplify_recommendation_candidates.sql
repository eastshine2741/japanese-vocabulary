ALTER TABLE song_recommendation_candidate
    DROP FOREIGN KEY fk_song_rec_candidate_work,
    DROP FOREIGN KEY fk_song_rec_candidate_song,
    DROP FOREIGN KEY fk_song_rec_candidate_lyric;

DROP INDEX idx_song_rec_candidate_work ON song_recommendation_candidate;
DROP INDEX idx_song_rec_candidate_song ON song_recommendation_candidate;

ALTER TABLE song_recommendation_candidate
    DROP COLUMN song_analysis_work_id,
    DROP COLUMN song_id,
    DROP COLUMN lyric_id;
