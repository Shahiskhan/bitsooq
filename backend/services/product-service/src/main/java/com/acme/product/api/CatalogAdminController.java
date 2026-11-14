package com.acme.product.api;
import com.acme.product.application.CatalogAdministration;
import com.acme.product.domain.Product;
import com.acme.product.security.AdminAccess;
import com.acme.product.security.InternalContextFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import java.util.List;
@RestController @Validated
public class CatalogAdminController {
    private final CatalogAdministration admin;
    public CatalogAdminController(CatalogAdministration admin){this.admin=admin;}
    public record CreateCategory(@NotBlank @Pattern(regexp="[A-Z0-9_-]{1,64}") String id,@NotBlank @Size(max=100) String name){}
    public record UpdateCategory(@NotBlank @Size(max=100) String name,@Min(0) long expectedVersion,@NotNull Boolean active){}
    public record UpdateProduct(@NotBlank @Size(max=200) String name,@Min(1) @Max(1_000_000_000_000L) long priceMinor,@NotNull @Pattern(regexp="USD") String currency,@Pattern(regexp="[A-Z0-9_-]{1,64}") String categoryId,@Min(0) long expectedVersion){}
    public record StockAdjustment(@Min(-1_000_000_000) @Max(1_000_000_000) int delta,@Min(0) long expectedVersion,@NotBlank @Size(max=200) String reason){}
    @GetMapping("/api/categories") public List<CatalogAdministration.Category> categories(){return admin.categories();}
    @PostMapping("/api/categories") @ResponseStatus(HttpStatus.CREATED) public CatalogAdministration.Category create(@Valid @RequestBody CreateCategory body,HttpServletRequest r){AdminAccess.requireStaff(r);return admin.createCategory(body.id(),body.name());}
    @PutMapping("/api/categories/{id}") public CatalogAdministration.Category updateCategory(@PathVariable @Pattern(regexp="[A-Z0-9_-]{1,64}") String id,@Valid @RequestBody UpdateCategory body,HttpServletRequest r){AdminAccess.requireStaff(r);return admin.updateCategory(id,body.name(),body.expectedVersion(),body.active());}
    @GetMapping("/api/admin/products") public List<Product> products(@RequestParam(defaultValue="") @Pattern(regexp="[A-Z0-9_-]{0,64}") String after,@RequestParam(defaultValue="20") @Min(1) @Max(100) int size,HttpServletRequest r){AdminAccess.requireStaff(r);return admin.products(after,size);}
    @GetMapping("/api/admin/products/{sku}") public Product product(@PathVariable @Pattern(regexp="[A-Z0-9_-]{1,64}") String sku,HttpServletRequest r){AdminAccess.requireStaff(r);return admin.product(sku);}
    @PutMapping("/api/products/{sku}") public Product update(@PathVariable @Pattern(regexp="[A-Z0-9_-]{1,64}") String sku,@Valid @RequestBody UpdateProduct body,HttpServletRequest r){AdminAccess.requireStaff(r);return admin.update(sku,body.name(),body.priceMinor(),body.currency(),body.categoryId(),body.expectedVersion());}
    @DeleteMapping("/api/products/{sku}") @ResponseStatus(HttpStatus.NO_CONTENT) public void archive(@PathVariable @Pattern(regexp="[A-Z0-9_-]{1,64}") String sku,@RequestParam @Min(0) long expectedVersion,HttpServletRequest r){AdminAccess.requireStaff(r);admin.archive(sku,expectedVersion);}
    @PostMapping("/api/products/{sku}/stock") public Product stock(@PathVariable @Pattern(regexp="[A-Z0-9_-]{1,64}") String sku,@RequestHeader(value="Idempotency-Key",required=false) String key,@Valid @RequestBody StockAdjustment body,HttpServletRequest r){AdminAccess.requireStaff(r);return admin.adjust((String)r.getAttribute(InternalContextFilter.USER_ATTRIBUTE),key,sku,body.delta(),body.expectedVersion(),body.reason());}
}
