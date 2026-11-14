package com.commerce.order;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@Validated
public class DeliveryController {
    private final DeliveryService delivery;
    public DeliveryController(DeliveryService delivery) { this.delivery = delivery; }

    public record DestinationBody(@NotBlank @Pattern(regexp="[A-Z]{2}") String countryCode,
                                  @NotBlank @Size(max=80) String regionCode,
                                  @NotBlank @Size(max=120) String city,
                                  @Size(max=120) String area,
                                  @Size(max=24) @Pattern(regexp="[A-Za-z0-9 -]*") String postalCode) {
        DeliveryService.Destination toDestination() { return new DeliveryService.Destination(countryCode,regionCode,city,area,postalCode); }
    }
    public record ZoneBody(@NotBlank @Pattern(regexp="[A-Z0-9_-]{2,64}") String zoneCode,
                           @NotBlank @Pattern(regexp="[A-Z]{2}") String countryCode,
                           @NotBlank @Size(max=80) String regionCode,
                           @NotBlank @Size(max=120) String city,
                           @Size(max=120) String area,
                           @Size(max=24) @Pattern(regexp="[A-Za-z0-9 -]*") String postalPrefix,
                           @Min(-1000) @Max(1000) int priority) { }
    public record RateBody(@NotBlank @Pattern(regexp="[A-Z0-9_-]{2,40}") String methodCode,
                           @NotBlank @Size(max=100) String methodName,
                           @Min(0) @Max(1_000_000_000_000L) long feeMinor,
                           @NotBlank @Pattern(regexp="USD") String currency,
                           @Min(0) @Max(90) int minDeliveryDays,
                           @Min(0) @Max(90) int maxDeliveryDays,
                           @NotNull Boolean supportsCod) { }
    public record ActiveBody(@NotNull Boolean active) { }

    @PostMapping("/api/delivery/options")
    public List<DeliveryService.Option> options(@Valid @RequestBody DestinationBody destination,
                                                @RequestParam(defaultValue="USD") @Pattern(regexp="USD") String currency) {
        return delivery.options(destination.toDestination(),currency);
    }

    @GetMapping("/api/admin/delivery/zones")
    public List<DeliveryService.Zone> zones(HttpServletRequest request) { AdminOrderController.staff(request); return delivery.zones(); }
    @PostMapping("/api/admin/delivery/zones") @ResponseStatus(HttpStatus.CREATED)
    public DeliveryService.Zone createZone(HttpServletRequest request,@Valid @RequestBody ZoneBody body) {
        AdminOrderController.staff(request);
        return delivery.createZone(body.zoneCode(),body.countryCode(),body.regionCode(),body.city(),body.area(),body.postalPrefix(),body.priority());
    }
    @GetMapping("/api/admin/delivery/rates")
    public List<DeliveryService.Rate> rates(HttpServletRequest request) { AdminOrderController.staff(request); return delivery.rates(); }
    @PostMapping("/api/admin/delivery/zones/{zoneId}/rates") @ResponseStatus(HttpStatus.CREATED)
    public DeliveryService.Rate createRate(HttpServletRequest request,@PathVariable @Pattern(regexp="[a-fA-F0-9-]{36}") String zoneId,@Valid @RequestBody RateBody body) {
        AdminOrderController.staff(request);
        return delivery.createRate(zoneId,body.methodCode(),body.methodName(),body.feeMinor(),body.currency(),body.minDeliveryDays(),body.maxDeliveryDays(),body.supportsCod());
    }
    @PatchMapping("/api/admin/delivery/zones/{id}/active")
    public DeliveryService.Zone setZoneActive(HttpServletRequest request,@PathVariable @Pattern(regexp="[a-fA-F0-9-]{36}") String id,@Valid @RequestBody ActiveBody body) {
        AdminOrderController.staff(request); return delivery.setZoneActive(id,body.active());
    }
    @PatchMapping("/api/admin/delivery/rates/{id}/active")
    public DeliveryService.Rate setRateActive(HttpServletRequest request,@PathVariable @Pattern(regexp="[a-fA-F0-9-]{36}") String id,@Valid @RequestBody ActiveBody body) {
        AdminOrderController.staff(request); return delivery.setRateActive(id,body.active());
    }
}
