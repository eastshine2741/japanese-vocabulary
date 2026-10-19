-- _ci/_ai collation 은 탁음·작은 글자·히라가나/가타카나를 무시해 まだ 와 また 가 한 단어로 합쳐진다.
-- 저장 키는 서버에서도 정확한 문자열로 찾으므로 바이트 비교로 맞춘다.
ALTER TABLE words MODIFY japanese_text VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;
