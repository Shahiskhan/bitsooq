package com.acme.commerce.crypto.api;

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
        public OpenAPI cryptoOpenApi() {
                String bearer = "bearerAuth";
                return new OpenAPI()
                                .info(new Info().title("BitSooq Crypto Gateway Service API")
                                                .description("Contract-free Web3 payment verification: plain native/ERC-20 transfers verified on-chain "
                                                                + "via a public RPC (status, recipient wallet, transferred value). Zero custom Solidity.")
                                                .version("v1"))
                                .addSecurityItem(new SecurityRequirement().addList(bearer))
                                .components(new Components().addSecuritySchemes(bearer,
                                                new SecurityScheme().name(bearer).type(SecurityScheme.Type.HTTP)
                                                                .scheme("bearer").bearerFormat("JWT")));
        }
}
