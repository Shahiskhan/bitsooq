ALTER TABLE orders ADD COLUMN payment_method VARCHAR(32) NULL;
ALTER TABLE orders ADD COLUMN payment_reference_id VARCHAR(255) NULL;
ALTER TABLE orders ADD COLUMN tx_hash VARCHAR(255) NULL;
CREATE INDEX idx_orders_payment ON orders(payment_method, status);
