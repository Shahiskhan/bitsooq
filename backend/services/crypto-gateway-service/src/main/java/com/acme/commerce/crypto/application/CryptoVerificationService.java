package com.acme.commerce.crypto.application;

import java.math.BigInteger;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
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
    private static final Map<String, String> CHAIN_IDS = Map.of("ethereum-sepolia", "0xaa36a7", "polygon-amoy", "0x13882");
    private static final Set<String> NATIVE_NETWORKS = Set.of("ethereum-sepolia", "polygon-amoy");
    private static final Set<String> SUPPORTED_TOKEN_CONTRACTS = Set.of();
    private final JdbcTemplate db;
    private final TransactionTemplate tx;
    private final ObjectMapper json;
    private final RestClient rpc;
    private final String merchantWallet;
    private final Map<String, String> tokenContracts;
    private final boolean betaEnabled;

    public CryptoVerificationService(JdbcTemplate db, TransactionTemplate tx, ObjectMapper json,
            RestClient.Builder builder,
            @Value("${crypto.rpc-url}") String rpcUrl,
            @Value("${crypto.merchant-wallet}") String merchantWallet,
            @Value("${crypto.token-contracts:{}}") Map<String, String> tokenContracts,
            @Value("${crypto.beta-enabled:false}") boolean betaEnabled) {
        this.db = db;
        this.tx = tx;
        this.json = json;
        this.rpc = builder.baseUrl(rpcUrl).build();
        this.merchantWallet = merchantWallet.toLowerCase();
        this.tokenContracts = tokenContracts.entrySet().stream().collect(java.util.stream.Collectors.toUnmodifiableMap(
                Map.Entry::getKey, entry -> entry.getValue().toLowerCase()));
        this.betaEnabled = betaEnabled;
    }

    public Result verify(String userId, com.acme.commerce.crypto.api.CryptoController.VerifyRequest request) {
        if (!betaEnabled)
            return record(userId, request, "REJECTED", "Crypto payments are not enabled yet (v2.0 beta)");
        String expectedChain = CHAIN_IDS.get(request.network());
        if (expectedChain == null)
            return record(userId, request, "REJECTED", "Unsupported network");
        JsonNode chainId = rpcCall("eth_chainId", java.util.List.of());
        if (chainId == null || !expectedChain.equalsIgnoreCase(chainId.asText()))
            return record(userId, request, "REJECTED", "RPC chain does not match the selected network");
        JsonNode receipt = rpcCall("eth_getTransactionByHash", java.util.List.of(request.txHash()));
        JsonNode receiptStatus = rpcCall("eth_getTransactionReceipt", java.util.List.of(request.txHash()));
        if (receipt == null || receipt.isNull())
            return record(userId, request, "REJECTED", "Unknown transaction");
        if (receiptStatus == null || receiptStatus.isNull() || !"0x1".equals(receiptStatus.path("status").asText()))
            return record(userId, request, "REJECTED", "Transaction not confirmed");
        String txTo = receipt.path("to").asText("").toLowerCase();
        String data = receipt.path("input").asText("");
        BigInteger transferred;
        String sender = receipt.path("from").asText("").toLowerCase();
        if (data.startsWith("0xa9059cbb")) {
            String tokenContract = tokenContracts.get(request.network());
            if (tokenContract == null || !tokenContract.equals(txTo))
                return record(userId, request, "REJECTED", "Token contract is not configured or does not match");
            JsonNode logs = receiptStatus.path("logs");
            JsonNode matchingTransfer = null;
            for (JsonNode log : logs) {
                JsonNode topics = log.path("topics");
                if (tokenContract.equals(log.path("address").asText("").toLowerCase())
                        && USDT_ERC20_TRANSFER_TOPIC.equalsIgnoreCase(topics.path(0).asText())
                        && topics.path(1).asText().toLowerCase().endsWith(sender.substring(2))
                        && topics.path(2).asText().toLowerCase().endsWith(merchantWallet.substring(2))) {
                    matchingTransfer = log;
                    break;
                }
            }
            if (matchingTransfer == null)
                return record(userId, request, "REJECTED", "Matching token Transfer event not found");
            String logData = matchingTransfer.path("data").asText("");
            try { transferred = new BigInteger(logData.startsWith("0x") ? logData.substring(2) : logData, 16); }
            catch (RuntimeException malformed) { return record(userId, request, "REJECTED", "Malformed token Transfer event"); }
        } else {
            if (!NATIVE_NETWORKS.contains(request.network()) || !merchantWallet.equals(txTo))
                return record(userId, request, "REJECTED", "Recipient does not match the merchant wallet");
            try { transferred = new BigInteger(receipt.path("value").asText("0x0").replaceFirst("^0x", ""), 16); }
            catch (RuntimeException malformed) { return record(userId, request, "REJECTED", "Malformed native transfer value"); }
        }
        if (transferred.signum() <= 0 || transferred.compareTo(BigInteger.valueOf(request.expectedAmountMinor())) != 0)
            return record(userId, request, "REJECTED", "Transferred value does not match the order amount");
        if (!settle(userId, request))
            return record(userId, request, "REJECTED", "Transaction has already been processed");
        return record(userId, request, "PAID", null);
    }

    private boolean settle(String userId, com.acme.commerce.crypto.api.CryptoController.VerifyRequest request) {
        return Boolean.TRUE.equals(tx.execute(status -> {
            var existing = db.queryForList(
                    "SELECT order_id,user_id,status FROM crypto_verification WHERE network=? AND tx_hash=? FOR UPDATE",
                    request.network(), request.txHash());
            if (!existing.isEmpty()) return false;
            int inserted = db.update(
                    "INSERT IGNORE INTO crypto_verification(id,order_id,user_id,tx_hash,network,expected_amount_minor,currency,status,checked_at) "
                            +
                            "VALUES(?,?,?,?,?,?,?,'PAID',?)",
                    UUID.randomUUID().toString(), request.orderId(), userId, request.txHash(), request.network(),
                    request.expectedAmountMinor(), "USD", Timestamp.from(Instant.now()));
            if (inserted != 1) return false;
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
            return true;
        }));
    }

    private Result record(String userId, com.acme.commerce.crypto.api.CryptoController.VerifyRequest request,
            String status,
            String reason) {
        tx.executeWithoutResult(state -> db.update(
                "INSERT INTO crypto_verification(id,order_id,user_id,tx_hash,network,expected_amount_minor,currency,status,reason,checked_at) "
                        +
                        "VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE "
                        + "status=IF(status='PAID','PAID',VALUES(status)),reason=IF(status='PAID',reason,VALUES(reason)),checked_at=VALUES(checked_at)",
                UUID.randomUUID().toString(), request.orderId(), userId, request.txHash(), request.network(),
                request.expectedAmountMinor(), "USD", status, reason, Timestamp.from(Instant.now())));
        return new Result(status, reason, request.txHash(), request.network());
    }

    private JsonNode rpcCall(String method, java.util.List<Object> params) {
        var response = rpc.post().contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .body(Map.of("jsonrpc", "2.0", "id", 1, "method", method, "params", params))
                .retrieve().body(JsonNode.class);
        return response == null ? null : response.path("result");
    }
}
