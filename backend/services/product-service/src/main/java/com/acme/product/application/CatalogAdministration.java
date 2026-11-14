package com.acme.product.application;
import com.acme.product.domain.Product;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;
@Service
public class CatalogAdministration {
    public record Category(String id,String name,long version,boolean active) { }
    public record Seller(String id,String ownerUserId,String displayName,String legalName,String slug,String email,String phone,String countryCode,String taxRegistrationNumber,String status,java.time.Instant createdAt,java.time.Instant updatedAt) { }
    private final JdbcTemplate db; private final CatalogService catalog; private final ObjectMapper json;
    public CatalogAdministration(JdbcTemplate db,CatalogService catalog,ObjectMapper json) {this.db=db;this.catalog=catalog;this.json=json;}
    public List<Category> categories() {return db.query("SELECT id,name,version,active FROM category WHERE active=TRUE ORDER BY id",(rs,n)->new Category(rs.getString(1),rs.getString(2),rs.getLong(3),rs.getBoolean(4)));}
    public Category category(String id) {return db.query("SELECT id,name,version,active FROM category WHERE id=?",(rs,n)->new Category(rs.getString(1),rs.getString(2),rs.getLong(3),rs.getBoolean(4)),id).stream().findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Category not found"));}
    @Transactional public Category createCategory(String id,String name) {db.update("INSERT INTO category(id,name) VALUES(?,?)",id,name);return category(id);}
    @Transactional public Category updateCategory(String id,String name,long version,boolean active) {if(db.update("UPDATE category SET name=?,active=?,version=version+1 WHERE id=? AND version=?",name,active,id,version)!=1)throw conflict();return category(id);}
    public List<Product> products(String after,int size) {return db.query("SELECT * FROM product WHERE sku>? ORDER BY sku LIMIT ?",CatalogService.PRODUCT_MAPPER,after,size);}
    public Product product(String sku) {return db.query("SELECT * FROM product WHERE sku=?",CatalogService.PRODUCT_MAPPER,sku).stream().findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Product not found"));}
    public List<Seller> sellers(int size) {return db.query("SELECT id,owner_user_id,display_name,legal_name,slug,email,phone,country_code,tax_registration_number,status,created_at,updated_at FROM seller ORDER BY created_at DESC,id DESC LIMIT ?",(rs,n)->new Seller(rs.getString(1),rs.getString(2),rs.getString(3),rs.getString(4),rs.getString(5),rs.getString(6),rs.getString(7),rs.getString(8),rs.getString(9),rs.getString(10),rs.getTimestamp(11).toInstant(),rs.getTimestamp(12).toInstant()),size);}
    public Seller seller(String id) {return db.query("SELECT id,owner_user_id,display_name,legal_name,slug,email,phone,country_code,tax_registration_number,status,created_at,updated_at FROM seller WHERE id=?",(rs,n)->new Seller(rs.getString(1),rs.getString(2),rs.getString(3),rs.getString(4),rs.getString(5),rs.getString(6),rs.getString(7),rs.getString(8),rs.getString(9),rs.getString(10),rs.getTimestamp(11).toInstant(),rs.getTimestamp(12).toInstant()),id).stream().findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Seller not found"));}
    @Transactional public Seller createSeller(String owner,String name,String legal,String slug,String email,String phone,String country,String taxNumber) {String id=UUID.randomUUID().toString();db.update("INSERT INTO seller(id,owner_user_id,display_name,legal_name,slug,email,phone,country_code,tax_registration_number,status) VALUES(?,?,?,?,?,?,?,?,?,'PENDING')",id,owner,name,legal,slug,email,phone,country,taxNumber);return seller(id);}
    @Transactional public Seller changeSellerStatus(String id,String status,String expectedStatus) {if(db.update("UPDATE seller SET status=? WHERE id=? AND status=?",status,id,expectedStatus)!=1)throw conflict();return seller(id);}
    @Transactional public Product update(String sku,String name,long price,String currency,String category,long version) {
        requireCategory(category);
        if(db.update("UPDATE product SET name=?,price_minor=?,currency=?,category_id=?,version=version+1 WHERE sku=? AND version=? AND active=TRUE",name,price,currency,category,sku,version)!=1) throw conflict();
        catalog.evictAfterCommit(List.of(sku));return product(sku);
    }
    @Transactional public void archive(String sku,long version) {if(db.update("UPDATE product SET active=FALSE,version=version+1 WHERE sku=? AND version=? AND active=TRUE",sku,version)!=1)throw conflict();catalog.evictAfterCommit(List.of(sku));}
    @Transactional public Product adjust(String actor,String key,String sku,int delta,long version,String reason) {
        if(key==null || !key.matches("[A-Za-z0-9._:-]{1,128}"))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Valid Idempotency-Key required");
        if(delta==0)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Stock delta must be nonzero");
        String fingerprint=hash(sku+"\n"+delta+"\n"+version+"\n"+reason), candidate=UUID.randomUUID().toString();
        // Lock product before the idempotency row to keep inventory lock order uniform.
        var locked=db.query("SELECT * FROM product WHERE sku=? FOR UPDATE",CatalogService.PRODUCT_MAPPER,sku);
        if(locked.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Product not found");
        db.update("INSERT INTO stock_adjustment(id,actor_id,idempotency_key,request_hash,sku,delta,reason) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id",candidate,actor,key,fingerprint,sku,delta,reason);
        var prior=db.queryForMap("SELECT * FROM stock_adjustment WHERE actor_id=? AND idempotency_key=? FOR UPDATE",actor,key);
        if(!fingerprint.equals(prior.get("request_hash")))throw new ResponseStatusException(HttpStatus.CONFLICT,"Idempotency-Key used for another adjustment");
        if(!candidate.equals(prior.get("id")))return json.readValue(prior.get("result_json").toString(),Product.class);
        Product current=locked.getFirst();
        if(!current.active() || current.version()!=version)throw conflict();
        long next=(long)current.availableStock()+delta;
        Long reserved=db.queryForObject("SELECT COALESCE(SUM(ri.quantity),0) FROM reservation_item ri JOIN inventory_reservation r ON r.order_id=ri.order_id WHERE ri.sku=? AND r.status='RESERVED'",Long.class,sku);
        if(next<0 || next+(reserved==null?0:reserved)>1_000_000_000L)throw new ResponseStatusException(HttpStatus.CONFLICT,"Adjustment would violate stock bounds");
        db.update("UPDATE product SET available_stock=?,version=version+1 WHERE sku=?",next,sku);
        Product result=product(sku);
        db.update("UPDATE stock_adjustment SET result_json=? WHERE id=?",json.writeValueAsString(result),candidate);
        catalog.evictAfterCommit(List.of(sku));return result;
    }
    private void requireCategory(String id) {if(id!=null && db.queryForObject("SELECT COUNT(*) FROM category WHERE id=? AND active=TRUE",Integer.class,id)==0)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown active category");}
    private static ResponseStatusException conflict(){return new ResponseStatusException(HttpStatus.CONFLICT,"State changed; reload and retry with current version");}
    private static String hash(String text){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));}catch(java.security.NoSuchAlgorithmException impossible){throw new IllegalStateException(impossible);}}
}
