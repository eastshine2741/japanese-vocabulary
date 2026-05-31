CREATE TABLE notification_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    sent_at TIMESTAMP(6) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body VARCHAR(512) NOT NULL,
    INDEX idx_notification_logs_user (user_id)
);
