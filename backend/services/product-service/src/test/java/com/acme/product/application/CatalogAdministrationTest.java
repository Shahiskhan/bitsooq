package com.acme.product.application;
import com.acme.product.domain.Product;
import com.acme.product.security.AdminAccess;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class CatalogAdministrationTest {
    JdbcTemplate db;TransactionTemplate tx;CatalogAdministration admin;CatalogService catalog;
    @BeforeEach void setup(){
        var ds=new JdbcDataSource();ds.setURL("jdbc:h2:mem:"+UUID.randomUUID()+";MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=5000");
        new ResourceDatabasePopulator(new ClassPathResource("db/migration/V1__catalog_inventory_and_delivery.sql"),new ClassPathResource("db/migration/V2__catalog_administration.sql")).execute(ds);
        db=new JdbcTemplate(ds);tx=new TransactionTemplate(new DataSourceTransactionManager(ds));catalog=mock(CatalogService.class);admin=new CatalogAdministration(db,catalog,JsonMapper.builder().build());
        db.update("INSERT INTO product(sku,name,price_minor,currency,available_stock) VALUES('A','Initial',200,'USD',5)");
    }
    @Test void duplicateStockRequestReturnsOriginalSnapshotAndChangesOnce(){
        var first=tx.execute(s->admin.adjust("staff","key-1","A",3,0,"Restock"));
        var retry=tx.execute(s->admin.adjust("staff","key-1","A",3,0,"Restock"));
        assertEquals(first,retry);assertEquals(8,admin.product("A").availableStock());assertEquals(1,admin.product("A").version());
        assertThrows(ResponseStatusException.class,()->tx.execute(s->admin.adjust("staff","key-1","A",4,0,"Restock")));
        assertEquals(1,db.queryForObject("SELECT COUNT(*) FROM stock_adjustment",Integer.class));
    }
    @Test void staleOrNegativeAdjustmentRollsBackIdempotencyRow(){
        assertThrows(ResponseStatusException.class,()->tx.execute(s->admin.adjust("staff","stale","A",1,7,"Restock")));
        assertThrows(ResponseStatusException.class,()->tx.execute(s->admin.adjust("staff","negative","A",-6,0,"Audit")));
        assertEquals(5,admin.product("A").availableStock());assertEquals(0,db.queryForObject("SELECT COUNT(*) FROM stock_adjustment",Integer.class));
    }
    @Test void concurrentAdjustmentsCannotOverwriteEachOther()throws Exception{
        var start=new java.util.concurrent.CountDownLatch(1);
        try(var workers=java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()){
            java.util.concurrent.Callable<Boolean> a=()->{start.await();try{tx.execute(status->admin.adjust("staff","race-a","A",1,0,"Count"));return true;}catch(ResponseStatusException conflict){return false;}};
            java.util.concurrent.Callable<Boolean> b=()->{start.await();try{tx.execute(status->admin.adjust("staff","race-b","A",2,0,"Count"));return true;}catch(ResponseStatusException conflict){return false;}};
            var first=workers.submit(a);var second=workers.submit(b);start.countDown();
            assertNotEquals(first.get(30,java.util.concurrent.TimeUnit.SECONDS),second.get(30,java.util.concurrent.TimeUnit.SECONDS));
        }
        assertEquals(1,admin.product("A").version());assertEquals(1,db.queryForObject("SELECT COUNT(*) FROM stock_adjustment",Integer.class));
    }
    @Test void metadataUsesOptimisticVersionAndArchivePreservesRow(){
        tx.execute(s->admin.createCategory("HOME","Home"));
        var updated=tx.execute(s->admin.update("A","Updated",300,"USD","HOME",0));assertEquals("HOME",updated.categoryId());
        assertThrows(ResponseStatusException.class,()->tx.execute(s->admin.update("A","Stale",500,"USD","HOME",0)));
        tx.executeWithoutResult(s->admin.archive("A",1));assertFalse(admin.product("A").active());assertEquals(2,admin.product("A").version());
    }
    @Test void staffRoleMustComeFromVerifiedContextAttribute(){
        var request=new MockHttpServletRequest();request.addHeader("X-Internal-Roles","SUPER_ADMIN");
        assertThrows(ResponseStatusException.class,()->AdminAccess.requireStaff(request));
        request.setAttribute("authenticatedRoles","USER");assertThrows(ResponseStatusException.class,()->AdminAccess.requireStaff(request));
        request.setAttribute("authenticatedRoles","STAFF,USER");assertDoesNotThrow(()->AdminAccess.requireStaff(request));
        request.setAttribute("authenticatedRoles","SUPER_ADMIN,USER");assertDoesNotThrow(()->AdminAccess.requireStaff(request));
    }
}
