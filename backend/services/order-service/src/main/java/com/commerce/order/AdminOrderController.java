package com.commerce.order;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.Arrays;
@RestController @Validated
public class AdminOrderController {
    private final OrderQueries queries;
    public AdminOrderController(OrderQueries queries){this.queries=queries;}
    @GetMapping("/api/orders") public OrderQueries.Page mine(@RequestHeader("X-Internal-User-Id") String user,@RequestParam(defaultValue="") @Size(max=512) String after,@RequestParam(defaultValue="20") @Min(1) @Max(100) int size){return queries.list(user,after,size,null);}
    @GetMapping("/api/admin/orders") public OrderQueries.Page orders(HttpServletRequest r,@RequestParam(defaultValue="") @Size(max=512) String after,@RequestParam(defaultValue="20") @Min(1) @Max(100) int size,@RequestParam(required=false) String status){staff(r);return queries.list(null,after,size,status);}
    @GetMapping("/api/admin/orders/{id}") public OrderQueries.Detail order(HttpServletRequest r,@PathVariable @Pattern(regexp="[a-fA-F0-9-]{36}") String id){staff(r);return queries.detail(id);}
    @GetMapping("/api/admin/analytics/orders") public OrderQueries.Analytics analytics(HttpServletRequest r){if(!roles(r).contains("SUPER_ADMIN"))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Super Admin privilege required");return queries.analytics();}
    static void staff(HttpServletRequest r){var roles=roles(r);if(!roles.contains("STAFF")&&!roles.contains("SUPER_ADMIN")&&!roles.contains("FULFILLMENT_MANAGER"))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Fulfillment manager privilege required");}
    private static java.util.List<String> roles(HttpServletRequest r){String roles=r.getHeader("X-Internal-Roles");return roles==null?java.util.List.of():Arrays.asList(roles.split(","));}
}
