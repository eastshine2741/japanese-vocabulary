-- Migrate user identity from id/pw to provider-agnostic OIDC schema.
-- Onboarding spec policy: wipe + replace (no real users to preserve).
-- Provider-agnostic = (provider, provider_sub) UNIQUE so Apple/other IDPs add as rows later.

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE deck_flashcards;
TRUNCATE TABLE decks;
TRUNCATE TABLE flashcards;
TRUNCATE TABLE song_words;
TRUNCATE TABLE words;
TRUNCATE TABLE user_settings;
TRUNCATE TABLE daily_study_summary;
TRUNCATE TABLE user_inventory;
TRUNCATE TABLE users;

ALTER TABLE users
    DROP COLUMN password,
    DROP INDEX name,
    ADD COLUMN provider VARCHAR(32) NOT NULL,
    ADD COLUMN provider_sub VARCHAR(255) NOT NULL,
    ADD COLUMN email VARCHAR(255) NULL,
    ADD UNIQUE KEY uk_user_provider (provider, provider_sub);

SET FOREIGN_KEY_CHECKS = 1;
