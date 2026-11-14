package com.commerce.gateway.security;

import java.time.Instant;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.security.web.server.WebFilterChainProxy;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class GatewayAuthorizationTest {
    private final WebTestClient client;

    GatewayAuthorizationTest() {
        ReactiveJwtDecoder decoder = token -> {
            if (token.equals("invalid")) return Mono.error(new BadJwtException("invalid token"));
            return Mono.just(Jwt.withTokenValue(token).header("alg", "RS256").subject("customer-123")
                    .issuedAt(Instant.now().minusSeconds(30)).expiresAt(Instant.now().plusSeconds(300))
                    .claim("admin", token.equals("administrator"))
                    .claim("roles", token.equals("super") ? List.of("SUPER_ADMIN") : token.equals("staff") ? List.of("STAFF") : List.of("USER")).build());
        };
        ServerHttpSecurity http = ServerHttpSecurity.http()
                .oauth2ResourceServer(resource -> resource.jwt(jwt -> jwt.jwtDecoder(decoder)));
        http.cors(cors -> cors.configurationSource(new SecurityConfiguration().corsConfigurationSource(List.of("http://localhost:5173"))));
        var chain = new SecurityConfiguration().security(http);
        client = WebTestClient.bindToController(new Endpoint())
                .webFilter(new WebFilterChainProxy(chain)).configureClient().responseTimeout(Duration.ofSeconds(30)).build();
    }

    @Test void allowsConfiguredBrowserPreflightForIdempotentCheckout() {
        client.options().uri("/api/orders").header("Origin", "http://localhost:5173")
                .header("Access-Control-Request-Method", "POST").header("Access-Control-Request-Headers", "authorization,idempotency-key,content-type")
                .exchange().expectStatus().isOk().expectHeader().valueEquals("Access-Control-Allow-Origin", "http://localhost:5173");
    }
    @Test void rejectsUntrustedBrowserOrigin() {
        client.options().uri("/api/orders").header("Origin", "https://attacker.example")
                .header("Access-Control-Request-Method", "POST").exchange().expectStatus().isForbidden();
    }
    @Test void healthProbeIsPublic() { client.get().uri("/actuator/health").exchange().expectStatus().isOk(); }
    @Test void userApiRequiresAuthentication() { client.get().uri("/api/users/me").exchange().expectStatus().isUnauthorized(); }
    @Test void invalidBearerTokenIsRejected() { client.get().uri("/api/orders/1").headers(headers -> headers.setBearerAuth("invalid")).exchange().expectStatus().isUnauthorized(); }
    @Test void anonymousCanReadCatalog() { client.get().uri("/api/products/1").exchange().expectStatus().isOk(); }
    @Test void anonymousCanReadCategories() { client.get().uri("/api/categories").exchange().expectStatus().isOk(); }
    @Test void anonymousCannotMutateCatalog() { client.post().uri("/api/products").exchange().expectStatus().isUnauthorized(); }
    @Test void staffCannotManageRoles() { client.put().uri("/api/admin/users/customer/roles").headers(headers -> headers.setBearerAuth("staff")).exchange().expectStatus().isForbidden(); }
    @Test void superAdminCanManageRoles() { client.put().uri("/api/admin/users/customer/roles").headers(headers -> headers.setBearerAuth("super")).exchange().expectStatus().isOk(); }
    @Test void staffCanMonitorOrders() { client.get().uri("/api/admin/orders").headers(headers -> headers.setBearerAuth("staff")).exchange().expectStatus().isOk(); }
    @Test void staffCannotReadSuperAdminAnalytics() { client.get().uri("/api/admin/analytics/orders").headers(headers -> headers.setBearerAuth("staff")).exchange().expectStatus().isForbidden(); }
    @Test void legacyAdminCannotManageRoles() { client.put().uri("/api/admin/users/customer/roles").headers(headers -> headers.setBearerAuth("administrator")).exchange().expectStatus().isForbidden(); }
    @Test void customerCanReadOwnPaymentRoute() { client.get().uri("/api/payments/orders/1").headers(headers -> headers.setBearerAuth("customer")).exchange().expectStatus().isOk(); }
    @Test void customerCannotMonitorOthersOrders() { client.get().uri("/api/admin/orders").headers(headers -> headers.setBearerAuth("customer")).exchange().expectStatus().isForbidden(); }
    @Test void authenticatedCustomerCanReadCatalog() { client.get().uri("/api/products/1").headers(headers -> headers.setBearerAuth("customer")).exchange().expectStatus().isOk(); }
    @Test void customerCannotMutateCatalog() { client.post().uri("/api/products").headers(headers -> headers.setBearerAuth("customer")).exchange().expectStatus().isForbidden(); }
    @Test void administratorCanMutateCatalog() { client.post().uri("/api/products").headers(headers -> headers.setBearerAuth("administrator")).exchange().expectStatus().isOk(); }
    @Test void authenticatedCustomerCanReadNotifications() { client.get().uri("/api/notifications").headers(headers -> headers.setBearerAuth("customer")).exchange().expectStatus().isOk(); }
    @Test void managementEndpointsStayPrivate() { client.get().uri("/actuator/env").headers(headers -> headers.setBearerAuth("administrator")).exchange().expectStatus().isForbidden(); }
    @Test void paymentApiHasNoPublicRoute() { client.post().uri("/api/payments").headers(headers -> headers.setBearerAuth("administrator")).exchange().expectStatus().isForbidden(); }

    @RestController
    static class Endpoint {
        @RequestMapping("/**") String success() { return "ok"; }
    }
}

