ALTER TABLE user_settings ADD COLUMN settings JSON NOT NULL DEFAULT ('{}');

UPDATE user_settings
SET settings = JSON_OBJECT('requestRetention', request_retention, 'showIntervals', show_intervals);

ALTER TABLE user_settings DROP COLUMN request_retention;
ALTER TABLE user_settings DROP COLUMN show_intervals;
