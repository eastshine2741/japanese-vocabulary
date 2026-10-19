-- 유저 제보 한 건이 행 하나다. status = APPROVED 인 행의 유저가 곡 상세 '기여' 섹션에 노출된다.
-- 곡·가사는 버전을 두지 않고 그 자리에서 고치므로, 무엇을 바꿨는지는 review_changes 에만 남는다.
CREATE TABLE song_reports (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,

    -- 서버가 채운다
    user_id BIGINT NOT NULL,
    song_id BIGINT NOT NULL,
    -- 제보 시점의 active 가사. 재분석으로 active 가 바뀌어도 어느 가사를 보고 낸 제보인지 남긴다.
    lyric_id BIGINT NULL,

    -- 유저가 채운다. 유형 목록과 유형별 target 형태는 서버 enum(SongReportType)이 소유한다.
    type VARCHAR(40) NOT NULL,
    -- 유저가 고른 위치(줄, 단어). 형태가 유형마다 달라 JSON. MV 제보는 NULL.
    report_target JSON NULL,
    -- 유저가 적은 정답 제안. MV 제보는 선택 입력이라 NULL 일 수 있다.
    report_suggestion TEXT NULL,

    -- 관리자가 채운다
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- 승인하며 실제로 바꾼 내용. [{field, locator, before, after}] 목록.
    review_changes JSON NULL,
    -- 반려 사유, 또는 다른 제보에서 이미 반영했다는 메모.
    review_note VARCHAR(500) NULL,
    reviewed_at DATETIME(6) NULL,

    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    INDEX idx_song_reports_contributors (song_id, status, user_id),
    INDEX idx_song_reports_review_queue (status, created_at),
    CONSTRAINT fk_song_reports_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_song_reports_song FOREIGN KEY (song_id) REFERENCES songs(id),
    CONSTRAINT fk_song_reports_lyric FOREIGN KEY (lyric_id) REFERENCES lyrics(id)
);
