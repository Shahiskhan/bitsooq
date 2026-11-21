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
    public record UpdateProduct(@NotBlank @Size(max=200) String name,@Size(max=200) String nameAr,@Size(max=2000) String descriptionEn,@Size(max=2000) String descriptionAr,@Min(1) @Max(1_000_000_000_000L) long priceMinor,@NotNull @Pattern(regexp="USD") String currency,@Pattern(regexp="[A-Z0-9_-]{1,64}") String categoryId,@Min(0) long expectedVersion){}
    public record StockAdjustment(@Min(-1_000_000_000) @Max(1_000_000_000) int delta,@Min(0) long expectedVersion,@NotBlank @Size(max=200) String reason){}
    public record CreateSeller(@NotBlank @Size(max=128) String ownerUserId,@NotBlank @Size(max=160) String displayName,@Size(max=200) String legalName,@NotBlank @Pattern(regexp="[a-z0-9-]{2,180}") String slug,@Email @Size(max=254) String email,@Pattern(regexp="[+0-9() .-]{0,32}") String phone,@NotBlank @Pattern(regexp="[A-Z]{2}") String countryCode,@Size(max=100) String taxRegistrationNumber){}
    public record SellerStatus(@NotBlank @Pattern(regexp="ACTIVE|SUSPENDED|CLOSED|PENDING") String status,@NotBlank @Pattern(regexp="ACTIVE|SUSPENDED|CLOSED|PENDING") String expectedStatus,@Min(0) long expectedVersion){}
    @GetMapping("/api/categories") public List<CatalogAdministration.Category> categories(){return admin.categories();}
    @PostMapping("/api/categories") @ResponseStatus(HttpStatus.CREATED) public CatalogAdministration.Category create(@Valid @RequestBody CreateCategory body,HttpServletRequest r){AdminAccess.requireCatalog(r);return admin.createCategory(body.id(),body.name());}
    @PutMapping("/api/categories/{id}") public CatalogAdministration.Category updateCategory(@PathVariable @Pattern(regexp="[A-Z0-9_-]{1,64}") String id,@Valid @RequestBody UpdateCategory body,HttpServletRequest r){AdminAccess.requireCatalog(r);return admin.updateCategory(id,body.name(),body.expectedVersion(),body.active());}
    @GetMapping("/api/admin/products") public List<Product> products(@RequestParam(defaultValue="") @Pattern(regexp="[A-Z0-9_-]{0,64}") String after,@RequestParam(defaultValue="20") @Min(1) @Max(100) int size,HttpServletRequest r){AdminAccess.requireCatalog(r);return admin.products(after,size);}
    @GetMapping("/api/admin/products/{sku}") public Product product(@PathVariable @Pattern(regexp="[A-Z0-9_-]{1,64}") String sku,HttpServletRequest r){AdminAccess.requireCatalog(r);return admin.product(sku);}
    @GetMapping("/api/admin/sellers") public List<CatalogAdministration.Seller> sellers(@RequestParam(defaultValue="100") @Min(1) @Max(500) int size,HttpServletRequest r){AdminAccess.requireStores(r);return admin.sellers(size);}
    @PostMapping("/api/admin/sellers") @ResponseStatus(HttpStatus.CREATED) public CatalogAdministration.Seller createSeller(@Valid @RequestBody CreateSeller body,HttpServletRequest r){AdminAccess.requireStores(r);return admin.createSeller((String)r.getAttribute(InternalContextFilter.USER_ATTRIBUTE),body.ownerUserId(),body.displayName(),body.legalName(),body.slug(),body.email(),body.phone(),body.countryCode(),body.taxRegistrationNumber());}
    @PatchMapping("/api/admin/sellers/{id}/status") public CatalogAdministration.Seller sellerStatus(@PathVariable @Pattern(regexp="[a-fA-F0-9-]{36}") String id,@Valid @RequestBody SellerStatus body,HttpServletRequest r){AdminAccess.requireStores(r);return admin.changeSellerStatus(id,(String)r.getAttribute(InternalContextFilter.USER_ATTRIBUTE),body.status(),body.expectedStatus(),body.expectedVersion());}
    @PutMapping("/api/products/{sku}") public Product update(@PathVariable @Pattern(regexp="[A-Z0-9_-]{1,64}") String sku,@Valid @RequestBody UpdateProduct body,HttpServletRequest r){AdminAccess.requireCatalog(r);return admin.update(sku,body.name(),body.nameAr(),body.descriptionEn(),body.descriptionAr(),body.priceMinor(),body.currency(),body.categoryId(),body.expectedVersion());}
    @DeleteMapping("/api/products/{sku}") @ResponseStatus(HttpStatus.NO_CONTENT) public void archive(@PathVariable @Pattern(regexp="[A-Z0-9_-]{1,64}") String sku,@RequestParam @Min(0) long expectedVersion,HttpServletRequest r){AdminAccess.requireCatalog(r);admin.archive(sku,expectedVersion);}
    @PostMapping("/api/products/{sku}/stock") public Product stock(@PathVariable @Pattern(regexp="[A-Z0-9_-]{1,64}") String sku,@RequestHeader(value="Idempotency-Key",required=false) String key,@Valid @RequestBody StockAdjustment body,HttpServletRequest r){AdminAccess.requireCatalog(r);return admin.adjust((String)r.getAttribute(InternalContextFilter.USER_ATTRIBUTE),key,sku,body.delta(),body.expectedVersion(),body.reason());}
}
