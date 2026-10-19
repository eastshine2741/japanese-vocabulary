-- 배포와 분리해 기능을 켜고 끄는 플래그. start_at <= now < end_at 동안 켜지고, start_at 이 NULL 이면 꺼져 있다.
CREATE TABLE feature_flag (
    flag_key VARCHAR(100) PRIMARY KEY,
    start_at DATETIME(6) NULL,
    end_at DATETIME(6) NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
);
