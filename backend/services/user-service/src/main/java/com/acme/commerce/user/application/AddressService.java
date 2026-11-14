package com.acme.commerce.user.application;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
public class AddressService {
    public record Address(String id, String addressLabel, String recipientName, String phone,
                          String addressLine1, String addressLine2, String area, String city,
                          String regionCode, String postalCode, String countryCode,
                          String deliveryInstructions, boolean defaultShipping, boolean defaultBilling,
                          Double latitude, Double longitude, Integer locationAccuracyM, long version) { }

    private final JdbcTemplate db;
    public AddressService(JdbcTemplate db) { this.db = db; }

    public List<Address> list(String userId) {
        return db.query("""
                SELECT id,address_label,recipient_name,phone,address_line1,address_line2,area,city,
                       region_code,postal_code,country_code,delivery_instructions,is_default_shipping,
                       is_default_billing,latitude,longitude,location_accuracy_m,version
                  FROM customer_address WHERE user_id=? AND archived=FALSE
                 ORDER BY is_default_shipping DESC,created_at DESC,id
                """, AddressService::map, userId);
    }

    @Transactional
    public Address create(String userId, AddressInput input) {
        boolean first = db.queryForObject("SELECT COUNT(*) FROM customer_address WHERE user_id=? AND archived=FALSE", Integer.class, userId) == 0;
        boolean defaultShipping = input.defaultShipping() || first;
        boolean defaultBilling = input.defaultBilling() || first;
        if (defaultShipping) db.update("UPDATE customer_address SET is_default_shipping=FALSE WHERE user_id=? AND archived=FALSE", userId);
        if (defaultBilling) db.update("UPDATE customer_address SET is_default_billing=FALSE WHERE user_id=? AND archived=FALSE", userId);
        String id = UUID.randomUUID().toString();
        db.update("""
                INSERT INTO customer_address(id,user_id,address_label,recipient_name,phone,address_line1,address_line2,
                  area,city,region_code,postal_code,country_code,delivery_instructions,is_default_shipping,
                  is_default_billing,latitude,longitude,location_accuracy_m,version)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)
                """, id,userId,input.addressLabel(),input.recipientName(),input.phone(),input.addressLine1(),input.addressLine2(),
                input.area(),input.city(),input.regionCode(),input.postalCode(),input.countryCode(),input.deliveryInstructions(),
                defaultShipping,defaultBilling,input.latitude(),input.longitude(),input.locationAccuracyM());
        return get(userId,id);
    }

    @Transactional
    public Address update(String userId, String id, AddressInput input, long expectedVersion) {
        if (input.defaultShipping()) db.update("UPDATE customer_address SET is_default_shipping=FALSE WHERE user_id=? AND archived=FALSE", userId);
        if (input.defaultBilling()) db.update("UPDATE customer_address SET is_default_billing=FALSE WHERE user_id=? AND archived=FALSE", userId);
        int changed = db.update("""
                UPDATE customer_address SET address_label=?,recipient_name=?,phone=?,address_line1=?,address_line2=?,
                  area=?,city=?,region_code=?,postal_code=?,country_code=?,delivery_instructions=?,is_default_shipping=?,
                  is_default_billing=?,latitude=?,longitude=?,location_accuracy_m=?,version=version+1
                WHERE id=? AND user_id=? AND archived=FALSE AND version=?
                """, input.addressLabel(),input.recipientName(),input.phone(),input.addressLine1(),input.addressLine2(),
                input.area(),input.city(),input.regionCode(),input.postalCode(),input.countryCode(),input.deliveryInstructions(),
                input.defaultShipping(),input.defaultBilling(),input.latitude(),input.longitude(),input.locationAccuracyM(),id,userId,expectedVersion);
        if (changed != 1) throw new ResponseStatusException(HttpStatus.CONFLICT, "Address changed or no longer exists; reload and retry");
        return get(userId,id);
    }

    @Transactional
    public void archive(String userId, String id, long expectedVersion) {
        int changed = db.update("""
                UPDATE customer_address SET archived=TRUE,is_default_shipping=FALSE,is_default_billing=FALSE,version=version+1
                 WHERE id=? AND user_id=? AND archived=FALSE AND version=?
                """, id,userId,expectedVersion);
        if (changed != 1) throw new ResponseStatusException(HttpStatus.CONFLICT, "Address changed or no longer exists; reload and retry");
        Integer remaining = db.queryForObject("SELECT COUNT(*) FROM customer_address WHERE user_id=? AND archived=FALSE AND is_default_shipping=TRUE", Integer.class,userId);
        if (remaining == 0) db.update("UPDATE customer_address SET is_default_shipping=TRUE,version=version+1 WHERE id=(SELECT chosen.id FROM (SELECT id FROM customer_address WHERE user_id=? AND archived=FALSE ORDER BY created_at DESC LIMIT 1) chosen)", userId);
        Integer billing = db.queryForObject("SELECT COUNT(*) FROM customer_address WHERE user_id=? AND archived=FALSE AND is_default_billing=TRUE", Integer.class,userId);
        if (billing == 0) db.update("UPDATE customer_address SET is_default_billing=TRUE,version=version+1 WHERE id=(SELECT chosen.id FROM (SELECT id FROM customer_address WHERE user_id=? AND archived=FALSE ORDER BY created_at DESC LIMIT 1) chosen)", userId);
    }

    public Address get(String userId, String id) {
        return db.query("""
                SELECT id,address_label,recipient_name,phone,address_line1,address_line2,area,city,
                       region_code,postal_code,country_code,delivery_instructions,is_default_shipping,
                       is_default_billing,latitude,longitude,location_accuracy_m,version
                  FROM customer_address WHERE id=? AND user_id=? AND archived=FALSE
                """, AddressService::map, id,userId).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Address not found"));
    }

    private static Address map(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        return new Address(rs.getString("id"),rs.getString("address_label"),rs.getString("recipient_name"),rs.getString("phone"),
                rs.getString("address_line1"),rs.getString("address_line2"),rs.getString("area"),rs.getString("city"),
                rs.getString("region_code"),rs.getString("postal_code"),rs.getString("country_code"),rs.getString("delivery_instructions"),
                rs.getBoolean("is_default_shipping"),rs.getBoolean("is_default_billing"),
                decimal(rs.getBigDecimal("latitude")),decimal(rs.getBigDecimal("longitude")),
                rs.getObject("location_accuracy_m") == null ? null : ((Number)rs.getObject("location_accuracy_m")).intValue(),rs.getLong("version"));
    }

    private static Double decimal(java.math.BigDecimal value) { return value == null ? null : value.doubleValue(); }

    public record AddressInput(String addressLabel, String recipientName, String phone, String addressLine1,
                               String addressLine2, String area, String city, String regionCode,
                               String postalCode, String countryCode, String deliveryInstructions,
                               boolean defaultShipping, boolean defaultBilling, Double latitude,
                               Double longitude, Integer locationAccuracyM) { }
}
