package com.commerce.gateway;

import static org.assertj.core.api.Assertions.assertThat;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.security.web.server.SecurityWebFilterChain;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK, properties = {
        "CONFIG_IMPORT=optional:classpath:/absent-gateway-test-override.yml",
        "spring.cloud.config.enabled=false",
        "spring.cloud.config.import-check.enabled=false",
        "eureka.client.enabled=false",
        "spring.cloud.discovery.enabled=false",
        "security.firebase.project-id=commerce-test",
        "security.internal.secret=test-secret-at-least-thirty-two-bytes-long",
        "spring.data.redis.password=test-password-only",
        "EUREKA_URL=http://localhost:18761/eureka/"
})
class GatewayContextTest {
    @Autowired RouteLocator routes;
    @Autowired RedisRateLimiter limiter;
    @Autowired SecurityWebFilterChain security;

    @Test void wiresSecurityCircuitBreakersRateLimiterAndExplicitRoutes() {
        assertThat(routes.getRoutes().map(route -> route.getId()).collectList().block(Duration.ofSeconds(10)))
                .containsExactlyInAnyOrder("admin-users", "users", "products", "orders", "notifications", "payments");
        assertThat(routes.getRoutes().filter(route -> route.getId().equals("admin-users")).next().block(Duration.ofSeconds(10)).getMetadata())
                .containsEntry("response-timeout", 20000);
        assertThat(limiter).isNotNull();
        assertThat(security).isNotNull();
    }
}
