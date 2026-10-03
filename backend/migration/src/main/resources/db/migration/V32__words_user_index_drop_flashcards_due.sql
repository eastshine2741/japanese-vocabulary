-- 단어 목록(user_id = ? ORDER BY id DESC)이 PK 전체 역방향 스캔으로 풀리던 것을 막는다.
-- InnoDB 보조 인덱스 끝에 PK 가 붙으므로 (user_id, id) 순서로 읽힌다.
CREATE INDEX idx_words_user ON words (user_id);

-- 단어 회상 알림 폐기 후 user_id 없이 due 로만 조회하는 쿼리가 없다.
DROP INDEX idx_flashcards_due ON flashcards;
