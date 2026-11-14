package com.commerce.gateway.security;

import org.springframework.http.HttpMethod;
import org.springframework.web.server.ServerWebExchange;

/** Exact public capability; anonymous identity is never used for customer or administration APIs. */
public final class CatalogAccess {
    private CatalogAccess() { }
    public static boolean isPublicRead(ServerWebExchange exchange) {
        if (exchange.getRequest().getMethod() != HttpMethod.GET) return false;
        String path = exchange.getRequest().getPath().value();
        return path.equals("/api/products") || path.startsWith("/api/products/")
                || path.equals("/api/categories") || path.startsWith("/api/categories/");
    }
}
