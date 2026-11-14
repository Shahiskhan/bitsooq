package com.bitsooq.moyasar;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Thin client for the Moyasar REST API using HTTP Basic auth with the secret
 * key.
 */
@Component
public class MoyasarClient {
    private final RestClient http;
    private final ObjectMapper json;

    public MoyasarClient(RestClient.Builder builder,
            @Value("${bitsooq.moyasar.base-url}") String baseUrl,
            @Value("${bitsooq.moyasar.secret-key}") String secretKey,
            ObjectMapper json) {
        if (secretKey == null || secretKey.isBlank())
            throw new IllegalStateException("MOYASAR_SECRET_KEY is required for Moyasar payments");
        String credentials = Base64.getEncoder().encodeToString((secretKey + ":").getBytes(StandardCharsets.UTF_8));
        this.http = builder.baseUrl(baseUrl)
                .defaultHeader("Authorization", "Basic " + credentials)
                .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .build();
        this.json = json;
    }

    /**
     * Creates a payment at Moyasar and returns the raw provider response (source,
     * id, status, url).
     */
    public JsonNode createPayment(String amountHalalas, String currency, String description,
            String callbackUrl, JsonNode source) {
        var body = json.createObjectNode()
                .put("amount", amountHalalas)
                .put("currency", currency)
                .put("description", description)
                .put("callback_url", callbackUrl);
        body.set("source", source);
        return http.post().uri("/payments").body(body).retrieve().body(JsonNode.class);
    }

    /** Authoritative fetch of a payment; used before trusting webhook status. */
    public JsonNode fetchPayment(String moyasarPaymentId) {
        return http.get().uri("/payments/{id}", moyasarPaymentId).retrieve().body(JsonNode.class);
    }
}
