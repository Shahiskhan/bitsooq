package com.commerce.order;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
class OrderQueriesTest {
    JdbcTemplate db;OrderQueries queries;
    @BeforeEach void setup()throws Exception{
        var source=new DriverManagerDataSource("jdbc:h2:mem:"+UUID.randomUUID()+";MODE=MySQL;DB_CLOSE_DELAY=-1","sa","");
        String schema=new ClassPathResource("db/migration/V1__order_domain.sql").getContentAsString(StandardCharsets.UTF_8).replace(" DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin","");
        String paymentRefs=new ClassPathResource("db/migration/V2__payment_references.sql").getContentAsString(StandardCharsets.UTF_8);
        new ResourceDatabasePopulator(new ByteArrayResource((schema+"\n"+paymentRefs).getBytes(StandardCharsets.UTF_8))).execute(source);db=new JdbcTemplate(source);queries=new OrderQueries(db);
    }
    String add(String user,String state,long amount){String id=UUID.randomUUID().toString();db.update("INSERT INTO orders(id,user_id,idempotency_key,request_hash,status,total_minor,currency,created_at,expires_at) VALUES(?,?,?,?,?,?, 'USD',?,?)",id,user,id,"hash",state,amount,Timestamp.from(Instant.parse("2026-10-27T00:00:00Z")),Timestamp.from(Instant.parse("2026-10-27T01:00:00Z")));return id;}
    @Test void cursorHasNoDuplicatesAndCustomerCannotListOtherUsers(){
        add("alice","PENDING",100);add("alice","CONFIRMED",200);add("bob","CONFIRMED",300);
        var first=queries.list("alice","",1,null);var second=queries.list("alice",first.nextCursor(),1,null);
        assertEquals(1,first.items().size());assertEquals(1,second.items().size());assertNotEquals(first.items().getFirst().orderId(),second.items().getFirst().orderId());assertNull(second.nextCursor());
        assertTrue(first.items().stream().allMatch(i->i.userId().equals("alice")));
        assertThrows(ResponseStatusException.class,()->queries.list("alice","not-a-cursor",10,null));
    }
    @Test void analyticsIncludesOnlyConfirmedRevenueAndRequiresSuperAdmin(){
        add("alice","PENDING",100);add("alice","CONFIRMED",200);add("bob","CANCELLED",300);
        var stats=queries.analytics();assertEquals(3,stats.totalOrders());assertEquals(200,stats.confirmedRevenueMinor());
        var controller=new AdminOrderController(queries);var r=new MockHttpServletRequest();r.addHeader("X-Internal-Roles","STAFF,USER");
        assertThrows(ResponseStatusException.class,()->controller.analytics(r));assertEquals(3,controller.orders(r,"",20,null).items().size());
        var superAdmin=new MockHttpServletRequest();superAdmin.addHeader("X-Internal-Roles","SUPER_ADMIN,USER");assertEquals(3,controller.analytics(superAdmin).totalOrders());
    }
}
