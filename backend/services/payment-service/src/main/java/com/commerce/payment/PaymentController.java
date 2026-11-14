package com.commerce.payment;
import java.time.Instant;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
@RestController @RequestMapping("/api/payments/orders")
public class PaymentController {
    public record PaymentView(String orderId,String paymentId,long totalMinor,String currency,String status,Instant createdAt){}
    private final JdbcTemplate db;
    public PaymentController(JdbcTemplate db){this.db=db;}
    @GetMapping("/{orderId}") public PaymentView read(@PathVariable String orderId,@RequestHeader("X-Internal-User-Id") String user){
        return db.query("SELECT order_id,payment_id,total_minor,currency,status,created_at FROM payments WHERE order_id=? AND user_id=?",(rs,n)->new PaymentView(rs.getString(1),rs.getString(2),rs.getLong(3),rs.getString(4),rs.getString(5),rs.getTimestamp(6).toInstant()),orderId,user).stream().findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Payment not found"));
    }
}
