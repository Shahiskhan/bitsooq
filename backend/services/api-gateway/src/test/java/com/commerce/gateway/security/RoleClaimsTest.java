package com.commerce.gateway.security;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import static org.assertj.core.api.Assertions.*;
class RoleClaimsTest {
    @Test void onlyExplicitTrustedClaimGrantsSuperAdmin() {
        var legacy = SecurityConfiguration.authentication(Jwt.withTokenValue("legacy").header("alg","RS256").subject("uid").claim("admin",true).claim("roles",List.of("ADMIN","FAKE_ADMIN")).build());
        assertThat(legacy.getAuthorities()).extracting(Object::toString).containsExactly("ROLE_STAFF","ROLE_USER");
        var full = SecurityConfiguration.authentication(Jwt.withTokenValue("super").header("alg","RS256").subject("uid").claim("roles",List.of("SUPER_ADMIN")).build());
        assertThat(full.getAuthorities()).extracting(Object::toString).containsExactly("ROLE_SUPER_ADMIN","ROLE_USER");
    }
    @Test void malformedRolesNeverGrantAuthority() {
        var result = SecurityConfiguration.authentication(Jwt.withTokenValue("token").header("alg","RS256").subject("uid").claim("roles","SUPER_ADMIN").build());
        assertThat(result.getAuthorities()).extracting(Object::toString).containsExactly("ROLE_USER");
    }
}
