-- 곡·가사 행은 분석이 끝날 때 만들어지므로, 분석 중 호출은 작업으로만 묶을 수 있다.
ALTER TABLE gemini_call_log
    ADD COLUMN work_id BIGINT NULL AFTER id,
    ADD INDEX idx_gemini_call_log_work (work_id, call_name);
