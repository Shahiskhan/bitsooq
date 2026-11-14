package com.commerce.payment;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
class PaymentControllerTest {
    @Test void paymentStatusIsOnlyVisibleToItsOwner()throws Exception{
        var source=new DriverManagerDataSource("jdbc:h2:mem:"+UUID.randomUUID()+";MODE=MySQL;DB_CLOSE_DELAY=-1","sa","");
        String schema=new ClassPathResource("db/migration/V1__payment_domain.sql").getContentAsString(StandardCharsets.UTF_8).replace(" DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin","");
        new ResourceDatabasePopulator(new ByteArrayResource(schema.getBytes(StandardCharsets.UTF_8))).execute(source);var db=new JdbcTemplate(source);
        String order=UUID.randomUUID().toString();db.update("INSERT INTO payments(order_id,payment_id,user_id,total_minor,currency,status,created_at) VALUES(?,?,?,?,'USD','AUTHORIZED',?)",order,"sandbox-1","alice",200,Timestamp.from(Instant.now()));
        var controller=new PaymentController(db);assertEquals("AUTHORIZED",controller.read(order,"alice").status());
        assertEquals(404,assertThrows(ResponseStatusException.class,()->controller.read(order,"bob")).getStatusCode().value());
    }
}
