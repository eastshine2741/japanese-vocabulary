CREATE TABLE daily_study_summary (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    date_kst DATE NOT NULL,
    review_count INT NOT NULL DEFAULT 0,
    freeze_used BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE KEY uk_daily_study_summary (user_id, date_kst),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Invariant: a row exists if and only if quantity >= 1.
-- consume() deletes the row when quantity reaches 0; quantity=0 rows are never created.
CREATE TABLE user_inventory (
    user_id BIGINT NOT NULL,
    item_type VARCHAR(32) NOT NULL,
    quantity INT NOT NULL,
    PRIMARY KEY (user_id, item_type),
    FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT chk_user_inventory_quantity CHECK (quantity >= 1)
);
