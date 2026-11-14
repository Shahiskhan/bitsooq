package com.acme.product.application;

import com.acme.product.domain.Product;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.List;
import java.util.Collection;
import java.util.Optional;

@Service
public class CatalogService {
    public static final RowMapper<Product> PRODUCT_MAPPER = (rs, row) -> new Product(rs.getString("sku"), rs.getString("name"), rs.getString("name_ar"), rs.getString("description_en"), rs.getString("description_ar"), rs.getLong("price_minor"), rs.getString("currency"), rs.getInt("available_stock"), rs.getString("category_id"), rs.getLong("version"), rs.getBoolean("active"));
    private final JdbcTemplate jdbc;
    private final StringRedisTemplate redis;
    private final ObjectMapper json;
    public CatalogService(JdbcTemplate jdbc, StringRedisTemplate redis, ObjectMapper json) { this.jdbc = jdbc; this.redis = redis; this.json = json; }
    public Optional<Product> find(String sku) {
        try {
            String cached = redis.opsForValue().get(key(sku));
            if (cached != null) return Optional.of(json.readValue(cached, Product.class));
        } catch (RuntimeException unavailable) { /* Cache reads are an optional optimization. */ }
        var product = jdbc.query("SELECT * FROM product WHERE sku = ? AND active=TRUE", PRODUCT_MAPPER, sku).stream().findFirst();
        product.ifPresent(value -> {
            try { redis.opsForValue().set(key(sku), json.writeValueAsString(value), Duration.ofSeconds(30)); }
            catch (RuntimeException unavailable) { /* Authoritative read succeeded. */ }
        });
        return product;
    }
    public List<Product> list(String after, int size) {
        return jdbc.query("SELECT * FROM product WHERE active=TRUE AND sku > ? ORDER BY sku LIMIT ?", PRODUCT_MAPPER, after, size);
    }
    public boolean allExist(Collection<String> skus) {
        if (skus.isEmpty()) return true;
        String placeholders = String.join(",", java.util.Collections.nCopies(skus.size(), "?"));
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM product WHERE active=TRUE AND sku IN (" + placeholders + ")", Integer.class, skus.toArray());
        return count != null && count == skus.size();
    }
    @Transactional
    public Product create(Product product) {
        requireCategory(product.categoryId());
        jdbc.update("INSERT INTO product(sku,name,name_ar,description_en,description_ar,price_minor,currency,available_stock,category_id) VALUES (?,?,?,?,?,?,?,?,?)", product.sku(), product.name(), product.nameAr(), product.descriptionEn(), product.descriptionAr(), product.priceMinor(), product.currency(), product.availableStock(), product.categoryId());
        evictAfterCommit(List.of(product.sku()));
        return product;
    }
    private void requireCategory(String categoryId) {
        if(categoryId!=null && jdbc.queryForObject("SELECT COUNT(*) FROM category WHERE id=? AND active=TRUE",Integer.class,categoryId)==0) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"Unknown active category");
    }
    public void evictAfterCommit(List<String> skus) {
        Runnable eviction = () -> {
            try { redis.delete(skus.stream().map(CatalogService::key).toList()); }
            catch (RuntimeException unavailable) { /* Bounded stale catalog reads; checkout always locks MySQL rows. */ }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() { @Override public void afterCommit() { eviction.run(); } });
        } else eviction.run();
    }
    private static String key(String sku) { return "catalog:v2:" + sku; }
}
