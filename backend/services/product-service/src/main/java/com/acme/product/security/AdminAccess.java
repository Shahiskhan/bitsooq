package com.acme.product.security;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Arrays;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
public final class AdminAccess {
    private AdminAccess() { }
    public static void requireStaff(HttpServletRequest request) {
        Object roles=request.getAttribute("authenticatedRoles");
        if(roles==null || Arrays.stream(roles.toString().split(",")).noneMatch(role->role.equals("STAFF")||role.equals("SUPER_ADMIN")))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Staff privilege required");
    }
}
