package com.acme.product.security;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Arrays;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
public final class AdminAccess {
    private AdminAccess() { }
    public static void requireStaff(HttpServletRequest request) {
        requireAny(request,"STAFF","SUPER_ADMIN");
    }
    public static void requireCatalog(HttpServletRequest request) {
        requireAny(request,"PRODUCT_MANAGER","STAFF","SUPER_ADMIN");
    }
    public static void requireStores(HttpServletRequest request) {
        requireAny(request,"STORE_MANAGER","STAFF","SUPER_ADMIN");
    }
    private static void requireAny(HttpServletRequest request,String... accepted) {
        Object roles=request.getAttribute("authenticatedRoles");
        if(roles==null || Arrays.stream(roles.toString().split(",")).noneMatch(role->Arrays.asList(accepted).contains(role)))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Required manager role missing");
    }
}
