-- Gemini 요청/응답 페이로드 조사용 임시 테이블.
-- TODO: Loki 등 로그 수집 스택이 들어오면 이 테이블과 GeminiCallLogger를 지우고 stdout 구조화 로그로 이관한다.
--       그때까지 보존 정책이 없다. 커지면 수동으로 DELETE FROM gemini_call_log WHERE created_at < ... 한다.
CREATE TABLE gemini_call_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,

    song_id BIGINT NULL,
    lyric_id BIGINT NULL,

    call_name VARCHAR(40) NOT NULL,
    model VARCHAR(80) NOT NULL,

    -- 모델에 보낸 input payload(system prompt 제외)와 raw response. 유효하지 않은 JSON도 그대로
    -- 남겨야 하므로(잘린 응답이 조사 대상이다) JSON 대신 MEDIUMTEXT를 쓴다.
    request_json MEDIUMTEXT NOT NULL,
    response_json MEDIUMTEXT NULL,
    error_message VARCHAR(1000) NULL,

    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX idx_gemini_call_log_song (song_id, call_name),
    INDEX idx_gemini_call_log_created (created_at)
);
