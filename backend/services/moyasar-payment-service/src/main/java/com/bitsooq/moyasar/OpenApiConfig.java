package com.bitsooq.moyasar;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
        @Bean
        public OpenAPI moyasarOpenApi() {
                String bearer = "bearerAuth";
                return new OpenAPI()
                                .info(new Info().title("BitSooq Moyasar Payment Service API")
                                                .description("Regional fiat payments via Moyasar: Mada, Visa/MasterCard, Apple Pay. "
                                                                + "POST /api/payments/moyasar/webhook is unauthenticated by design and verified by "
                                                                + "re-fetching the authoritative payment from the Moyasar API.")
                                                .version("v1"))
                                .addSecurityItem(new SecurityRequirement().addList(bearer))
                                .components(new Components().addSecuritySchemes(bearer,
                                                new SecurityScheme().name(bearer).type(SecurityScheme.Type.HTTP)
                                                                .scheme("bearer").bearerFormat("JWT")));
        }
}
