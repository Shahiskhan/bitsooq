package com.bitsooq.moyasar;

import org.springframework.http.HttpStatus;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/payments/moyasar")
public class PaymentController {
    private final PaymentIntents intents;
    private final MoyasarClient moyasar;
    private final KafkaTemplate<String, String> kafka;
    private final TrustedContext context;

    public PaymentController(PaymentIntents intents, MoyasarClient moyasar, KafkaTemplate<String, String> kafka,
            TrustedContext context) {
        this.intents = intents;
        this.moyasar = moyasar;
        this.kafka = kafka;
        this.context = context;
    }

    /**
     * Starts (or idempotently returns) a Moyasar payment for an order owned by the
     * caller.
     */
    @PostMapping("/initiate")
    public JsonNode initiate(@Valid @RequestBody PaymentIntents.InitiateRequest request, HttpServletRequest servlet) {
        return intents.initiate(context.requireUserId(servlet), request);
    }

    /**
     * Moyasar webhook: verifies the reported payment with Moyasar before emitting
     * PaymentAuthorized.
     */
    @PostMapping("/webhook")
    @ResponseStatus(HttpStatus.OK)
    public void webhook(@RequestBody JsonNode event) {
        String id = event.path("data").path("id").asText(null);
        String status = event.path("data").path("status").asText(null);
        if (id == null || status == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Malformed webhook");
        if (!"paid".equalsIgnoreCase(status))
            return; // ignore non-terminal states
        JsonNode authoritative = moyasar.fetchPayment(id); // fetch authoritative state, never trust webhook alone
        if (!"paid".equalsIgnoreCase(authoritative.path("status").asText()))
            return;
        intents.confirmPaid(id, authoritative.path("amount").asLong(), authoritative.path("currency").asText());
    }
}
