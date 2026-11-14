package com.acme.commerce.crypto.api;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import com.acme.commerce.crypto.application.CryptoVerificationService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

@RestController
@RequestMapping("/api/payments/crypto")
public class CryptoController {
    private final CryptoVerificationService verifier;

    public CryptoController(CryptoVerificationService verifier) {
        this.verifier = verifier;
    }

    public record VerifyRequest(@NotBlank @Size(max = 128) String orderId,
            @NotBlank @Pattern(regexp = "0x[0-9a-fA-F]{64}") String txHash,
            @NotBlank @Pattern(regexp = "[a-z0-9-]{2,32}") String network,
            @NotNull @Min(1) Long expectedAmountMinor) {
    }

    @PostMapping("/verify")
    @ResponseStatus(HttpStatus.OK)
    public CryptoVerificationService.Result verify(@Valid @RequestBody VerifyRequest request,
            HttpServletRequest servlet) {
        String userId = (String) servlet.getAttribute("userId");
        return verifier.verify(userId, request);
    }
}
