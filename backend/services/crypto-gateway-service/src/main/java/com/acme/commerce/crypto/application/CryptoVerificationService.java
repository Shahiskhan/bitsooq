package com.acme.commerce.crypto.application;

import java.math.BigInteger;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestClient;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Contract-free on-chain verification: fetch the transaction receipt from a
 * public RPC,
 * confirm status, recipient wallet and transferred value, then emit
 * PaymentAuthorized.
 * Zero custom Solidity: transfers are plain native or standard ERC-20
 * transfers.
 */
@Service
public class CryptoVerificationService {
    public record Result(String status, String reason, String txHash, String network) {
    }

    private static final String USDT_ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    private static final Map<String, Integer> CHAIN_IDS = Map.of("ethereum-sepolia", 11155111, "polygon-amoy", 80002);
    private final JdbcTemplate db;
    private final TransactionTemplate tx;
    private final ObjectMapper json;
    private final RestClient rpc;
    private final String merchantWallet;
    private final boolean betaEnabled;

    public CryptoVerificationService(JdbcTemplate db, TransactionTemplate tx, ObjectMapper json,
            RestClient.Builder builder,
            @Value("${crypto.rpc-url}") String rpcUrl,
            @Value("${crypto.merchant-wallet}") String merchantWallet,
            @Value("${crypto.beta-enabled:false}") boolean betaEnabled) {
        this.db = db;
        this.tx = tx;
        this.json = json;
        this.rpc = builder.baseUrl(rpcUrl).build();
        this.merchantWallet = merchantWallet.toLowerCase();
        this.betaEnabled = betaEnabled;
    }

    public Result verify(String userId, com.acme.commerce.crypto.api.CryptoController.VerifyRequest request) {
        if (!betaEnabled)
            return record(userId, request, "REJECTED", "Crypto payments are not enabled yet (v2.0 beta)");
        JsonNode receipt = rpcCall("eth_getTransactionByHash", java.util.List.of(request.txHash()));
        JsonNode receiptStatus = rpcCall("eth_getTransactionReceipt", java.util.List.of(request.txHash()));
        if (receipt == null || receipt.isNull())
            return record(userId, request, "REJECTED", "Unknown transaction");
        if (!"0x1".equals(receiptStatus.path("status").asText()))
            return record(userId, request, "REJECTED", "Transaction not confirmed");
        String to = receipt.path("to").asText("").toLowerCase();
        String data = receipt.path("input").asText("");
        boolean erc20 = data.startsWith("0xa9059cbb"); // standard ERC-20 transfer(address,uint256)
        BigInteger transferred;
        if (erc20) {
            transferred = new BigInteger(data.substring(2 + 64), 16);
        } else {
            transferred = new BigInteger(receipt.path("value").asText("0x0").substring(2), 16);
        }
        if (!to.equals(merchantWallet))
            return record(userId, request, "REJECTED", "Recipient does not match the merchant wallet");
        if (transferred.signum() <= 0 || transferred.compareTo(BigInteger.valueOf(request.expectedAmountMinor())) != 0)
            return record(userId, request, "REJECTED", "Transferred value does not match the order amount");
        settle(userId, request);
        return record(userId, request, "PAID", null);
    }

    private void settle(String userId, com.acme.commerce.crypto.api.CryptoController.VerifyRequest request) {
        tx.executeWithoutResult(status -> {
            db.update(
                    "INSERT INTO crypto_verification(id,order_id,user_id,tx_hash,network,expected_amount_minor,currency,status,checked_at) "
                            +
                            "VALUES(?,?,?,?,?,?,?,'PAID',?) ON DUPLICATE KEY UPDATE status=VALUES(status),checked_at=VALUES(checked_at)",
                    UUID.randomUUID().toString(), request.orderId(), userId, request.txHash(), request.network(),
                    request.expectedAmountMinor(), "USD", Timestamp.from(Instant.now()));
            db.update("INSERT INTO outbox(event_id,aggregate_id,payload,created_at) VALUES(?,?,?,?)",
                    UUID.randomUUID().toString(), request.orderId(),
                    json.writeValueAsString(
                            Map.of("eventId", UUID.randomUUID().toString(), "eventType", "PaymentAuthorized",
                                    "aggregateId", request.orderId(), "occurredAt", Instant.now().toString(),
                                    "payload",
                                    Map.of("orderId", request.orderId(), "userId", userId, "totalMinor",
                                            request.expectedAmountMinor(),
                                            "currency", "USD",
                                            "paymentMethod", "CRYPTO_USDT_ETH", "txHash", request.txHash()))),
                    Timestamp.from(Instant.now()));
        });
    }

    private Result record(String userId, com.acme.commerce.crypto.api.CryptoController.VerifyRequest request,
            String status,
            String reason) {
        tx.executeWithoutResult(state -> db.update(
                "INSERT INTO crypto_verification(id,order_id,user_id,tx_hash,network,expected_amount_minor,currency,status,reason,checked_at) "
                        +
                        "VALUES(?,?,?,?,?,?,?,COALESCE((SELECT status FROM crypto_verification WHERE network=? AND tx_hash=?),'?'),?,?) ON DUPLICATE KEY UPDATE checked_at=VALUES(checked_at)",
                UUID.randomUUID().toString(), request.orderId(), userId, request.txHash(), request.network(),
                request.expectedAmountMinor(), "USD", request.network(), request.txHash(), status, reason,
                Timestamp.from(Instant.now())));
        return new Result(status, reason, request.txHash(), request.network());
    }

    private JsonNode rpcCall(String method, java.util.List<Object> params) {
        var response = rpc.post().contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .body(Map.of("jsonrpc", "2.0", "id", 1, "method", method, "params", params))
                .retrieve().body(JsonNode.class);
        return response == null ? null : response.path("result");
    }
}
