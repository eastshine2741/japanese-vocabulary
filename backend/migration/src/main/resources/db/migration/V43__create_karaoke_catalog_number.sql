-- 노래방 카탈로그에서 한 번이라도 본 곡번호. 매일 카탈로그와 비교해 처음 보는 번호를 신곡 후보로 삼는다.
CREATE TABLE karaoke_catalog_number (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    vendor VARCHAR(10) NOT NULL,
    number INT NOT NULL,
    first_seen_on DATE NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT uk_karaoke_catalog_number_vendor_number UNIQUE (vendor, number)
);
