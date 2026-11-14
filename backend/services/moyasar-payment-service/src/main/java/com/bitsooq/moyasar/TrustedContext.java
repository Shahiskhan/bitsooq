package com.bitsooq.moyasar;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Reads the gateway-propagated trusted identity headers (HMAC-verified
 * upstream, case-sensitive UID).
 */
@Component
public class TrustedContext {
    public String requireUserId(HttpServletRequest request) {
        String userId = request.getHeader("X-User-Id");
        if (userId == null || userId.isBlank() || userId.length() > 128 || userId.contains("\n")
                || userId.contains("\r"))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing trusted user context");
        return userId;
    }
}
