-- Provider response metadata is optional and must be sanitized before storing.
ALTER TABLE moyasar_payment
    MODIFY COLUMN moyasar_payment_id VARCHAR(128) NULL,
    ADD COLUMN source JSON NULL;
