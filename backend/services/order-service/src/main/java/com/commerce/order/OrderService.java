package com.commerce.order;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.sql.Timestamp;
import java.util.*;

@Service
public class OrderService {
    public record Item(@NotBlank @Pattern(regexp="[A-Z0-9_-]{1,64}") String sku,
                       @Min(1) @Max(1000) int quantity) { }
    public record DeliveryAddress(@NotBlank @Size(max=160) String recipientName,
                                  @NotBlank @Pattern(regexp="[+0-9() .-]{7,32}") String phone,
                                  @NotBlank @Size(max=240) String addressLine1,
                                  @Size(max=240) String addressLine2,
                                  @Size(max=120) String area,
                                  @NotBlank @Size(max=120) String city,
                                  @NotBlank @Size(max=80) String regionCode,
                                  @Size(max=24) @Pattern(regexp="[A-Za-z0-9 -]*") String postalCode,
                                  @NotBlank @Pattern(regexp="[A-Z]{2}") String countryCode,
                                  @Size(max=500) String deliveryInstructions,
                                  @DecimalMin("-90.0") @DecimalMax("90.0") Double latitude,
                                  @DecimalMin("-180.0") @DecimalMax("180.0") Double longitude,
                                  @Min(1) @Max(100000) Integer locationAccuracyM) {
        DeliveryService.Destination destination() {
            if ((latitude == null) != (longitude == null))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Latitude and longitude must be provided together");
            return new DeliveryService.Destination(countryCode,regionCode,city,area,postalCode);
        }
    }
    public record PlaceOrder(@NotEmpty @Size(max=20) List<@NotNull @Valid Item> items,
                             @Valid DeliveryAddress shippingAddress,
                             @Pattern(regexp="[a-fA-F0-9-]{36}") String deliveryRateId,
                             @Pattern(regexp="MOYASAR|CRYPTO_USDT_ETH|CASH_ON_DELIVERY") String paymentMethod) {
        public PlaceOrder(List<Item> items) { this(items,null,null,"MOYASAR"); }
        public PlaceOrder { if (paymentMethod == null || paymentMethod.isBlank()) paymentMethod="MOYASAR"; }
    }
    public record ShipmentEventView(String eventCode,String description,String location,Instant occurredAt) { }
    public record ShipmentView(String id, String status, String carrierCode, String trackingNumber,
                               String trackingUrl, Instant estimatedDeliveryAt, Instant deliveredAt,List<ShipmentEventView> events) { }
    public record OrderView(String orderId, String status, Long totalMinor, String currency, String paymentMethod,
                            String paymentReferenceId, String txHash, Long subtotalMinor, Long shippingMinor,
                            String paymentStatus, String shippingMethodCode, DeliveryAddress shippingAddress,
                            ShipmentView shipment, List<Item> items) {
        public OrderView(String orderId,String status,Long totalMinor,String currency,String paymentMethod,
                         String paymentReferenceId,String txHash,List<Item> items) {
            this(orderId,status,totalMinor,currency,paymentMethod,paymentReferenceId,txHash,null,null,null,null,null,null,items);
        }
    }
    private final JdbcTemplate db;
    private final TransactionTemplate tx;
    private final ObjectMapper json;
    private final Duration lifetime;
    private final DeliveryService delivery;

    public OrderService(JdbcTemplate db, TransactionTemplate tx, ObjectMapper json,
                        @Value("${commerce.order-lifetime:PT15M}") Duration lifetime, DeliveryService delivery) {
        this.db = db; this.tx = tx; this.json = json; this.lifetime = lifetime; this.delivery=delivery;
    }

    public OrderView place(String userId, String key, PlaceOrder request) {
        if (key == null || !key.matches("[A-Za-z0-9._:-]{1,128}"))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A valid Idempotency-Key is required");
        List<Item> items = request.items().stream().sorted(Comparator.comparing(Item::sku)).toList();
        if (items.stream().map(Item::sku).distinct().count() != items.size())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Duplicate SKUs are not permitted");
        String method=request.paymentMethod();
        if (request.shippingAddress()!=null && request.deliveryRateId()==null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose a delivery option for this address");
        if (request.shippingAddress()==null && request.deliveryRateId()!=null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"A delivery address is required for the selected option");
        String fingerprint = hash(items.stream().map(item -> item.sku()+":"+item.quantity()).collect(java.util.stream.Collectors.joining("\n"))
                +"\nmethod="+method+"\nrate="+request.deliveryRateId()+"\naddress="+addressFingerprint(request.shippingAddress()));
        return tx.execute(status -> {
            String candidate = UUID.randomUUID().toString();
            Instant now = Instant.now(), expiry = now.plus(lifetime);
            db.update("INSERT INTO orders(id,user_id,idempotency_key,request_hash,status,created_at,expires_at) " +
                    "VALUES(?,?,?,?,'PENDING',?,?) ON DUPLICATE KEY UPDATE id=id",
                    candidate, userId, key, fingerprint, Timestamp.from(now), Timestamp.from(expiry));
            Map<String,Object> row = db.queryForMap("SELECT * FROM orders WHERE user_id=? AND idempotency_key=? FOR UPDATE", userId, key);
            if (!fingerprint.equals(row.get("request_hash")))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Idempotency-Key was used for a different request");
            String id = row.get("id").toString();
            if (candidate.equals(id)) {
                DeliveryService.Option selected=null;
                if(request.shippingAddress()!=null) {
                    selected=delivery.requireRate(request.deliveryRateId(),request.shippingAddress().destination(),"USD");
                    if("CASH_ON_DELIVERY".equals(method) && !selected.supportsCod())
                        throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"Cash on delivery is not available for this delivery option");
                } else if("CASH_ON_DELIVERY".equals(method)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Cash on delivery requires a delivery address");
                }
                long shipping=selected==null?0:selected.feeMinor();
                String serviceCode=selected==null?null:selected.methodCode();
                db.update("UPDATE orders SET payment_method=?,payment_status=?,delivery_rate_id=?,shipping_method_code=?,shipping_minor=? WHERE id=?",
                        method,"CASH_ON_DELIVERY".equals(method)?"COD_DUE":"PENDING",selected==null?null:selected.id(),serviceCode,shipping,id);
                if(request.shippingAddress()!=null) saveShippingAddress(id,request.shippingAddress());
                items.forEach(item -> db.update("INSERT INTO order_items(order_id,sku,quantity) VALUES(?,?,?)", id, item.sku(), item.quantity()));
                recordStatus(id,null,"PENDING","CUSTOMER",userId,"ORDER_PLACED",null,null);
                enqueue(SagaEvent.create("OrderPlaced", id, Map.of("orderId",id,"userId",userId,"items",items,"expiresAt",expiry.toString())));
            }
            return readOwned(id, userId);
        });
    }

    public OrderView readOwned(String id, String userId) {
        List<OrderView> rows = db.query("SELECT id,status,total_minor,currency,payment_method,payment_reference_id,tx_hash,subtotal_minor,shipping_minor,payment_status,shipping_method_code FROM orders WHERE id=? AND user_id=?",
                (rs, row) -> new OrderView(rs.getString(1),rs.getString(2),(Long)rs.getObject(3),rs.getString(4),rs.getString(5),rs.getString(6),rs.getString(7),
                        (Long)rs.getObject(8),(Long)rs.getObject(9),rs.getString(10),rs.getString(11),null,null,List.of()),id,userId);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
        OrderView order = rows.getFirst();
        List<Item> items = db.query("SELECT sku,quantity FROM order_items WHERE order_id=? ORDER BY sku",
                (rs,row)->new Item(rs.getString(1),rs.getInt(2)), id);
        DeliveryAddress address=db.query("SELECT recipient_name,phone,address_line1,address_line2,area,city,region_code,postal_code,country_code,delivery_instructions,latitude,longitude,location_accuracy_m FROM order_address WHERE order_id=? AND address_type='SHIP_TO'",
                (rs,n)->new DeliveryAddress(rs.getString(1),rs.getString(2),rs.getString(3),rs.getString(4),rs.getString(5),rs.getString(6),rs.getString(7),rs.getString(8),rs.getString(9),rs.getString(10),decimal(rs.getBigDecimal(11)),decimal(rs.getBigDecimal(12)),rs.getObject(13)==null?null:((Number)rs.getObject(13)).intValue()),id).stream().findFirst().orElse(null);
        ShipmentView shipment=db.query("SELECT id,status,carrier_code,tracking_number,tracking_url,estimated_delivery_at,delivered_at FROM shipment WHERE order_id=? ORDER BY created_at DESC LIMIT 1",
                (rs,n)->new ShipmentView(rs.getString(1),rs.getString(2),rs.getString(3),rs.getString(4),rs.getString(5),instant(rs.getTimestamp(6)),instant(rs.getTimestamp(7)),List.of()),id).stream().findFirst().orElse(null);
        if(shipment!=null) {
            List<ShipmentEventView> events=db.query("SELECT event_code,description,location,occurred_at FROM shipment_event WHERE shipment_id=? ORDER BY occurred_at,event_code",
                    (rs,n)->new ShipmentEventView(rs.getString(1),rs.getString(2),rs.getString(3),instant(rs.getTimestamp(4))),shipment.id());
            shipment=new ShipmentView(shipment.id(),shipment.status(),shipment.carrierCode(),shipment.trackingNumber(),shipment.trackingUrl(),shipment.estimatedDeliveryAt(),shipment.deliveredAt(),events);
        }
        return new OrderView(order.orderId(),order.status(),order.totalMinor(),order.currency(),order.paymentMethod(),order.paymentReferenceId(),order.txHash(),
                order.subtotalMinor(),order.shippingMinor(),order.paymentStatus(),order.shippingMethodCode(),address,shipment,items);
    }

    public void accept(JsonNode event) {
        String type = event.path("eventType").asText();
        if (!Set.of("InventoryReserved","InventoryRejected","PaymentAuthorized","PaymentFailed").contains(type)) return;
        tx.executeWithoutResult(status -> {
            if (db.update("INSERT IGNORE INTO inbox(event_id,received_at) VALUES(?,?)",event.required("eventId").asText(),Timestamp.from(Instant.now())) == 0) return;
            String id = event.required("aggregateId").asText();
            JsonNode payload = event.required("payload");
            Map<String,Object> row = db.queryForMap("SELECT * FROM orders WHERE id=? FOR UPDATE",id);
            if (!row.get("user_id").equals(payload.path("userId").asText())) throw new IllegalArgumentException("Event owner mismatch");
            String current = row.get("status").toString();
            if (Set.of("CONFIRMED","CANCELLED").contains(current)) return;
            switch (type) {
                case "InventoryReserved" -> {
                    long subtotal = amount(payload);
                    long shipping = ((Number)row.get("shipping_minor")).longValue();
                    long total = Math.addExact(subtotal,shipping);
                    if (current.equals("PENDING")) {
                        if("CASH_ON_DELIVERY".equals(row.get("payment_method"))) {
                            db.update("UPDATE orders SET status='CONFIRMED',subtotal_minor=?,total_minor=?,currency=?,payment_status='COD_DUE' WHERE id=?",subtotal,total,"USD",id);
                            createShipment(id);
                            recordStatus(id,"PENDING","CONFIRMED","SYSTEM",null,"COD_ORDER_ACCEPTED",event.required("eventId").asText(),"Cash on delivery selected");
                            enqueue(SagaEvent.create("OrderConfirmed",id,Map.of("orderId",id,"userId",row.get("user_id"))));
                        } else {
                            db.update("UPDATE orders SET status='RESERVED',subtotal_minor=?,total_minor=?,currency=?,payment_status='PENDING' WHERE id=?",subtotal,total,"USD",id);
                            recordStatus(id,"PENDING","RESERVED","SYSTEM",null,"INVENTORY_RESERVED",event.required("eventId").asText(),null);
                        }
                    } else if (row.get("subtotal_minor") == null || ((Number)row.get("subtotal_minor")).longValue() != subtotal)
                        throw new IllegalArgumentException("Reservation amount mismatch");
                }
                case "PaymentAuthorized" -> {
                    long total = amount(payload);
                    if (!current.equals("RESERVED") || ((Number)row.get("total_minor")).longValue() != total)
                        throw new IllegalStateException("Payment does not match reserved order");
                    String method = payload.path("paymentMethod").asText(null);
                    String reference = payload.path("paymentReferenceId").asText(null);
                    String txHash = payload.path("txHash").asText(null);
                    db.update("UPDATE orders SET status='CONFIRMED',payment_status='PAID',payment_method=?,payment_reference_id=?,tx_hash=? WHERE id=?",method,reference,txHash,id);
                    createShipment(id);
                    recordStatus(id,current,"CONFIRMED","PROVIDER",reference,"PAYMENT_AUTHORIZED",event.required("eventId").asText(),null);
                    enqueue(SagaEvent.create("OrderConfirmed",id,Map.of("orderId",id,"userId",row.get("user_id"))));
                }
                case "InventoryRejected", "PaymentFailed" -> {
                    db.update("UPDATE orders SET status='CANCELLED',payment_status='FAILED',cancelled_at=CURRENT_TIMESTAMP(6),cancellation_reason=? WHERE id=?",type,id);
                    recordStatus(id,current,"CANCELLED","SYSTEM",null,type,event.required("eventId").asText(),null);
                    enqueue(SagaEvent.create("OrderCancelled",id,Map.of("orderId",id,"userId",row.get("user_id"),"reason",type)));
                }
                default -> throw new IllegalArgumentException("Unsupported event");
            }
        });
    }

    private static long amount(JsonNode payload) {
        if (!payload.path("totalMinor").isIntegralNumber() || !payload.path("totalMinor").canConvertToLong()
                || payload.path("totalMinor").asLong() <= 0 || !"USD".equals(payload.path("currency").asText()))
            throw new IllegalArgumentException("Invalid authoritative money amount");
        return payload.path("totalMinor").asLong();
    }

    public void markCodCollected(String orderId,String staffId,long amount,String reference,String idempotencyKey) {
        if(idempotencyKey==null || !idempotencyKey.matches("[A-Za-z0-9._:-]{1,128}"))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"A valid Idempotency-Key is required");
        if(reference==null || !reference.matches("[A-Za-z0-9._:-]{1,120}"))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"A valid collection reference is required");
        tx.executeWithoutResult(status -> {
            Map<String,Object> order=db.queryForMap("SELECT * FROM orders WHERE id=? FOR UPDATE",orderId);
            String state=order.get("payment_status").toString();
            String paymentReference=order.get("payment_reference_id")==null?null:order.get("payment_reference_id").toString();
            String expectedReference="COD:"+reference;
            if("PAID".equals(state) && expectedReference.equals(paymentReference)) return;
            if(!"CASH_ON_DELIVERY".equals(order.get("payment_method")) || !"COD_DUE".equals(state))
                throw new ResponseStatusException(HttpStatus.CONFLICT,"This order is not awaiting cash collection");
            if(((Number)order.get("total_minor")).longValue()!=amount)
                throw new ResponseStatusException(HttpStatus.CONFLICT,"Collected amount does not match the order total");
            db.update("UPDATE orders SET payment_status='PAID',payment_reference_id=? WHERE id=?",expectedReference,orderId);
            recordStatus(orderId,"CONFIRMED","CONFIRMED","STAFF",staffId,"COD_CASH_COLLECTED",UUID.nameUUIDFromBytes((orderId+"\n"+idempotencyKey).getBytes(StandardCharsets.UTF_8)).toString(),"Cash received by courier or store");
        });
    }

    public void updateShipment(String shipmentId,String staffId,String nextStatus,String carrier,String trackingNumber,String trackingUrl,String description,String location) {
        tx.executeWithoutResult(status -> {
            Map<String,Object> shipment=db.queryForMap("SELECT id,order_id,status,carrier_code,tracking_number,tracking_url FROM shipment WHERE id=? FOR UPDATE",shipmentId);
            String current=shipment.get("status").toString();
            if(current.equals(nextStatus)) {
                db.update("UPDATE shipment SET carrier_code=COALESCE(?,carrier_code),tracking_number=COALESCE(?,tracking_number),tracking_url=COALESCE(?,tracking_url) WHERE id=?",carrier,trackingNumber,trackingUrl,shipmentId);
                if(description!=null || location!=null) db.update("INSERT INTO shipment_event(shipment_id,event_code,description,location,occurred_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP(6))",shipmentId,nextStatus,description,location);
                return;
            }
            if(!allowedShipmentTransition(current,nextStatus)) throw new ResponseStatusException(HttpStatus.CONFLICT,"Invalid shipment status transition");
            db.update("""
                    UPDATE shipment SET status=?,carrier_code=COALESCE(?,carrier_code),tracking_number=COALESCE(?,tracking_number),
                      tracking_url=COALESCE(?,tracking_url),shipped_at=IF(?='SHIPPED',CURRENT_TIMESTAMP(6),shipped_at),
                      delivered_at=IF(?='DELIVERED',CURRENT_TIMESTAMP(6),delivered_at) WHERE id=?
                    """,nextStatus,carrier,trackingNumber,trackingUrl,nextStatus,nextStatus,shipmentId);
            db.update("INSERT INTO shipment_event(shipment_id,event_code,description,location,occurred_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP(6))",shipmentId,nextStatus,description==null?"Status updated by staff "+staffId:description,location);
            String orderId=shipment.get("order_id").toString();
            String orderStatus=db.queryForObject("SELECT status FROM orders WHERE id=?",String.class,orderId);
            recordStatus(orderId,orderStatus,orderStatus,"STAFF",staffId,"SHIPMENT_"+nextStatus,null,"Shipment status updated");
        });
    }

    private void saveShippingAddress(String orderId,DeliveryAddress address) {
        db.update("""
                INSERT INTO order_address(order_id,address_type,recipient_name,phone,address_line1,address_line2,area,city,
                  region_code,postal_code,country_code,delivery_instructions,latitude,longitude,location_accuracy_m)
                VALUES(?,'SHIP_TO',?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,orderId,address.recipientName(),address.phone(),address.addressLine1(),address.addressLine2(),address.area(),address.city(),
                address.regionCode(),address.postalCode(),address.countryCode(),address.deliveryInstructions(),address.latitude(),address.longitude(),address.locationAccuracyM());
    }

    private void createShipment(String orderId) {
        Map<String,Object> order=db.queryForMap("SELECT shipping_method_code,delivery_rate_id,shipping_minor,currency FROM orders WHERE id=?",orderId);
        if(order.get("shipping_method_code")==null) return;
        int maxDays=2;
        if(order.get("delivery_rate_id")!=null) maxDays=db.queryForObject("SELECT max_delivery_days FROM delivery_rate WHERE id=?",Integer.class,order.get("delivery_rate_id"));
        String shipmentId=UUID.randomUUID().toString();
        String number="BS-"+orderId.replace("-","").substring(0,24).toUpperCase(Locale.ROOT);
        Instant eta=Instant.now().plus(Duration.ofDays(maxDays));
        db.update("""
                INSERT INTO shipment(id,order_id,shipment_number,service_code,status,shipping_minor,currency,estimated_delivery_at)
                VALUES(?,?,?,?,'PENDING',?,?,?)
                """,shipmentId,orderId,number,order.get("shipping_method_code"),order.get("shipping_minor"),order.get("currency"),Timestamp.from(eta));
        db.update("INSERT INTO shipment_item(shipment_id,order_id,sku,quantity) SELECT ?,order_id,sku,quantity FROM order_items WHERE order_id=?",shipmentId,orderId);
        db.update("INSERT INTO shipment_event(shipment_id,event_code,description,occurred_at) VALUES(?,'PENDING','Shipment created',CURRENT_TIMESTAMP(6))",shipmentId);
    }

    private void recordStatus(String orderId,String from,String to,String actorType,String actorId,String reason,String eventId,String note) {
        db.update("INSERT INTO order_status_history(order_id,from_status,to_status,actor_type,actor_id,reason_code,event_id,note) VALUES(?,?,?,?,?,?,?,?)",
                orderId,from,to,actorType,actorId,reason,eventId,note);
    }

    private static String addressFingerprint(DeliveryAddress address) {
        if(address==null) return "";
        return String.join("|",String.valueOf(address.recipientName()),String.valueOf(address.phone()),String.valueOf(address.addressLine1()),
                String.valueOf(address.addressLine2()),String.valueOf(address.area()),String.valueOf(address.city()),String.valueOf(address.regionCode()),
                String.valueOf(address.postalCode()),String.valueOf(address.countryCode()),String.valueOf(address.deliveryInstructions()),
                String.valueOf(address.latitude()),String.valueOf(address.longitude()),String.valueOf(address.locationAccuracyM()));
    }

    private static boolean allowedShipmentTransition(String from,String to) {
        return switch(from) {
            case "PENDING" -> Set.of("LABEL_CREATED","READY","CANCELLED").contains(to);
            case "LABEL_CREATED" -> Set.of("READY","CANCELLED").contains(to);
            case "READY" -> Set.of("SHIPPED","CANCELLED").contains(to);
            case "SHIPPED" -> Set.of("IN_TRANSIT","OUT_FOR_DELIVERY","DELIVERED","FAILED","RETURNED").contains(to);
            case "IN_TRANSIT" -> Set.of("OUT_FOR_DELIVERY","DELIVERED","FAILED","RETURNED").contains(to);
            case "OUT_FOR_DELIVERY" -> Set.of("DELIVERED","FAILED","RETURNED").contains(to);
            case "FAILED" -> Set.of("READY","RETURNED").contains(to);
            default -> false;
        };
    }
    private static Double decimal(java.math.BigDecimal value) { return value==null?null:value.doubleValue(); }
    private static Instant instant(Timestamp value) { return value==null?null:value.toInstant(); }
    private void enqueue(SagaEvent event) {
        db.update("INSERT INTO outbox(event_id,aggregate_id,body,created_at) VALUES(?,?,?,?)",
                event.eventId(),event.aggregateId(),json.writeValueAsString(event),Timestamp.from(Instant.now()));
    }
    private static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
}
