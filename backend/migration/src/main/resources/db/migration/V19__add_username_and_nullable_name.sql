-- O3 Sign Up: 신규 가입 시 사용자가 직접 정하는 영구 username 추가.
-- displayName은 선택 입력으로 바뀌어 NULL 허용.

ALTER TABLE users
    ADD COLUMN username VARCHAR(20) NOT NULL,
    ADD CONSTRAINT uk_user_username UNIQUE (username),
    MODIFY COLUMN name VARCHAR(100) NULL;
