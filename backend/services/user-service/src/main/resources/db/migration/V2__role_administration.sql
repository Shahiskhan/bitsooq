CREATE TABLE role_target_lock (
    uid VARCHAR(128) PRIMARY KEY
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;
CREATE TABLE role_change_request (
    id VARCHAR(36) PRIMARY KEY,
    actor_uid VARCHAR(128) NOT NULL,
    target_uid VARCHAR(128) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    desired_roles VARCHAR(128) NOT NULL,
    previous_roles VARCHAR(128),
    state VARCHAR(16) NOT NULL,
    request_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    completed_at TIMESTAMP(6),
    CONSTRAINT role_change_key UNIQUE(actor_uid,idempotency_key),
    CONSTRAINT role_change_state CHECK (state IN ('PENDING','APPLIED','UNKNOWN'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;
CREATE INDEX role_change_target_created ON role_change_request(target_uid,created_at);
