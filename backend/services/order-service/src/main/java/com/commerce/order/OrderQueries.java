package com.commerce.order;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
@Service
public class OrderQueries {
    public record Summary(String orderId,String userId,String status,Long totalMinor,String currency,Instant createdAt){}
    public record Page(List<Summary> items,String nextCursor){}
    public record Detail(String orderId,String userId,String status,Long totalMinor,String currency,Instant createdAt,
                         String paymentMethod,String paymentStatus,String paymentReferenceId,Long subtotalMinor,Long shippingMinor,
                         String shippingMethodCode,OrderService.DeliveryAddress shippingAddress,OrderService.ShipmentView shipment,
                         List<OrderService.Item> items){}
    public record DailyMetric(String date,long orders,long confirmedRevenueMinor){}
    public record StatusMetric(String status,long count){}
    public record PaymentMetric(String method,String paymentStatus,long orders,long amountMinor){}
    public record Analytics(long totalOrders,long pendingOrders,long reservedOrders,long confirmedOrders,long cancelledOrders,
                            long confirmedRevenueMinor,String currency,List<DailyMetric> daily,List<StatusMetric> statuses,List<PaymentMetric> payments){}
    private final JdbcTemplate db;
    public OrderQueries(JdbcTemplate db){this.db=db;}
    public Page list(String user,String after,int size,String status){
        var clauses=new ArrayList<String>();var args=new ArrayList<Object>();
        if(user!=null){clauses.add("user_id=?");args.add(user);}
        if(status!=null && !status.isBlank()){
            if(!Set.of("PENDING","RESERVED","CONFIRMED","CANCELLED").contains(status))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid order status");
            clauses.add("status=?");args.add(status);
        }
        if(after!=null && !after.isBlank()){
            try{
                String cursor=new String(Base64.getUrlDecoder().decode(after),StandardCharsets.UTF_8);
                int split=cursor.indexOf('|');Instant created=Instant.parse(cursor.substring(0,split));String id=cursor.substring(split+1);UUID.fromString(id);
                clauses.add("(created_at<? OR (created_at=? AND id<?))");args.add(Timestamp.from(created));args.add(Timestamp.from(created));args.add(id);
            }catch(Exception malformed){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid order cursor");}
        }
        String where=clauses.isEmpty()?"":" WHERE "+String.join(" AND ",clauses);
        args.add(size+1);
        var rows=db.query("SELECT id,user_id,status,total_minor,currency,created_at FROM orders"+where+" ORDER BY created_at DESC,id DESC LIMIT ?",(rs,n)->new Summary(rs.getString(1),rs.getString(2),rs.getString(3),(Long)rs.getObject(4),rs.getString(5),rs.getTimestamp(6).toInstant()),args.toArray());
        boolean more=rows.size()>size;List<Summary> items=rows.stream().limit(size).toList();
        String cursor=more?Base64.getUrlEncoder().withoutPadding().encodeToString((items.getLast().createdAt()+"|"+items.getLast().orderId()).getBytes(StandardCharsets.UTF_8)):null;
        return new Page(items,cursor);
    }
    public Detail detail(String id){
        var rows=db.query("SELECT id,user_id,status,total_minor,currency,created_at,payment_method,payment_status,payment_reference_id,subtotal_minor,shipping_minor,shipping_method_code FROM orders WHERE id=?",
                (rs,n)->new Detail(rs.getString(1),rs.getString(2),rs.getString(3),(Long)rs.getObject(4),rs.getString(5),rs.getTimestamp(6).toInstant(),rs.getString(7),rs.getString(8),rs.getString(9),(Long)rs.getObject(10),(Long)rs.getObject(11),rs.getString(12),null,null,List.of()),id);
        if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Order not found");
        var order=rows.getFirst();var items=db.query("SELECT sku,quantity FROM order_items WHERE order_id=? ORDER BY sku",(rs,n)->new OrderService.Item(rs.getString(1),rs.getInt(2)),id);
        var address=db.query("SELECT recipient_name,phone,address_line1,address_line2,area,city,region_code,postal_code,country_code,delivery_instructions,latitude,longitude,location_accuracy_m FROM order_address WHERE order_id=? AND address_type='SHIP_TO'",
                (rs,n)->new OrderService.DeliveryAddress(rs.getString(1),rs.getString(2),rs.getString(3),rs.getString(4),rs.getString(5),rs.getString(6),rs.getString(7),rs.getString(8),rs.getString(9),rs.getString(10),rs.getBigDecimal(11)==null?null:rs.getBigDecimal(11).doubleValue(),rs.getBigDecimal(12)==null?null:rs.getBigDecimal(12).doubleValue(),rs.getObject(13)==null?null:((Number)rs.getObject(13)).intValue()),id).stream().findFirst().orElse(null);
        var shipment=db.query("SELECT id,status,carrier_code,tracking_number,tracking_url,estimated_delivery_at,delivered_at FROM shipment WHERE order_id=? ORDER BY created_at DESC LIMIT 1",
                (rs,n)->new OrderService.ShipmentView(rs.getString(1),rs.getString(2),rs.getString(3),rs.getString(4),rs.getString(5),rs.getTimestamp(6)==null?null:rs.getTimestamp(6).toInstant(),rs.getTimestamp(7)==null?null:rs.getTimestamp(7).toInstant(),List.of()),id).stream().findFirst().orElse(null);
        if(shipment!=null){var events=db.query("SELECT event_code,description,location,occurred_at FROM shipment_event WHERE shipment_id=? ORDER BY occurred_at,event_code",(rs,n)->new OrderService.ShipmentEventView(rs.getString(1),rs.getString(2),rs.getString(3),rs.getTimestamp(4).toInstant()),shipment.id());shipment=new OrderService.ShipmentView(shipment.id(),shipment.status(),shipment.carrierCode(),shipment.trackingNumber(),shipment.trackingUrl(),shipment.estimatedDeliveryAt(),shipment.deliveredAt(),events);}
        return new Detail(order.orderId(),order.userId(),order.status(),order.totalMinor(),order.currency(),order.createdAt(),order.paymentMethod(),order.paymentStatus(),order.paymentReferenceId(),order.subtotalMinor(),order.shippingMinor(),order.shippingMethodCode(),address,shipment,items);
    }
    public Analytics analytics(){
        var rows=db.queryForList("SELECT status,COUNT(*) AS count,COALESCE(SUM(total_minor),0) AS revenue FROM orders GROUP BY status");
        var counts=new HashMap<String,Long>();long total=0,revenue=0;
        for(var row:rows){String state=row.get("status").toString();long count=((Number)row.get("count")).longValue();counts.put(state,count);total=Math.addExact(total,count);if(state.equals("CONFIRMED"))revenue=((Number)row.get("revenue")).longValue();}
        var daily=db.query("SELECT DATE(created_at) AS metric_day,COUNT(*) AS orders,COALESCE(SUM(CASE WHEN status='CONFIRMED' THEN total_minor ELSE 0 END),0) AS revenue FROM orders WHERE created_at >= CURRENT_DATE - INTERVAL 13 DAY GROUP BY DATE(created_at) ORDER BY metric_day",
                (rs,n)->new DailyMetric(rs.getDate(1).toLocalDate().toString(),rs.getLong(2),rs.getLong(3)));
        var statuses=rows.stream().map(row->new StatusMetric(row.get("status").toString(),((Number)row.get("count")).longValue())).toList();
        var payments=db.query("SELECT COALESCE(payment_method,'UNSPECIFIED') AS method,COALESCE(payment_status,'PENDING') AS payment_status,COUNT(*) AS orders,COALESCE(SUM(total_minor),0) AS amount FROM orders GROUP BY COALESCE(payment_method,'UNSPECIFIED'),COALESCE(payment_status,'PENDING') ORDER BY orders DESC",
                (rs,n)->new PaymentMetric(rs.getString(1),rs.getString(2),rs.getLong(3),rs.getLong(4)));
        return new Analytics(total,counts.getOrDefault("PENDING",0L),counts.getOrDefault("RESERVED",0L),counts.getOrDefault("CONFIRMED",0L),counts.getOrDefault("CANCELLED",0L),revenue,"USD",daily,statuses,payments);
    }
}
