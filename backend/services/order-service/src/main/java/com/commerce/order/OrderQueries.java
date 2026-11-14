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
    public record Detail(String orderId,String userId,String status,Long totalMinor,String currency,Instant createdAt,List<OrderService.Item> items){}
    public record Analytics(long totalOrders,long pendingOrders,long reservedOrders,long confirmedOrders,long cancelledOrders,long confirmedRevenueMinor,String currency){}
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
        var rows=db.query("SELECT id,user_id,status,total_minor,currency,created_at FROM orders WHERE id=?",(rs,n)->new Summary(rs.getString(1),rs.getString(2),rs.getString(3),(Long)rs.getObject(4),rs.getString(5),rs.getTimestamp(6).toInstant()),id);
        if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Order not found");
        var order=rows.getFirst();var items=db.query("SELECT sku,quantity FROM order_items WHERE order_id=? ORDER BY sku",(rs,n)->new OrderService.Item(rs.getString(1),rs.getInt(2)),id);
        return new Detail(order.orderId(),order.userId(),order.status(),order.totalMinor(),order.currency(),order.createdAt(),items);
    }
    public Analytics analytics(){
        var rows=db.queryForList("SELECT status,COUNT(*) AS count,COALESCE(SUM(total_minor),0) AS revenue FROM orders GROUP BY status");
        var counts=new HashMap<String,Long>();long total=0,revenue=0;
        for(var row:rows){String state=row.get("status").toString();long count=((Number)row.get("count")).longValue();counts.put(state,count);total=Math.addExact(total,count);if(state.equals("CONFIRMED"))revenue=((Number)row.get("revenue")).longValue();}
        return new Analytics(total,counts.getOrDefault("PENDING",0L),counts.getOrDefault("RESERVED",0L),counts.getOrDefault("CONFIRMED",0L),counts.getOrDefault("CANCELLED",0L),revenue,"USD");
    }
}
