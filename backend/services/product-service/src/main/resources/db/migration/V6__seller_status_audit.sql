ALTER TABLE seller
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0;

CREATE TABLE seller_status_history (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    seller_id CHAR(36) NOT NULL,
    actor_user_id VARCHAR(128) NOT NULL,
    previous_status VARCHAR(24) NULL,
    new_status VARCHAR(24) NOT NULL,
    reason_code VARCHAR(64) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    KEY ix_seller_history_timeline (seller_id, created_at),
    KEY ix_seller_history_actor (actor_user_id, created_at),
    CONSTRAINT fk_seller_history_seller FOREIGN KEY (seller_id) REFERENCES seller(id),
    CONSTRAINT ck_seller_history_previous CHECK (previous_status IS NULL OR previous_status IN ('PENDING','ACTIVE','SUSPENDED','CLOSED')),
    CONSTRAINT ck_seller_history_next CHECK (new_status IN ('PENDING','ACTIVE','SUSPENDED','CLOSED'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;
