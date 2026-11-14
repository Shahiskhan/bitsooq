-- Saved delivery/billing addresses are owned by the customer profile service.
CREATE TABLE customer_address (
    id CHAR(36) PRIMARY KEY,
    user_id VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    address_label VARCHAR(60) NOT NULL DEFAULT 'Home',
    recipient_name VARCHAR(160) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    address_line1 VARCHAR(240) NOT NULL,
    address_line2 VARCHAR(240) NULL,
    area VARCHAR(120) NULL,
    city VARCHAR(120) NOT NULL,
    region_code VARCHAR(80) NULL,
    postal_code VARCHAR(24) NULL,
    country_code CHAR(2) NOT NULL,
    delivery_instructions VARCHAR(500) NULL,
    is_default_shipping BOOLEAN NOT NULL DEFAULT FALSE,
    is_default_billing BOOLEAN NOT NULL DEFAULT FALSE,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    KEY ix_customer_address_owner (user_id, archived, created_at),
    CONSTRAINT ck_customer_address_version CHECK (version >= 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;
