ALTER TABLE words ADD COLUMN meanings JSON NOT NULL DEFAULT ('[]');

UPDATE words SET meanings = CASE
    WHEN korean_text IS NOT NULL AND korean_text != '' THEN JSON_ARRAY(JSON_OBJECT('text', korean_text, 'partOfSpeech', ''))
    ELSE '[]'
END;

ALTER TABLE words DROP COLUMN korean_text;
