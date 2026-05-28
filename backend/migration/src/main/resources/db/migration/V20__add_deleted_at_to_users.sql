-- Self-service account deletion: soft delete via deleted_at timestamp.
-- A NULL deleted_at means an active account; any non-NULL value disables the account.
-- On deletion the application mutates provider_sub and username so the unique
-- constraints don't block re-signup with the same Google identity.
--
-- username is widened from VARCHAR(20) to VARCHAR(63) to leave room for the
-- "deleted:{id}:{원본}" prefix on soft-deleted rows. Active usernames are still
-- capped at 20 chars by UsernamePolicy at the application layer.

ALTER TABLE users
    ADD COLUMN deleted_at TIMESTAMP(6) NULL,
    MODIFY COLUMN username VARCHAR(63) NOT NULL;
