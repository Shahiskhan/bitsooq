package com.acme.product.api;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.Components;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Swagger UI at /swagger-ui.html — proxied by the API Gateway for easy demo
 * access.
 */
@Configuration
public class OpenApiConfig {
        @Bean
        public OpenAPI productOpenApi() {
                String bearer = "bearerAuth";
                return new OpenAPI()
                                .info(new Info()
                                                .title("BitSooq Product Service API")
                                                .description("Bilingual catalog (EN/AR) with inventory, categories and cart endpoints. "
                                                                + "Admin endpoints require a Firebase JWT with STAFF/SUPER_ADMIN role; "
                                                                + "the API Gateway normally fronts this service.")
                                                .version("v1"))
                                .addSecurityItem(new SecurityRequirement().addList(bearer))
                                .components(new Components().addSecuritySchemes(bearer,
                                                new SecurityScheme().name(bearer).type(SecurityScheme.Type.HTTP)
                                                                .scheme("bearer").bearerFormat("JWT")));
        }
}
