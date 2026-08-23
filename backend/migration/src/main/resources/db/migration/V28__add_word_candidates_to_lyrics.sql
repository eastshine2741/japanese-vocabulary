ALTER TABLE lyrics
    ADD COLUMN word_candidates_json JSON NULL AFTER analyzed_content;
