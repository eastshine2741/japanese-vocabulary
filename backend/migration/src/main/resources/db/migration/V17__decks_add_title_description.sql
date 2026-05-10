ALTER TABLE decks ADD COLUMN title VARCHAR(255), ADD COLUMN description VARCHAR(255);

UPDATE decks d JOIN songs s ON s.id = d.song_id
SET d.title = COALESCE(s.title, ''),
    d.description = COALESCE(s.artist, '');

ALTER TABLE decks
  MODIFY title VARCHAR(255) NOT NULL,
  MODIFY description VARCHAR(255) NOT NULL;
