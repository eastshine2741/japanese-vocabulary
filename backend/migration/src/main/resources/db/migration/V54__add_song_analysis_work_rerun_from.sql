-- 관리자가 한 작업의 한 단계부터 다시 돌린 작업. 범위 밖 단계 산출물은 source_work_id 작업에서 복사해 둔다.
-- 둘 다 NULL 이면 파이프라인 전체를 도는 작업이다.
ALTER TABLE song_analysis_work
    ADD COLUMN rerun_from VARCHAR(40) NULL,
    ADD COLUMN source_work_id BIGINT NULL;
