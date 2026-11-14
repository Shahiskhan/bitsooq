-- Expand the original SKU catalog into a marketplace-ready product information model.
-- The legacy product columns remain authoritative for the current catalog API and inventory saga.

CREATE TABLE brand (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    slug VARCHAR(180) NOT NULL,
    description TEXT NULL,
    logo_url VARCHAR(1000) NULL,
    website_url VARCHAR(500) NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_brand_slug (slug),
    KEY ix_brand_active_name (active, name)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

CREATE TABLE seller (
    id CHAR(36) PRIMARY KEY,
    owner_user_id VARCHAR(128) NOT NULL,
    display_name VARCHAR(160) NOT NULL,
    legal_name VARCHAR(200) NULL,
    slug VARCHAR(180) NOT NULL,
    email VARCHAR(254) NULL,
    phone VARCHAR(32) NULL,
    country_code CHAR(2) NOT NULL,
    tax_registration_number VARCHAR(100) NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_seller_slug (slug),
    KEY ix_seller_owner_status (owner_user_id, status),
    CONSTRAINT ck_seller_status CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','CLOSED'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

ALTER TABLE category
    ADD COLUMN name_ar VARCHAR(100) NULL,
    ADD COLUMN slug VARCHAR(140) NULL,
    ADD COLUMN description TEXT NULL,
    ADD COLUMN parent_id VARCHAR(64) NULL,
    ADD COLUMN image_url VARCHAR(1000) NULL,
    ADD COLUMN sort_order INT NOT NULL DEFAULT 0,
    ADD COLUMN created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    ADD COLUMN updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6);
UPDATE category SET slug = LOWER(id) WHERE slug IS NULL;
ALTER TABLE category
    MODIFY COLUMN slug VARCHAR(140) NOT NULL,
    ADD UNIQUE KEY uk_category_slug (slug),
    ADD KEY ix_category_parent_sort (parent_id, active, sort_order),
    ADD CONSTRAINT fk_category_parent FOREIGN KEY (parent_id) REFERENCES category(id);

ALTER TABLE product
    ADD COLUMN slug VARCHAR(220) NULL,
    ADD COLUMN parent_sku VARCHAR(64) NULL,
    ADD COLUMN brand_id CHAR(36) NULL,
    ADD COLUMN seller_id CHAR(36) NULL,
    ADD COLUMN barcode_gtin VARCHAR(14) NULL,
    ADD COLUMN mpn VARCHAR(100) NULL,
    ADD COLUMN product_type VARCHAR(24) NOT NULL DEFAULT 'PHYSICAL',
    ADD COLUMN condition_code VARCHAR(24) NOT NULL DEFAULT 'NEW',
    ADD COLUMN short_description VARCHAR(500) NULL,
    ADD COLUMN compare_at_minor BIGINT NULL,
    ADD COLUMN cost_minor BIGINT NULL,
    ADD COLUMN weight_grams INT NULL,
    ADD COLUMN length_mm INT NULL,
    ADD COLUMN width_mm INT NULL,
    ADD COLUMN height_mm INT NULL,
    ADD COLUMN country_of_origin CHAR(2) NULL,
    ADD COLUMN warranty_months SMALLINT NULL,
    ADD COLUMN tax_class_code VARCHAR(64) NULL,
    ADD COLUMN returnable BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN published_at TIMESTAMP(6) NULL,
    ADD COLUMN created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    ADD COLUMN updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6);
UPDATE product SET slug = LOWER(REPLACE(REPLACE(sku, '_', '-'), ' ', '-')) WHERE slug IS NULL;
ALTER TABLE product
    MODIFY COLUMN slug VARCHAR(220) NOT NULL,
    ADD UNIQUE KEY uk_product_slug (slug),
    ADD UNIQUE KEY uk_product_gtin (barcode_gtin),
    ADD KEY ix_product_parent_sku (parent_sku, active),
    ADD KEY ix_product_brand_active (brand_id, active),
    ADD KEY ix_product_seller_active (seller_id, active),
    ADD KEY ix_product_type_condition (product_type, condition_code, active),
    ADD CONSTRAINT fk_product_parent FOREIGN KEY (parent_sku) REFERENCES product(sku),
    ADD CONSTRAINT fk_product_brand FOREIGN KEY (brand_id) REFERENCES brand(id),
    ADD CONSTRAINT fk_product_seller FOREIGN KEY (seller_id) REFERENCES seller(id),
    ADD CONSTRAINT ck_product_type CHECK (product_type IN ('PHYSICAL','DIGITAL','SERVICE','BUNDLE')),
    ADD CONSTRAINT ck_product_condition CHECK (condition_code IN ('NEW','OPEN_BOX','REFURBISHED','USED')),
    ADD CONSTRAINT ck_product_compare_price CHECK (compare_at_minor IS NULL OR compare_at_minor >= price_minor),
    ADD CONSTRAINT ck_product_dimensions CHECK (
        (weight_grams IS NULL OR weight_grams >= 0) AND
        (length_mm IS NULL OR length_mm >= 0) AND
        (width_mm IS NULL OR width_mm >= 0) AND
        (height_mm IS NULL OR height_mm >= 0)
    );

CREATE TABLE category_translation (
    category_id VARCHAR(64) NOT NULL,
    locale VARCHAR(12) NOT NULL,
    name VARCHAR(160) NOT NULL,
    description TEXT NULL,
    PRIMARY KEY (category_id, locale),
    CONSTRAINT fk_category_translation_category FOREIGN KEY (category_id) REFERENCES category(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

CREATE TABLE product_translation (
    sku VARCHAR(64) NOT NULL,
    locale VARCHAR(12) NOT NULL,
    name VARCHAR(200) NOT NULL,
    short_description VARCHAR(500) NULL,
    description TEXT NULL,
    seo_title VARCHAR(200) NULL,
    seo_description VARCHAR(320) NULL,
    PRIMARY KEY (sku, locale),
    CONSTRAINT fk_product_translation_product FOREIGN KEY (sku) REFERENCES product(sku) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

CREATE TABLE product_media (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(64) NOT NULL,
    media_type VARCHAR(16) NOT NULL DEFAULT 'IMAGE',
    url VARCHAR(1200) NOT NULL,
    alt_text VARCHAR(300) NULL,
    locale VARCHAR(12) NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_product_media_order (sku, sort_order),
    KEY ix_product_media_primary (sku, is_primary),
    CONSTRAINT fk_product_media_product FOREIGN KEY (sku) REFERENCES product(sku) ON DELETE CASCADE,
    CONSTRAINT ck_product_media_type CHECK (media_type IN ('IMAGE','VIDEO','DOCUMENT'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

CREATE TABLE product_category (
    sku VARCHAR(64) NOT NULL,
    category_id VARCHAR(64) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    PRIMARY KEY (sku, category_id),
    KEY ix_product_category_category (category_id, sort_order),
    CONSTRAINT fk_product_category_product FOREIGN KEY (sku) REFERENCES product(sku) ON DELETE CASCADE,
    CONSTRAINT fk_product_category_category FOREIGN KEY (category_id) REFERENCES category(id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

CREATE TABLE product_attribute_definition (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    category_id VARCHAR(64) NULL,
    attribute_key VARCHAR(80) NOT NULL,
    label VARCHAR(160) NOT NULL,
    data_type VARCHAR(20) NOT NULL,
    unit VARCHAR(32) NULL,
    required BOOLEAN NOT NULL DEFAULT FALSE,
    filterable BOOLEAN NOT NULL DEFAULT FALSE,
    searchable BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    UNIQUE KEY uk_attribute_key_category (category_id, attribute_key),
    CONSTRAINT fk_attribute_category FOREIGN KEY (category_id) REFERENCES category(id),
    CONSTRAINT ck_attribute_data_type CHECK (data_type IN ('TEXT','NUMBER','BOOLEAN','DATE','SELECT','MULTI_SELECT'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

CREATE TABLE product_attribute_value (
    sku VARCHAR(64) NOT NULL,
    attribute_id BIGINT NOT NULL,
    locale VARCHAR(12) NOT NULL DEFAULT 'en',
    value_text LONGTEXT NOT NULL,
    PRIMARY KEY (sku, attribute_id, locale),
    KEY ix_attribute_value_filter (attribute_id, value_text(120)),
    CONSTRAINT fk_attribute_value_product FOREIGN KEY (sku) REFERENCES product(sku) ON DELETE CASCADE,
    CONSTRAINT fk_attribute_value_definition FOREIGN KEY (attribute_id) REFERENCES product_attribute_definition(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

CREATE TABLE product_option (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    parent_sku VARCHAR(64) NOT NULL,
    option_name VARCHAR(80) NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    UNIQUE KEY uk_product_option_name (parent_sku, option_name),
    CONSTRAINT fk_product_option_parent FOREIGN KEY (parent_sku) REFERENCES product(sku) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

CREATE TABLE product_variant (
    variant_sku VARCHAR(64) PRIMARY KEY,
    parent_sku VARCHAR(64) NOT NULL,
    option_values JSON NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_product_variant_parent_sku (parent_sku, variant_sku),
    CONSTRAINT fk_product_variant_child FOREIGN KEY (variant_sku) REFERENCES product(sku) ON DELETE CASCADE,
    CONSTRAINT fk_product_variant_parent FOREIGN KEY (parent_sku) REFERENCES product(sku) ON DELETE CASCADE,
    CONSTRAINT ck_product_variant_not_self CHECK (variant_sku <> parent_sku)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

CREATE TABLE product_price (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(64) NOT NULL,
    price_list VARCHAR(64) NOT NULL DEFAULT 'BASE',
    currency CHAR(3) NOT NULL,
    amount_minor BIGINT NOT NULL,
    compare_at_minor BIGINT NULL,
    starts_at TIMESTAMP(6) NULL,
    ends_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    KEY ix_product_price_lookup (sku, currency, price_list, starts_at, ends_at),
    CONSTRAINT fk_product_price_product FOREIGN KEY (sku) REFERENCES product(sku) ON DELETE CASCADE,
    CONSTRAINT ck_product_price_amount CHECK (amount_minor > 0 AND (compare_at_minor IS NULL OR compare_at_minor >= amount_minor)),
    CONSTRAINT ck_product_price_window CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

CREATE TABLE product_review (
    id CHAR(36) PRIMARY KEY,
    sku VARCHAR(64) NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    order_id VARCHAR(36) NULL,
    rating TINYINT NOT NULL,
    title VARCHAR(180) NULL,
    body TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_review_user_order (sku, user_id, order_id),
    KEY ix_product_review_public (sku, status, created_at),
    CONSTRAINT fk_product_review_product FOREIGN KEY (sku) REFERENCES product(sku),
    CONSTRAINT ck_product_review_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT ck_product_review_status CHECK (status IN ('PENDING','PUBLISHED','REJECTED','REMOVED'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

CREATE TABLE wishlist (
    id CHAR(36) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    name VARCHAR(100) NOT NULL DEFAULT 'Saved items',
    visibility VARCHAR(16) NOT NULL DEFAULT 'PRIVATE',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    KEY ix_wishlist_owner (user_id, created_at),
    CONSTRAINT ck_wishlist_visibility CHECK (visibility IN ('PRIVATE','SHARED'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

CREATE TABLE wishlist_item (
    wishlist_id CHAR(36) NOT NULL,
    sku VARCHAR(64) NOT NULL,
    added_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (wishlist_id, sku),
    CONSTRAINT fk_wishlist_item_wishlist FOREIGN KEY (wishlist_id) REFERENCES wishlist(id) ON DELETE CASCADE,
    CONSTRAINT fk_wishlist_item_product FOREIGN KEY (sku) REFERENCES product(sku)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

CREATE TABLE tax_class (
    code VARCHAR(64) PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    description VARCHAR(500) NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

ALTER TABLE product
    ADD CONSTRAINT fk_product_tax_class FOREIGN KEY (tax_class_code) REFERENCES tax_class(code);

CREATE TABLE tax_jurisdiction (
    id CHAR(36) PRIMARY KEY,
    authority_code VARCHAR(32) NOT NULL,
    country_code CHAR(2) NOT NULL,
    region_code VARCHAR(80) NOT NULL DEFAULT '',
    registration_number VARCHAR(100) NULL,
    display_name VARCHAR(160) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_tax_jurisdiction_authority (authority_code, country_code, region_code),
    KEY ix_tax_jurisdiction_enabled (enabled, country_code, region_code)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

CREATE TABLE tax_rate (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    tax_class_code VARCHAR(64) NOT NULL,
    jurisdiction_id CHAR(36) NOT NULL,
    rate_basis_points INT NOT NULL,
    prices_include_tax BOOLEAN NOT NULL DEFAULT FALSE,
    is_compound BOOLEAN NOT NULL DEFAULT FALSE,
    valid_from TIMESTAMP(6) NOT NULL,
    valid_until TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    KEY ix_tax_rate_current (tax_class_code, jurisdiction_id, valid_from, valid_until),
    CONSTRAINT fk_tax_rate_class FOREIGN KEY (tax_class_code) REFERENCES tax_class(code),
    CONSTRAINT fk_tax_rate_jurisdiction FOREIGN KEY (jurisdiction_id) REFERENCES tax_jurisdiction(id),
    CONSTRAINT ck_tax_rate_basis_points CHECK (rate_basis_points >= 0),
    CONSTRAINT ck_tax_rate_window CHECK (valid_until IS NULL OR valid_until > valid_from)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;
