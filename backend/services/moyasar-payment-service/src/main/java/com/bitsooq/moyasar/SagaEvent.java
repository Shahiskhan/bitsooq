package com.bitsooq.moyasar;

import java.util.Map;
import java.util.UUID;

import tools.jackson.databind.ObjectMapper;

/**
 * Shared saga event envelope. EventType names match commerce.saga.v1 contract.
 */
record SagaEvent(String eventId, String eventType, String aggregateId, Map<String, Object> payload) {
    static SagaEvent create(String eventType, String aggregateId, Map<String, Object> payload) {
        return new SagaEvent(UUID.randomUUID().toString(), eventType, aggregateId, payload);
    }

    String toJson(ObjectMapper json) {
        return json.writeValueAsString(this);
    }

}
