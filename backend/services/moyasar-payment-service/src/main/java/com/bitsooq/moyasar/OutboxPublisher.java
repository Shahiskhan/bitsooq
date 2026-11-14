package com.bitsooq.moyasar;

import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Drains the transactional outbox to Kafka; delivery is at-least-once,
 * consumers dedupe by eventId.
 */
@Component
public class OutboxPublisher {
    private final PaymentIntents intents;
    private final KafkaTemplate<String, String> kafka;

    public OutboxPublisher(PaymentIntents intents, KafkaTemplate<String, String> kafka) {
        this.intents = intents;
        this.kafka = kafka;
    }

    @Scheduled(fixedDelay = 500)
    public void drain() {
        intents.publishPending(body -> kafka.send("commerce.saga.v1", "moyasar", body));
    }
}
