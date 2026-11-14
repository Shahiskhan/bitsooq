CREATE TABLE delivery_zone (
    id CHAR(36) PRIMARY KEY,
    zone_code VARCHAR(64) NOT NULL,
    country_code CHAR(2) NOT NULL,
    region_code VARCHAR(80) NOT NULL,
    city VARCHAR(120) NOT NULL,
    area VARCHAR(120) NULL,
    postal_prefix VARCHAR(24) NULL,
    priority SMALLINT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_delivery_zone_code (zone_code),
    KEY ix_delivery_zone_match (country_code, region_code, city, active, priority),
    KEY ix_delivery_zone_postal (country_code, postal_prefix)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

CREATE TABLE delivery_rate (
    id CHAR(36) PRIMARY KEY,
    zone_id CHAR(36) NOT NULL,
    method_code VARCHAR(40) NOT NULL,
    method_name VARCHAR(100) NOT NULL,
    fee_minor BIGINT NOT NULL,
    currency CHAR(3) NOT NULL,
    min_delivery_days SMALLINT NOT NULL,
    max_delivery_days SMALLINT NOT NULL,
    supports_cod BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_delivery_rate_method (zone_id, method_code),
    KEY ix_delivery_rate_active (zone_id, active, currency, fee_minor),
    CONSTRAINT fk_delivery_rate_zone FOREIGN KEY (zone_id) REFERENCES delivery_zone(id),
    CONSTRAINT ck_delivery_rate_fee CHECK (fee_minor >= 0),
    CONSTRAINT ck_delivery_rate_eta CHECK (min_delivery_days >= 0 AND max_delivery_days >= min_delivery_days)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

ALTER TABLE orders
    ADD COLUMN payment_status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN delivery_rate_id CHAR(36) NULL,
    ADD CONSTRAINT fk_order_delivery_rate FOREIGN KEY (delivery_rate_id) REFERENCES delivery_rate(id),
    ADD CONSTRAINT ck_order_payment_status CHECK (payment_status IN ('PENDING','COD_DUE','AUTHORIZED','PAID','FAILED','REFUNDED'));

ALTER TABLE order_address
    ADD COLUMN latitude DECIMAL(10,7) NULL,
    ADD COLUMN longitude DECIMAL(10,7) NULL,
    ADD COLUMN location_accuracy_m INT NULL,
    ADD CONSTRAINT ck_order_address_coordinates CHECK (
        (latitude IS NULL AND longitude IS NULL) OR
        (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
    ),
    ADD CONSTRAINT ck_order_address_accuracy CHECK (location_accuracy_m IS NULL OR location_accuracy_m BETWEEN 1 AND 100000);
