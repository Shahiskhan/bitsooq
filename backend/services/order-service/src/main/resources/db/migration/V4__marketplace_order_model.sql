-- Keep the current order/saga path intact while adding order-time snapshots and fulfillment data.
ALTER TABLE orders
    ADD COLUMN subtotal_minor BIGINT NULL,
    ADD COLUMN discount_minor BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN shipping_minor BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN tax_minor BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN coupon_code VARCHAR(80) NULL,
    ADD COLUMN shipping_method_code VARCHAR(80) NULL,
    ADD COLUMN customer_email VARCHAR(254) NULL,
    ADD COLUMN customer_phone VARCHAR(32) NULL,
    ADD COLUMN customer_note VARCHAR(1000) NULL,
    ADD COLUMN locale VARCHAR(12) NOT NULL DEFAULT 'en',
    ADD COLUMN sales_channel VARCHAR(24) NOT NULL DEFAULT 'WEB',
    ADD COLUMN cancelled_at TIMESTAMP(6) NULL,
    ADD COLUMN cancellation_reason VARCHAR(240) NULL,
    ADD CONSTRAINT ck_order_amounts_nonnegative CHECK (
        (subtotal_minor IS NULL OR subtotal_minor >= 0) AND discount_minor >= 0 AND shipping_minor >= 0 AND tax_minor >= 0
    ),
    ADD CONSTRAINT ck_order_sales_channel CHECK (sales_channel IN ('WEB','MOBILE_APP','MARKETPLACE','STAFF'));

ALTER TABLE order_items
    ADD COLUMN product_name VARCHAR(200) NULL,
    ADD COLUMN variant_sku VARCHAR(64) NULL,
    ADD COLUMN unit_price_minor BIGINT NULL,
    ADD COLUMN currency CHAR(3) NULL,
    ADD COLUMN line_subtotal_minor BIGINT NULL,
    ADD COLUMN discount_minor BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN tax_minor BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN line_total_minor BIGINT NULL,
    ADD COLUMN product_snapshot JSON NULL,
    ADD CONSTRAINT ck_order_item_amounts_nonnegative CHECK (
        (unit_price_minor IS NULL OR unit_price_minor >= 0) AND discount_minor >= 0 AND tax_minor >= 0 AND
        (line_subtotal_minor IS NULL OR line_subtotal_minor >= 0) AND (line_total_minor IS NULL OR line_total_minor >= 0)
    );

CREATE TABLE order_address (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL,
    address_type VARCHAR(12) NOT NULL,
    recipient_name VARCHAR(160) NOT NULL,
    company VARCHAR(160) NULL,
    phone VARCHAR(32) NOT NULL,
    email VARCHAR(254) NULL,
    address_line1 VARCHAR(240) NOT NULL,
    address_line2 VARCHAR(240) NULL,
    area VARCHAR(120) NULL,
    city VARCHAR(120) NOT NULL,
    region_code VARCHAR(80) NULL,
    postal_code VARCHAR(24) NULL,
    country_code CHAR(2) NOT NULL,
    delivery_instructions VARCHAR(500) NULL,
    tax_registration_number VARCHAR(100) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_order_address_type (order_id, address_type),
    CONSTRAINT fk_order_address_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT ck_order_address_type CHECK (address_type IN ('SHIP_TO','BILL_TO'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

CREATE TABLE order_adjustment (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL,
    order_item_sku VARCHAR(64) NULL,
    adjustment_type VARCHAR(24) NOT NULL,
    code VARCHAR(80) NULL,
    label VARCHAR(160) NOT NULL,
    amount_minor BIGINT NOT NULL,
    currency CHAR(3) NOT NULL,
    metadata JSON NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    KEY ix_order_adjustment_order (order_id, adjustment_type),
    CONSTRAINT fk_order_adjustment_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT ck_order_adjustment_type CHECK (adjustment_type IN ('DISCOUNT','SHIPPING','SURCHARGE','ROUNDING')),
    CONSTRAINT ck_order_adjustment_amount CHECK (amount_minor >= 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

CREATE TABLE order_tax_line (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL,
    order_item_sku VARCHAR(64) NULL,
    authority_code VARCHAR(32) NOT NULL,
    jurisdiction_code VARCHAR(80) NOT NULL,
    tax_registration_number VARCHAR(100) NULL,
    tax_code VARCHAR(64) NULL,
    rate_basis_points INT NOT NULL,
    taxable_minor BIGINT NOT NULL,
    tax_minor BIGINT NOT NULL,
    currency CHAR(3) NOT NULL,
    invoice_number VARCHAR(100) NULL,
    reporting_status VARCHAR(20) NOT NULL DEFAULT 'NOT_SUBMITTED',
    reported_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    KEY ix_order_tax_reporting (authority_code, reporting_status, created_at),
    KEY ix_order_tax_order (order_id),
    CONSTRAINT fk_order_tax_line_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT ck_order_tax_values CHECK (rate_basis_points >= 0 AND taxable_minor >= 0 AND tax_minor >= 0),
    CONSTRAINT ck_order_tax_reporting_status CHECK (reporting_status IN ('NOT_SUBMITTED','PENDING','ACCEPTED','REJECTED','EXEMPT'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

CREATE TABLE order_status_history (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL,
    from_status VARCHAR(32) NULL,
    to_status VARCHAR(32) NOT NULL,
    actor_type VARCHAR(16) NOT NULL,
    actor_id VARCHAR(128) NULL,
    reason_code VARCHAR(80) NULL,
    note VARCHAR(500) NULL,
    event_id VARCHAR(36) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_order_status_event (event_id),
    KEY ix_order_status_history (order_id, created_at),
    CONSTRAINT fk_order_status_history_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT ck_order_status_actor CHECK (actor_type IN ('CUSTOMER','STAFF','SYSTEM','PROVIDER'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

CREATE TABLE shipment (
    id CHAR(36) PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL,
    seller_id CHAR(36) NULL,
    shipment_number VARCHAR(64) NOT NULL,
    carrier_code VARCHAR(64) NULL,
    service_code VARCHAR(64) NULL,
    tracking_number VARCHAR(120) NULL,
    tracking_url VARCHAR(1000) NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    shipping_minor BIGINT NOT NULL DEFAULT 0,
    currency CHAR(3) NULL,
    shipped_at TIMESTAMP(6) NULL,
    estimated_delivery_at TIMESTAMP(6) NULL,
    delivered_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_shipment_number (shipment_number),
    KEY ix_shipment_order_status (order_id, status),
    KEY ix_shipment_tracking (carrier_code, tracking_number),
    CONSTRAINT fk_shipment_order FOREIGN KEY (order_id) REFERENCES orders(id),
    CONSTRAINT ck_shipment_status CHECK (status IN ('PENDING','LABEL_CREATED','READY','SHIPPED','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED','FAILED','RETURNED','CANCELLED')),
    CONSTRAINT ck_shipment_shipping_amount CHECK (shipping_minor >= 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

CREATE TABLE shipment_item (
    shipment_id CHAR(36) NOT NULL,
    order_id VARCHAR(36) NOT NULL,
    sku VARCHAR(64) NOT NULL,
    quantity INT NOT NULL,
    PRIMARY KEY (shipment_id, sku),
    KEY ix_shipment_item_order (order_id, sku),
    CONSTRAINT fk_shipment_item_shipment FOREIGN KEY (shipment_id) REFERENCES shipment(id) ON DELETE CASCADE,
    CONSTRAINT fk_shipment_item_order_item FOREIGN KEY (order_id, sku) REFERENCES order_items(order_id, sku),
    CONSTRAINT ck_shipment_item_quantity CHECK (quantity > 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

CREATE TABLE shipment_event (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    shipment_id CHAR(36) NOT NULL,
    event_code VARCHAR(64) NOT NULL,
    description VARCHAR(300) NULL,
    location VARCHAR(160) NULL,
    occurred_at TIMESTAMP(6) NOT NULL,
    received_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    KEY ix_shipment_event_timeline (shipment_id, occurred_at),
    CONSTRAINT fk_shipment_event_shipment FOREIGN KEY (shipment_id) REFERENCES shipment(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

CREATE TABLE return_request (
    id CHAR(36) PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'REQUESTED',
    reason_code VARCHAR(80) NOT NULL,
    customer_note VARCHAR(1000) NULL,
    resolution VARCHAR(24) NULL,
    requested_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    resolved_at TIMESTAMP(6) NULL,
    KEY ix_return_order_status (order_id, status),
    KEY ix_return_customer (user_id, requested_at),
    CONSTRAINT fk_return_request_order FOREIGN KEY (order_id) REFERENCES orders(id),
    CONSTRAINT ck_return_status CHECK (status IN ('REQUESTED','APPROVED','REJECTED','IN_TRANSIT','RECEIVED','COMPLETED','CANCELLED')),
    CONSTRAINT ck_return_resolution CHECK (resolution IS NULL OR resolution IN ('REFUND','REPLACEMENT','STORE_CREDIT'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

CREATE TABLE return_item (
    return_id CHAR(36) NOT NULL,
    order_id VARCHAR(36) NOT NULL,
    sku VARCHAR(64) NOT NULL,
    quantity INT NOT NULL,
    condition_code VARCHAR(24) NULL,
    refund_minor BIGINT NULL,
    PRIMARY KEY (return_id, sku),
    CONSTRAINT fk_return_item_request FOREIGN KEY (return_id) REFERENCES return_request(id) ON DELETE CASCADE,
    CONSTRAINT fk_return_item_order_item FOREIGN KEY (order_id, sku) REFERENCES order_items(order_id, sku),
    CONSTRAINT ck_return_item_quantity CHECK (quantity > 0),
    CONSTRAINT ck_return_item_refund CHECK (refund_minor IS NULL OR refund_minor >= 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;
