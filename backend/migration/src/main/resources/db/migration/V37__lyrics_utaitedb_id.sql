-- UtaiteDB 곡 id 는 VocaDB 와 다른 공간이라 vocadb_id 에 섞을 수 없다.
ALTER TABLE lyrics
    ADD COLUMN utaitedb_id BIGINT NULL AFTER vocadb_id;
