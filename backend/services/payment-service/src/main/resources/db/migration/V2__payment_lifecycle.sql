-- Provider-neutral payment ledger for retries, capture, refunds and webhook deduplication.
-- Never store PAN, CVV, PIN, OTP or provider secrets in this schema.
CREATE TABLE payment_attempt (
    id CHAR(36) PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    attempt_number SMALLINT NOT NULL,
    provider_code VARCHAR(40) NOT NULL,
    payment_method VARCHAR(40) NOT NULL,
    amount_minor BIGINT NOT NULL,
    currency CHAR(3) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'CREATED',
    idempotency_key VARCHAR(128) NOT NULL,
    provider_reference VARCHAR(160) NULL,
    failure_code VARCHAR(100) NULL,
    failure_message VARCHAR(500) NULL,
    authorized_at TIMESTAMP(6) NULL,
    captured_at TIMESTAMP(6) NULL,
    expires_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_payment_attempt_number (order_id, attempt_number),
    UNIQUE KEY uk_payment_attempt_idempotency (user_id, idempotency_key),
    UNIQUE KEY uk_payment_provider_reference (provider_code, provider_reference),
    KEY ix_payment_attempt_order_status (order_id, status, created_at),
    KEY ix_payment_attempt_reconcile (provider_code, status, updated_at),
    CONSTRAINT ck_payment_attempt_number CHECK (attempt_number > 0),
    CONSTRAINT ck_payment_attempt_amount CHECK (amount_minor > 0),
    CONSTRAINT ck_payment_attempt_status CHECK (status IN ('CREATED','REQUIRES_ACTION','AUTHORIZED','CAPTURED','DECLINED','CANCELLED','EXPIRED','PARTIALLY_REFUNDED','REFUNDED','UNKNOWN'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

CREATE TABLE payment_webhook_event (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    provider_code VARCHAR(40) NOT NULL,
    provider_event_id VARCHAR(180) NOT NULL,
    event_type VARCHAR(120) NOT NULL,
    payload_sha256 CHAR(64) NOT NULL,
    payment_attempt_id CHAR(36) NULL,
    signature_valid BOOLEAN NOT NULL,
    processing_status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
    received_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    processed_at TIMESTAMP(6) NULL,
    failure_code VARCHAR(100) NULL,
    UNIQUE KEY uk_payment_webhook_provider_event (provider_code, provider_event_id),
    KEY ix_payment_webhook_pending (processing_status, received_at),
    CONSTRAINT fk_payment_webhook_attempt FOREIGN KEY (payment_attempt_id) REFERENCES payment_attempt(id),
    CONSTRAINT ck_payment_webhook_status CHECK (processing_status IN ('RECEIVED','PROCESSING','PROCESSED','IGNORED','FAILED'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

CREATE TABLE payment_refund (
    id CHAR(36) PRIMARY KEY,
    payment_attempt_id CHAR(36) NOT NULL,
    order_id VARCHAR(36) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    provider_refund_reference VARCHAR(180) NULL,
    amount_minor BIGINT NOT NULL,
    currency CHAR(3) NOT NULL,
    reason_code VARCHAR(80) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
    requested_by VARCHAR(128) NOT NULL,
    provider_failure_code VARCHAR(100) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    completed_at TIMESTAMP(6) NULL,
    UNIQUE KEY uk_payment_refund_idempotency (payment_attempt_id, idempotency_key),
    UNIQUE KEY uk_payment_refund_provider_reference (provider_refund_reference),
    KEY ix_payment_refund_order (order_id, status, created_at),
    CONSTRAINT fk_payment_refund_attempt FOREIGN KEY (payment_attempt_id) REFERENCES payment_attempt(id),
    CONSTRAINT ck_payment_refund_amount CHECK (amount_minor > 0),
    CONSTRAINT ck_payment_refund_status CHECK (status IN ('REQUESTED','PENDING','SUCCEEDED','FAILED','CANCELLED'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

CREATE TABLE payment_method_token (
    id CHAR(36) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    provider_code VARCHAR(40) NOT NULL,
    provider_token_reference VARCHAR(255) NOT NULL,
    method_type VARCHAR(32) NOT NULL,
    brand VARCHAR(40) NULL,
    last_four CHAR(4) NULL,
    expiry_month TINYINT NULL,
    expiry_year SMALLINT NULL,
    label VARCHAR(80) NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_payment_method_provider_token (provider_code, provider_token_reference),
    KEY ix_payment_method_owner (user_id, revoked_at, created_at),
    CONSTRAINT ck_payment_method_type CHECK (method_type IN ('CARD','WALLET','BANK_TRANSFER','CASH_ON_DELIVERY')),
    CONSTRAINT ck_payment_method_card_tail CHECK (last_four IS NULL OR last_four REGEXP '^[0-9]{4}$'),
    CONSTRAINT ck_payment_method_expiry CHECK (
        (expiry_month IS NULL OR expiry_month BETWEEN 1 AND 12) AND (expiry_year IS NULL OR expiry_year BETWEEN 2020 AND 9999)
    )
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;
