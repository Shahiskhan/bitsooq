package com.acme.commerce.user.api;
import com.acme.commerce.user.application.AdminRoleService;
import com.acme.commerce.user.application.UserDirectory;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
@RestController
@Validated
@RequestMapping("/api/admin/users")
public class AdminUserController {
    private final AdminRoleService service;
    public AdminUserController(AdminRoleService service) { this.service=service; }
    public record ChangeRoles(@NotEmpty @Size(max=3) List<@NotNull @Pattern(regexp="USER|STAFF|SUPER_ADMIN") String> roles) {}
    private static Set<String> roles(HttpServletRequest request) { return Arrays.stream(((String)request.getAttribute("roles")).split(",")).collect(Collectors.toSet()); }
    private static String actor(HttpServletRequest request) { return (String)request.getAttribute("userId"); }
    @GetMapping public UserDirectory.DirectoryPage list(HttpServletRequest request,@RequestParam(required=false) @Size(max=2048) String cursor,@RequestParam(defaultValue="20") @Min(1) @Max(100) int size) {
        return service.list(actor(request),roles(request),cursor,size);
    }
    @GetMapping("/{uid}/roles") public AdminRoleService.RolesView get(HttpServletRequest request,@PathVariable @NotBlank @Size(max=128) String uid) {
        return service.get(actor(request),roles(request),uid);
    }
    @PutMapping("/{uid}/roles") public AdminRoleService.RolesView change(HttpServletRequest request,@PathVariable @NotBlank @Size(max=128) String uid,
            @RequestHeader(value="Idempotency-Key",required=false) String key,@Valid @RequestBody ChangeRoles body) {
        return service.update(actor(request),roles(request),uid,body.roles(),key,request.getHeader("X-Internal-Request-Id"));
    }
}
