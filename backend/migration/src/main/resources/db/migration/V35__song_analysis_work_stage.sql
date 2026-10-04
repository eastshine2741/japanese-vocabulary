-- 곡 분석을 단계(stage) 하나가 메시지 하나인 파이프라인으로 나눈다. 단계마다 행 하나를 두고
-- 산출물과 실패 원인을 남긴다. 실패한 단계부터 다시 돌리려면 앞 단계 산출물이 있어야 하고,
-- 단계별로 무엇이 들어가고 나왔는지가 곧 디버깅 자료다.
--
-- 모든 변경은 song_analysis_work 행을 FOR UPDATE 로 잡은 채로 일어나므로 이 테이블에는 따로
-- 잠금 규칙이 없다. attempt 는 그 단계를 잡을 때마다 올라가는 펜스다: 죽었다고 보고 다른 worker
-- 가 넘겨받은 뒤에 원래 worker 가 뒤늦게 쓰는 결과는 attempt 가 달라 버려진다.
CREATE TABLE song_analysis_work_stage (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    work_id BIGINT NOT NULL,
    stage VARCHAR(40) NOT NULL,
    status VARCHAR(20) NOT NULL,
    attempt INT NOT NULL DEFAULT 0,

    -- 다음 단계의 입력. 가사 분석 단계는 끝난 갈래부터 채워지므로 실패한 행에도 일부가 남는다.
    output MEDIUMTEXT NULL,

    error_code VARCHAR(80) NULL,
    error_class VARCHAR(255) NULL,
    error_message TEXT NULL,

    started_at DATETIME(6) NULL,
    finished_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    CONSTRAINT uk_song_analysis_work_stage UNIQUE (work_id, stage),
    CONSTRAINT fk_song_analysis_work_stage_work FOREIGN KEY (work_id) REFERENCES song_analysis_work(id)
);

-- 재시도 마감은 "이번 실행이 시작된 시각" 부터 잰다. 관리자가 실패한 단계부터 다시 돌리면
-- 새로 찍힌다. 구 파드는 이 칼럼을 모르지만 NULL 허용이라 insert 가 깨지지 않는다.
ALTER TABLE song_analysis_work ADD COLUMN started_at DATETIME(6) NULL;
