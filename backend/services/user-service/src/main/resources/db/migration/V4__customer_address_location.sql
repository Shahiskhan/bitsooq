ALTER TABLE customer_address
    ADD COLUMN latitude DECIMAL(10,7) NULL,
    ADD COLUMN longitude DECIMAL(10,7) NULL,
    ADD COLUMN location_accuracy_m INT NULL,
    ADD CONSTRAINT ck_customer_address_coordinates CHECK (
        (latitude IS NULL AND longitude IS NULL) OR
        (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
    ),
    ADD CONSTRAINT ck_customer_address_accuracy CHECK (location_accuracy_m IS NULL OR location_accuracy_m BETWEEN 1 AND 100000);
