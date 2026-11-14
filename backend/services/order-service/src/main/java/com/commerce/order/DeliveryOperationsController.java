package com.commerce.order;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@Validated
public class DeliveryOperationsController {
    private final OrderService orders;
    public DeliveryOperationsController(OrderService orders) { this.orders=orders; }

    public record CodCollection(@Min(1) long amountMinor,
                                @NotBlank @Pattern(regexp="[A-Za-z0-9._:-]{1,120}") String reference) { }
    public record ShipmentUpdate(@NotBlank @Pattern(regexp="PENDING|LABEL_CREATED|READY|SHIPPED|IN_TRANSIT|OUT_FOR_DELIVERY|DELIVERED|FAILED|RETURNED|CANCELLED") String status,
                                 @Size(max=64) @Pattern(regexp="[A-Za-z0-9_-]*") String carrierCode,
                                 @Size(max=120) @Pattern(regexp="[A-Za-z0-9._/-]*") String trackingNumber,
                                 @Size(max=1000) @Pattern(regexp="https://[^\\s]+") String trackingUrl,
                                 @Size(max=300) String description,
                                 @Size(max=160) String location) { }

    @PostMapping("/api/admin/orders/{id}/cod-collection")
    public void collectCash(HttpServletRequest request,
                            @PathVariable @Pattern(regexp="[a-fA-F0-9-]{36}") String id,
                            @RequestHeader(value="Idempotency-Key",required=false) String key,
                            @Valid @RequestBody CodCollection body) {
        AdminOrderController.staff(request);
        orders.markCodCollected(id,request.getHeader("X-Internal-User-Id"),body.amountMinor(),body.reference(),key);
    }

    @PatchMapping("/api/admin/shipments/{id}")
    public void updateShipment(HttpServletRequest request,
                               @PathVariable @Pattern(regexp="[a-fA-F0-9-]{36}") String id,
                               @Valid @RequestBody ShipmentUpdate body) {
        AdminOrderController.staff(request);
        orders.updateShipment(id,request.getHeader("X-Internal-User-Id"),body.status(),body.carrierCode(),body.trackingNumber(),body.trackingUrl(),body.description(),body.location());
    }
}
