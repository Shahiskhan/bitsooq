package com.acme.commerce.user.domain;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
public final class RolePolicy {
    private RolePolicy() {}
    private static final Set<String> ALLOWED=Set.of("USER","STAFF","SUPER_ADMIN","PRODUCT_MANAGER","STORE_MANAGER","FULFILLMENT_MANAGER");
    public static List<String> normalize(Collection<String> requested) {
        if(requested==null || requested.isEmpty() || requested.size()>6 || requested.stream().anyMatch(role->role==null || !ALLOWED.contains(role)))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Roles must be selected from USER, STAFF, SUPER_ADMIN, PRODUCT_MANAGER, STORE_MANAGER and FULFILLMENT_MANAGER");
        var roles=new TreeSet<>(requested); roles.add("USER"); return List.copyOf(roles);
    }
    public static List<String> fromClaims(Map<String,Object> claims) {
        var roles=new TreeSet<String>(); roles.add("USER");
        Object configured=claims.get("roles");
        if(configured instanceof Collection<?> collection) for(Object value:collection) if(value instanceof String role && ALLOWED.contains(role)) roles.add(role);
        if(Boolean.TRUE.equals(claims.get("admin")) || (configured instanceof Collection<?> collection && collection.contains("ADMIN"))) roles.add("STAFF");
        return List.copyOf(roles);
    }
    public static void requireSuper(Set<String> roles) {
        if(!roles.contains("SUPER_ADMIN")) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Super Admin role required");
    }
    public static void preventSelfDemotion(String actor,String target,List<String> roles) {
        if(actor.equals(target) && !roles.contains("SUPER_ADMIN")) throw new ResponseStatusException(HttpStatus.CONFLICT,"A Super Admin cannot remove their own Super Admin role");
    }
}
