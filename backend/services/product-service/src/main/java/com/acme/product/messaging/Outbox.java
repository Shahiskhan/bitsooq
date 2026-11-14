package com.acme.product.messaging;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/** Acknowledgement precedes marking. Crash gaps cause duplicates, handled by every consumer's inbox. */
@Component
public class Outbox {
    private static final Logger log = LoggerFactory.getLogger(Outbox.class);
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final KafkaTemplate<String, String> kafka;
    private final String topic;
    public Outbox(JdbcTemplate jdbc, ObjectMapper json, KafkaTemplate<String, String> kafka, @Value("${commerce.saga-topic}") String topic) {
        this.jdbc = jdbc; this.json = json; this.kafka = kafka; this.topic = topic;
    }
    public void append(String type, String orderId, Map<String, Object> payload) {
        if (!org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()) throw new IllegalStateException("Outbox requires a domain transaction");
        String eventId = UUID.randomUUID().toString();
        String envelope = json.writeValueAsString(Map.of("eventId", eventId, "eventType", type, "schemaVersion", 1,
                "aggregateId", orderId, "occurredAt", Instant.now().toString(), "payload", payload));
        jdbc.update("INSERT INTO outbox(event_id, aggregate_id, payload) VALUES(?,?,?)", eventId, orderId, envelope);
    }
    private record Pending(String eventId,String aggregateId,String payload) {}
    @Scheduled(fixedDelayString="${commerce.outbox-delay-ms:500}")
    @Transactional(timeout=25)
    public void publishOne() {
        long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(15);
        var rows=jdbc.query("SELECT event_id,aggregate_id,payload FROM outbox WHERE published_at IS NULL ORDER BY created_at,event_id LIMIT 25 FOR UPDATE SKIP LOCKED",(rs,n)->new Pending(rs.getString(1),rs.getString(2),rs.getString(3)));
        record Sending(String id,java.util.concurrent.CompletableFuture<org.springframework.kafka.support.SendResult<String,String>> future){}
        var sending=new java.util.ArrayList<Sending>();
        for(var row:rows){
            if(System.nanoTime()>=deadline)break;
            try{sending.add(new Sending(row.eventId(),kafka.send(topic,row.aggregateId(),row.payload())));}
            catch(Exception unavailable){log.warn("outbox_enqueue_pending eventId={} errorType={}",row.eventId(),unavailable.getClass().getSimpleName());break;}
        }
        for(var message:sending){
            long remaining=deadline-System.nanoTime();if(remaining<=0)break;
            try{message.future().get(remaining,TimeUnit.NANOSECONDS);jdbc.update("UPDATE outbox SET published_at=? WHERE event_id=?",Timestamp.from(Instant.now()),message.id());}
            catch(InterruptedException interrupted){Thread.currentThread().interrupt();log.warn("outbox_publish_interrupted eventId={}",message.id());break;}
            catch(Exception unavailable){log.warn("outbox_publish_pending eventId={} errorType={}",message.id(),unavailable.getClass().getSimpleName());}
        }
    }
}
