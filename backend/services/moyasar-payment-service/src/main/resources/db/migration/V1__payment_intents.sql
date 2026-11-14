CREATE TABLE moyasar_payment (
    id CHAR(36) PRIMARY KEY,
    order_id CHAR(36) NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    amount_minor BIGINT NOT NULL,
    currency CHAR(3) NOT NULL,
    status VARCHAR(32) NOT NULL,
    moyasar_payment_id VARCHAR(64) NULL,
    callback_url VARCHAR(500) NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_moyasar_idempotency (user_id, idempotency_key),
    INDEX idx_moyasar_order (order_id),
    CONSTRAINT ck_amount_positive CHECK (amount_minor > 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;
CREATE TABLE inbox (
    event_id CHAR(36) PRIMARY KEY,
    received_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;
CREATE TABLE outbox (
    event_id CHAR(36) PRIMARY KEY,
    aggregate_id CHAR(36) NOT NULL,
    payload LONGTEXT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    published_at TIMESTAMP(6) NULL,
    INDEX idx_outbox_pending (published_at, created_at)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;
