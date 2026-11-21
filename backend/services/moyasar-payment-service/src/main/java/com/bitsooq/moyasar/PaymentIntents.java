package com.bitsooq.moyasar;

import java.sql.Timestamp;
import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.client.RestClient;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

@Service
public class PaymentIntents {
    public record InitiateRequest(@NotBlank @Pattern(regexp = "[0-9a-fA-F-]{36}") String orderId,
            @PositiveOrZero long amountHalalas,
            @NotBlank @Pattern(regexp = "SAR|USD") String currency,
            @NotBlank @Size(max = 500) String callbackUrl,
            @NotBlank @Pattern(regexp = "(creditcard|mada|applepay)") String source,
            @NotBlank @Pattern(regexp = "[A-Za-z0-9._:-]{1,128}") String idempotencyKey) {
    }

    private final JdbcTemplate db;
    private final TransactionTemplate tx;
    private final MoyasarClient moyasar;
    private final ObjectMapper json;
    private final RestClient orderService;
    private final byte[] internalSecret;

    public PaymentIntents(JdbcTemplate db, TransactionTemplate tx, MoyasarClient moyasar, ObjectMapper json,
            RestClient.Builder builder,
            @org.springframework.beans.factory.annotation.Value("${commerce.internal-secret}") String internalSecret,
            @org.springframework.beans.factory.annotation.Value("${commerce.order-service-url:http://order-service:8083}") String orderServiceUrl) {
        this.db = db;
        this.tx = tx;
        this.moyasar = moyasar;
        this.json = json;
        this.orderService = builder.baseUrl(orderServiceUrl).build();
        this.internalSecret = internalSecret.getBytes(StandardCharsets.UTF_8);
        if (this.internalSecret.length < 32) throw new IllegalStateException("Internal context key must be at least 32 bytes");
    }

    /**
     * Creates (or returns, idempotently) a Moyasar payment for an order, then
     * persists provider state.
     */
    public JsonNode initiate(String userId, InitiateRequest request) {
        JsonNode order = fetchOwnedOrder(userId, request.orderId());
        long amount = order.path("totalMinor").asLong(-1);
        String currency = order.path("currency").asText("");
        if (amount <= 0 || currency.isBlank())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Order is not ready for payment");
        if (request.amountHalalas() != amount || !request.currency().equals(currency))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Payment amount or currency does not match the order");
        var existing = db.queryForList(
                "SELECT order_id,amount_minor,currency,moyasar_payment_id,status FROM moyasar_payment WHERE user_id=? AND idempotency_key=?",
                userId, request.idempotencyKey());
        if (!existing.isEmpty()) {
            var row = existing.getFirst();
            if (!request.orderId().equals(row.get("order_id").toString())
                    || ((Number) row.get("amount_minor")).longValue() != amount
                    || !currency.equals(row.get("currency")))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Idempotency-Key was used for a different payment");
            String providerId = (String) row.get("moyasar_payment_id");
            if (providerId == null)
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Payment initiation is still being completed; retry shortly");
            return paymentResponse(request.orderId(), providerId, (String) row.get("status"), moyasar.fetchPayment(providerId));
        }
        var source = json.createObjectNode().put("type", request.source());
        JsonNode created = moyasar.createPayment(Long.toString(amount), currency,
                "BitSooq order " + request.orderId(), request.callbackUrl(), source, request.idempotencyKey());
        String moyasarId = created.path("id").asText(null);
        if (moyasarId == null)
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Moyasar did not return a payment id");
        return tx.execute(status -> {
            db.update(
                    """
                            INSERT INTO moyasar_payment(id,order_id,user_id,amount_minor,currency,status,moyasar_payment_id,callback_url,idempotency_key)
                            VALUES(?,?,?,?,?,?,?,?,?)
                            ON DUPLICATE KEY UPDATE moyasar_payment_id=VALUES(moyasar_payment_id),updated_at=?
                            """,
                    UUID.randomUUID().toString(), request.orderId(), userId, request.amountHalalas(),
                    request.currency(),
                    created.path("status").asText("initiated"), moyasarId, request.callbackUrl(),
                    request.idempotencyKey(),
                    Timestamp.from(Instant.now()));
            return paymentResponse(request.orderId(), moyasarId, created.path("status").asText("initiated"), created);
        });
    }

    private JsonNode paymentResponse(String orderId, String paymentId, String status, JsonNode provider) {
        return json.createObjectNode()
                .put("orderId", orderId)
                .put("paymentId", paymentId)
                .put("status", status)
                .put("redirectUrl", provider.path("source").path("transaction_url").asText(null))
                .<ObjectNode>set("provider", provider);
    }

    private JsonNode fetchOwnedOrder(String userId, String orderId) {
        String path = "/api/orders/" + orderId;
        String timestamp = Long.toString(Instant.now().getEpochSecond());
        String requestId = UUID.randomUUID().toString();
        String roles = "USER";
        String canonical = String.join("\n", "GET", path, userId, roles, timestamp, requestId);
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(internalSecret, "HmacSHA256"));
            String signature = Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(mac.doFinal(canonical.getBytes(StandardCharsets.UTF_8)));
            JsonNode order = orderService.get().uri(path)
                    .header("X-Internal-User-Id", userId)
                    .header("X-Internal-Roles", roles)
                    .header("X-Internal-Timestamp", timestamp)
                    .header("X-Internal-Request-Id", requestId)
                    .header("X-Internal-Signature", signature)
                    .retrieve().body(JsonNode.class);
            if (order == null) throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Order service returned no data");
            return order;
        } catch (ResponseStatusException failure) {
            throw failure;
        } catch (Exception failure) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Unable to verify order with order service", failure);
        }
    }

    /**
     * Confirms a webhook/verified payment locally exactly once and emits
     * PaymentAuthorized on the saga topic.
     */
    public void confirmPaid(String moyasarPaymentId, long amount, String currency) {
        tx.executeWithoutResult(status -> {
            var rows = db.queryForList(
                    "SELECT id,order_id,user_id,amount_minor,currency,status FROM moyasar_payment WHERE moyasar_payment_id=? FOR UPDATE",
                    moyasarPaymentId);
            if (rows.isEmpty())
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown Moyasar payment");
            var row = rows.getFirst();
            if (((Number) row.get("amount_minor")).longValue() != amount || !currency.equals(row.get("currency")))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Moyasar payment does not match local intent");
            String local = (String) row.get("id");
            if (db.update("UPDATE moyasar_payment SET status='paid' WHERE id=? AND status<>'paid'", local) == 0)
                return; // duplicate
            var event = SagaEvent.create("PaymentAuthorized", (String) row.get("order_id"),
                    Map.of("orderId", row.get("order_id"), "userId", row.get("user_id"),
                            "totalMinor", amount, "currency", currency,
                            "paymentMethod", "MOYASAR", "paymentReferenceId", moyasarPaymentId));
            db.update("INSERT INTO outbox(event_id,aggregate_id,payload,created_at) VALUES(?,?,?,?)",
                    event.eventId(), event.aggregateId(), json.writeValueAsString(event),
                    Timestamp.from(Instant.now()));
        });
    }

    /**
     * Publisher drains the transactional outbox to Kafka (at-least-once; consumers
     * dedupe by eventId).
     */
    public int publishPending(java.util.function.Consumer<String> sender) {
        record Pending(String eventId, String payload) {
        }
        var pending = db.query(
                "SELECT event_id,payload FROM outbox WHERE published_at IS NULL ORDER BY created_at LIMIT 100",
                (rs, n) -> new Pending(rs.getString(1), rs.getString(2)));
        for (var row : pending ) {
            sender.accept(row.payload());
            db.update("UPDATE outbox SET published_at=? WHERE event_id=?", Timestamp.from(Instant.now()),
                    row.eventId());
        }
        return pending.size();
    }
}
