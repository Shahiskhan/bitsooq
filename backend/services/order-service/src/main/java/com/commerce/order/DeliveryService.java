package com.commerce.order;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
public class DeliveryService {
    public record Destination(String countryCode, String regionCode, String city, String area, String postalCode) { }
    public record Option(String id, String zoneCode, String methodCode, String methodName, long feeMinor,
                         String currency, int minDeliveryDays, int maxDeliveryDays, boolean supportsCod) { }
    public record Zone(String id, String zoneCode, String countryCode, String regionCode, String city,
                       String area, String postalPrefix, int priority, boolean active) { }
    public record Rate(String id, String zoneId, String methodCode, String methodName, long feeMinor,
                       String currency, int minDeliveryDays, int maxDeliveryDays, boolean supportsCod, boolean active) { }

    private static final String MATCH = """
            SELECT r.id,z.zone_code,r.method_code,r.method_name,r.fee_minor,r.currency,
                   r.min_delivery_days,r.max_delivery_days,r.supports_cod
              FROM delivery_rate r JOIN delivery_zone z ON z.id=r.zone_id
             WHERE r.active=TRUE AND z.active=TRUE AND r.currency=?
               AND z.country_code=? AND z.region_code=? AND LOWER(z.city)=LOWER(?)
               AND (z.area IS NULL OR LOWER(z.area)=LOWER(?))
               AND (z.postal_prefix IS NULL OR (? IS NOT NULL AND ? LIKE CONCAT(z.postal_prefix,'%')))
            """;

    private final JdbcTemplate db;
    public DeliveryService(JdbcTemplate db) { this.db = db; }

    public List<Option> options(Destination destination, String currency) {
        return db.query(MATCH + " ORDER BY (z.area IS NOT NULL) DESC,(z.postal_prefix IS NOT NULL) DESC,z.priority DESC,r.fee_minor,r.method_code",
                DeliveryService::mapOption,currency,destination.countryCode(),destination.regionCode(),destination.city(),
                destination.area(),destination.postalCode(),destination.postalCode());
    }

    public Option requireRate(String id, Destination destination, String currency) {
        return db.query(MATCH + " AND r.id=? ORDER BY (z.area IS NOT NULL) DESC,(z.postal_prefix IS NOT NULL) DESC LIMIT 1",
                DeliveryService::mapOption,currency,destination.countryCode(),destination.regionCode(),destination.city(),
                destination.area(),destination.postalCode(),destination.postalCode(),id).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"Selected delivery option is unavailable for this address"));
    }

    @Transactional
    public Zone createZone(String code, String country, String region, String city, String area, String postalPrefix, int priority) {
        String id=UUID.randomUUID().toString();
        db.update("INSERT INTO delivery_zone(id,zone_code,country_code,region_code,city,area,postal_prefix,priority) VALUES(?,?,?,?,?,?,?,?)",
                id,code,country,region,city,area,postalPrefix,priority);
        return zone(id);
    }

    @Transactional
    public Rate createRate(String zoneId, String code, String name, long fee, String currency,
                           int minDays, int maxDays, boolean cod) {
        if (fee < 0 || minDays < 0 || maxDays < minDays || maxDays > 90)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid delivery fee or ETA range");
        if (db.queryForObject("SELECT COUNT(*) FROM delivery_zone WHERE id=? AND active=TRUE",Integer.class,zoneId)==0)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Active delivery zone not found");
        String id=UUID.randomUUID().toString();
        db.update("INSERT INTO delivery_rate(id,zone_id,method_code,method_name,fee_minor,currency,min_delivery_days,max_delivery_days,supports_cod) VALUES(?,?,?,?,?,?,?,?,?)",
                id,zoneId,code,name,fee,currency,minDays,maxDays,cod);
        return rate(id);
    }

    @Transactional
    public Zone setZoneActive(String id,boolean active) {
        if(db.update("UPDATE delivery_zone SET active=? WHERE id=?",active,id)!=1)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Delivery zone not found");
        return zone(id);
    }

    @Transactional
    public Rate setRateActive(String id,boolean active) {
        if(db.update("UPDATE delivery_rate SET active=? WHERE id=?",active,id)!=1)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Delivery rate not found");
        return rate(id);
    }

    public List<Zone> zones() {
        return db.query("SELECT id,zone_code,country_code,region_code,city,area,postal_prefix,priority,active FROM delivery_zone ORDER BY country_code,region_code,city,priority DESC,zone_code",
                (rs,n)->new Zone(rs.getString(1),rs.getString(2),rs.getString(3),rs.getString(4),rs.getString(5),rs.getString(6),rs.getString(7),rs.getInt(8),rs.getBoolean(9)));
    }
    public List<Rate> rates() {
        return db.query("SELECT id,zone_id,method_code,method_name,fee_minor,currency,min_delivery_days,max_delivery_days,supports_cod,active FROM delivery_rate ORDER BY zone_id,fee_minor,method_code",
                (rs,n)->new Rate(rs.getString(1),rs.getString(2),rs.getString(3),rs.getString(4),rs.getLong(5),rs.getString(6),rs.getInt(7),rs.getInt(8),rs.getBoolean(9),rs.getBoolean(10)));
    }

    private Zone zone(String id) { return db.query("SELECT id,zone_code,country_code,region_code,city,area,postal_prefix,priority,active FROM delivery_zone WHERE id=?",
            (rs,n)->new Zone(rs.getString(1),rs.getString(2),rs.getString(3),rs.getString(4),rs.getString(5),rs.getString(6),rs.getString(7),rs.getInt(8),rs.getBoolean(9)),id).getFirst(); }
    private Rate rate(String id) { return db.query("SELECT id,zone_id,method_code,method_name,fee_minor,currency,min_delivery_days,max_delivery_days,supports_cod,active FROM delivery_rate WHERE id=?",
            (rs,n)->new Rate(rs.getString(1),rs.getString(2),rs.getString(3),rs.getString(4),rs.getLong(5),rs.getString(6),rs.getInt(7),rs.getInt(8),rs.getBoolean(9),rs.getBoolean(10)),id).getFirst(); }
    private static Option mapOption(java.sql.ResultSet rs,int row) throws java.sql.SQLException {
        return new Option(rs.getString(1),rs.getString(2),rs.getString(3),rs.getString(4),rs.getLong(5),rs.getString(6),rs.getInt(7),rs.getInt(8),rs.getBoolean(9));
    }
}
