package com.acme.commerce.user.api;

import com.acme.commerce.user.application.AddressService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users/me/addresses")
@Validated
public class AddressController {
    private final AddressService addresses;
    public AddressController(AddressService addresses) { this.addresses = addresses; }

    public record AddressBody(@NotBlank @Size(max=60) String addressLabel,
                              @NotBlank @Size(max=160) String recipientName,
                              @NotBlank @Pattern(regexp="[+0-9() .-]{7,32}") String phone,
                              @NotBlank @Size(max=240) String addressLine1,
                              @Size(max=240) String addressLine2,
                              @Size(max=120) String area,
                              @NotBlank @Size(max=120) String city,
                              @Size(max=80) String regionCode,
                              @Size(max=24) @Pattern(regexp="[A-Za-z0-9 -]*") String postalCode,
                              @NotBlank @Pattern(regexp="[A-Z]{2}") String countryCode,
                              @Size(max=500) String deliveryInstructions,
                              boolean defaultShipping, boolean defaultBilling,
                              @DecimalMin("-90.0") @DecimalMax("90.0") Double latitude,
                              @DecimalMin("-180.0") @DecimalMax("180.0") Double longitude,
                              @Min(1) @Max(100000) Integer locationAccuracyM) {
        AddressService.AddressInput toInput() {
            if ((latitude == null) != (longitude == null)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Latitude and longitude must be supplied together");
            return new AddressService.AddressInput(addressLabel,recipientName,phone,addressLine1,addressLine2,area,city,
                    regionCode,postalCode,countryCode,deliveryInstructions,defaultShipping,defaultBilling,
                    latitude,longitude,locationAccuracyM);
        }
    }

    @GetMapping public List<AddressService.Address> list(@RequestAttribute String userId) { return addresses.list(userId); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public AddressService.Address create(@RequestAttribute String userId,@Valid @RequestBody AddressBody body) { return addresses.create(userId,body.toInput()); }
    @PutMapping("/{id}")
    public AddressService.Address update(@RequestAttribute String userId,@PathVariable @Pattern(regexp="[a-fA-F0-9-]{36}") String id,
                                         @RequestParam @Min(0) long expectedVersion,@Valid @RequestBody AddressBody body) {
        return addresses.update(userId,id,body.toInput(),expectedVersion);
    }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void archive(@RequestAttribute String userId,@PathVariable @Pattern(regexp="[a-fA-F0-9-]{36}") String id,@RequestParam @Min(0) long expectedVersion) {
        addresses.archive(userId,id,expectedVersion);
    }
}
