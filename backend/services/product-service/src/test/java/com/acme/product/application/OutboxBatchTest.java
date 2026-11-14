package com.acme.product.application;
import com.acme.product.messaging.Outbox;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
class OutboxBatchTest {
    @Test void batchPublishesMultipleEventsAndOnlyMarksAcknowledgedRows(){
        var ds=new JdbcDataSource();ds.setURL("jdbc:h2:mem:"+UUID.randomUUID()+";MODE=MySQL;DB_CLOSE_DELAY=-1");
        new ResourceDatabasePopulator(new ClassPathResource("db/migration/V1__catalog_inventory_and_delivery.sql")).execute(ds);var db=new JdbcTemplate(ds);
        var tx=new TransactionTemplate(new DataSourceTransactionManager(ds));
        for(int i=0;i<3;i++)db.update("INSERT INTO outbox(event_id,aggregate_id,payload) VALUES(?,?,?)",UUID.randomUUID().toString(),"order-"+i,"event-"+i);
        @SuppressWarnings("unchecked") KafkaTemplate<String,String> kafka=mock(KafkaTemplate.class);
        when(kafka.send(eq("commerce.saga.v1"),anyString(),anyString())).thenAnswer(call->{
            if(call.getArgument(2).equals("event-1"))return CompletableFuture.<SendResult<String,String>>failedFuture(new IllegalStateException("Broker uncertainty"));
            return CompletableFuture.<SendResult<String,String>>completedFuture(null);
        });
        var outbox=new Outbox(db,JsonMapper.builder().build(),kafka,"commerce.saga.v1");
        tx.executeWithoutResult(s->outbox.publishOne());
        verify(kafka,times(3)).send(eq("commerce.saga.v1"),anyString(),anyString());
        assertEquals(2,db.queryForObject("SELECT COUNT(*) FROM outbox WHERE published_at IS NOT NULL",Integer.class));
        assertEquals("event-1",db.queryForObject("SELECT payload FROM outbox WHERE published_at IS NULL",String.class));
    }
}
