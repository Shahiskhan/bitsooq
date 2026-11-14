package com.commerce.gateway;

import java.time.Duration;
import org.springframework.cloud.gateway.route.builder.GatewayFilterSpec;
import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import reactor.core.publisher.Mono;

@Configuration
class RoutingConfiguration {
    @Bean RedisRateLimiter redisRateLimiter() { return new FailClosedRedisRateLimiter(20, 40, 1); }
    @Bean KeyResolver authenticatedUserKeyResolver() {
        return exchange -> exchange.getPrincipal().map(principal -> "user:" + principal.getName())
                // Socket peer is authoritative. Never trust arbitrary client X-Forwarded-For headers.
                .switchIfEmpty(Mono.fromSupplier(() -> "anonymous:" + (exchange.getRequest().getRemoteAddress() == null
                        ? "unknown" : exchange.getRequest().getRemoteAddress().getAddress().getHostAddress())));
    }

    @Bean RouteLocator routes(RouteLocatorBuilder builder, KeyResolver authenticatedUserKeyResolver) {
        return builder.routes()
                .route("admin-users", route -> route.path("/api/admin/users/**")
                        .filters(filters -> resilient(filters, "adminUsers", authenticatedUserKeyResolver))
                        .metadata(org.springframework.cloud.gateway.support.RouteMetadataUtils.RESPONSE_TIMEOUT_ATTR, 20000)
                        .uri("lb://user-service"))
                .route("users", route -> route.path("/api/users/**")
                        .filters(filters -> resilient(filters, "users", authenticatedUserKeyResolver)).uri("lb://user-service"))
                .route("products", route -> route.path("/api/products/**", "/api/cart/**", "/api/categories/**", "/api/admin/products/**", "/api/admin/categories/**", "/api/admin/sellers/**")
                        .filters(filters -> resilient(filters, "products", authenticatedUserKeyResolver)).uri("lb://product-service"))
                .route("orders", route -> route.path("/api/orders/**", "/api/admin/orders/**", "/api/admin/analytics/orders", "/api/delivery/**", "/api/admin/delivery/**", "/api/admin/shipments/**")
                        .filters(filters -> resilient(filters, "orders", authenticatedUserKeyResolver)).uri("lb://order-service"))
                .route("notifications", route -> route.path("/api/notifications/**")
                        .filters(filters -> resilient(filters, "notifications", authenticatedUserKeyResolver)).uri("lb://notification-service"))
                .route("payments", route -> route.path("/api/payments/orders/**")
                        .filters(filters -> resilient(filters, "payments", authenticatedUserKeyResolver)).uri("lb://payment-service"))
                // BitSooq hybrid payments. The Moyasar webhook is rate-limited but NOT JWT-protected:
                // Moyasar's servers cannot present a Firebase token. Authenticity is enforced downstream
                // by re-fetching the authoritative payment state from the Moyasar API.
                .route("moyasar-payments", route -> route.path("/api/payments/moyasar/**")
                        .filters(filters -> resilient(filters, "moyasarPayments", authenticatedUserKeyResolver)).uri("lb://moyasar-payment-service"))
                .route("crypto-payments", route -> route.path("/api/payments/crypto/**")
                        .filters(filters -> resilient(filters, "cryptoPayments", authenticatedUserKeyResolver)).uri("lb://crypto-gateway-service"))
                // Swagger UI / OpenAPI docs for each backing service, browsable through the gateway.
                .route("docs-product", r -> r.path("/docs/product/**").filters(f -> f.rewritePath("/docs/product/(?<seg>.*)", "/${seg}")).uri("lb://product-service"))
                .route("docs-order", r -> r.path("/docs/order/**").filters(f -> f.rewritePath("/docs/order/(?<seg>.*)", "/${seg}")).uri("lb://order-service"))
                .route("docs-user", r -> r.path("/docs/user/**").filters(f -> f.rewritePath("/docs/user/(?<seg>.*)", "/${seg}")).uri("lb://user-service"))
                .route("docs-payment", r -> r.path("/docs/payment/**").filters(f -> f.rewritePath("/docs/payment/(?<seg>.*)", "/${seg}")).uri("lb://payment-service"))
                .route("docs-moyasar", r -> r.path("/docs/moyasar/**").filters(f -> f.rewritePath("/docs/moyasar/(?<seg>.*)", "/${seg}")).uri("lb://moyasar-payment-service"))
                .route("docs-crypto", r -> r.path("/docs/crypto/**").filters(f -> f.rewritePath("/docs/crypto/(?<seg>.*)", "/${seg}")).uri("lb://crypto-gateway-service"))
                .route("docs-notification", r -> r.path("/docs/notification/**").filters(f -> f.rewritePath("/docs/notification/(?<seg>.*)", "/${seg}")).uri("lb://notification-service"))
                .build();
    }

    private GatewayFilterSpec resilient(GatewayFilterSpec filters, String circuit, KeyResolver key) {
        return filters.requestRateLimiter(config -> config.setKeyResolver(key))
                .circuitBreaker(config -> config.setName(circuit)
                        .addStatusCode("500").addStatusCode("502").addStatusCode("503").addStatusCode("504"))
                .retry(config -> config.setRetries(1).setMethods(HttpMethod.GET)
                        .setStatuses(HttpStatus.BAD_GATEWAY, HttpStatus.SERVICE_UNAVAILABLE, HttpStatus.GATEWAY_TIMEOUT)
                        .setBackoff(Duration.ofMillis(100), Duration.ofMillis(300), 2, false));
    }
}



