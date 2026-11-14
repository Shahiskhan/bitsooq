CREATE TABLE crypto_verification (
    id VARCHAR(36) PRIMARY KEY,
    order_id CHAR(36) NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    tx_hash VARCHAR(128) NOT NULL,
    network VARCHAR(32) NOT NULL,
    expected_amount_minor BIGINT NOT NULL,
    currency CHAR(3) NOT NULL,
    status VARCHAR(32) NOT NULL,
    reason VARCHAR(255) NULL,
    checked_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_crypto_tx (network, tx_hash)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

CREATE TABLE outbox (
    event_id CHAR(36) PRIMARY KEY,
    aggregate_id CHAR(36) NOT NULL,
    payload LONGTEXT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    published_at TIMESTAMP(6) NULL,
    INDEX idx_outbox_pending (published_at, created_at)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;
