package com.commerce.gateway.security;

import java.time.Clock;
import java.time.Duration;
import java.util.Collection;
import java.util.List;
import java.util.TreeSet;
import io.netty.channel.ChannelOption;
import reactor.netty.http.client.HttpClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.security.web.server.context.NoOpServerSecurityContextRepository;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsConfigurationSource;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@Configuration
public class SecurityConfiguration {
    @Bean ReactiveJwtDecoder jwtDecoder(@Value("${security.firebase.project-id}") String projectId) {
        NimbusReactiveJwtDecoder decoder = NimbusReactiveJwtDecoder
                .withJwkSetUri("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
                .jwsAlgorithm(SignatureAlgorithm.RS256)
                .webClient(WebClient.builder().clientConnector(new ReactorClientHttpConnector(HttpClient.create()
                        .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 1000).responseTimeout(Duration.ofSeconds(2)))).build())
                .build();
        decoder.setJwtValidator(new FirebaseTokenValidator(projectId, Clock.systemUTC()));
        return decoder;
    }

    @Bean CorsConfigurationSource corsConfigurationSource(@Value("${security.cors.allowed-origins:http://localhost:5173,http://localhost:3000}") List<String> origins) {
        var config = new CorsConfiguration();
        config.setAllowedOrigins(origins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Idempotency-Key", "If-Match"));
        config.setExposedHeaders(List.of("X-Request-Id", "X-RateLimit-Remaining", "Retry-After"));
        config.setAllowCredentials(false);
        config.setMaxAge(3600L);
        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }

    @Bean SecurityWebFilterChain security(ServerHttpSecurity http) {
        return http.csrf(ServerHttpSecurity.CsrfSpec::disable)
                .cors(Customizer.withDefaults())
                .httpBasic(ServerHttpSecurity.HttpBasicSpec::disable)
                .formLogin(ServerHttpSecurity.FormLoginSpec::disable)
                .securityContextRepository(NoOpServerSecurityContextRepository.getInstance())
                .authorizeExchange(auth -> auth.pathMatchers("/actuator/health", "/actuator/health/**").permitAll()
                        .pathMatchers(HttpMethod.GET, "/api/products", "/api/products/**", "/api/categories", "/api/categories/**").permitAll()
                        .pathMatchers("/api/admin/users/**", "/api/admin/analytics/**").hasRole("SUPER_ADMIN")
                        .pathMatchers("/api/admin/orders/**", "/api/admin/products/**", "/api/admin/categories/**", "/api/admin/delivery/**", "/api/admin/shipments/**").hasAnyRole("STAFF", "SUPER_ADMIN")
                        .pathMatchers("/api/products/**", "/api/categories/**").hasAnyRole("STAFF", "SUPER_ADMIN")
                        .pathMatchers(HttpMethod.GET, "/api/payments/orders/**").authenticated()
                        // Moyasar webhook: unauthenticated by design; verification happens via an
                        // authoritative re-fetch of the payment from the Moyasar API inside the service.
                        .pathMatchers(HttpMethod.POST, "/api/payments/moyasar/webhook").permitAll()
                        .pathMatchers("/api/payments/moyasar/**", "/api/payments/crypto/**").authenticated()
                        // OpenAPI docs & Swagger UI: read-only metadata, safe to expose in local/demo.
                        .pathMatchers("/docs/**").permitAll()
                        .pathMatchers("/api/users/**", "/api/cart/**", "/api/orders/**", "/api/delivery/**", "/api/notifications/**").authenticated()
                        .anyExchange().denyAll())
                .oauth2ResourceServer(oauth -> oauth.jwt(jwt -> jwt.jwtAuthenticationConverter(token -> Mono.just(authentication(token)))))
                .build();
    }

    static JwtAuthenticationToken authentication(Jwt token) {
        TreeSet<String> roles = new TreeSet<>(List.of("USER"));
        // Legacy admins migrate to staff; only an explicit trusted claim grants SUPER_ADMIN.
        if (Boolean.TRUE.equals(token.getClaim("admin"))) roles.add("STAFF");
        Object customRoles = token.getClaim("roles");
        if (customRoles instanceof Collection<?> claims) {
            claims.stream().filter(String.class::isInstance).map(String.class::cast)
                    .map(role -> role.equals("ADMIN") ? "STAFF" : role)
                    .filter(role -> List.of("SUPER_ADMIN", "STAFF", "USER").contains(role)).forEach(roles::add);
        }
        return new JwtAuthenticationToken(token, roles.stream().map(role -> new SimpleGrantedAuthority("ROLE_" + role)).toList());
    }
}
