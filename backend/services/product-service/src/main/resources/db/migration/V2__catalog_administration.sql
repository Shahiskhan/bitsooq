CREATE TABLE category (
 id VARCHAR(64) PRIMARY KEY,
 name VARCHAR(100) NOT NULL,
 version BIGINT NOT NULL DEFAULT 0,
 active BOOLEAN NOT NULL DEFAULT TRUE
);
ALTER TABLE product ADD COLUMN category_id VARCHAR(64);
ALTER TABLE product ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE product ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE product ADD CONSTRAINT fk_product_category FOREIGN KEY(category_id) REFERENCES category(id);
CREATE INDEX product_active_sku ON product(active,sku);
CREATE TABLE stock_adjustment (
 id VARCHAR(36) NOT NULL UNIQUE,
 actor_id VARCHAR(128) NOT NULL,
 idempotency_key VARCHAR(128) NOT NULL,
 request_hash VARCHAR(64) NOT NULL,
 sku VARCHAR(64) NOT NULL,
 delta INT NOT NULL,
 reason VARCHAR(200) NOT NULL,
 result_json TEXT,
 created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(actor_id,idempotency_key),
 FOREIGN KEY(sku) REFERENCES product(sku)
);
