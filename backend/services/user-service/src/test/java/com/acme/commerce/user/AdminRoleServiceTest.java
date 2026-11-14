package com.acme.commerce.user;
import com.acme.commerce.user.application.AdminRoleService;
import com.acme.commerce.user.application.UserDirectory;
import com.acme.commerce.user.domain.RolePolicy;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
class AdminRoleServiceTest {
    private JdbcTemplate jdbc;
    private FakeDirectory directory;
    private AdminRoleService roles;
    private static final Set<String> SUPER=Set.of("USER","SUPER_ADMIN");
    @BeforeEach void setup() throws Exception {
        var data=new DriverManagerDataSource("jdbc:h2:mem:roles"+UUID.randomUUID()+";MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1","sa","");
        jdbc=new JdbcTemplate(data);
        try(var input=new ClassPathResource("db/migration/V2__role_administration.sql").getInputStream()) {
            String script=new String(input.readAllBytes(),StandardCharsets.UTF_8).replace(" DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin","");
            for(String statement:script.split(";")) if(!statement.isBlank()) jdbc.execute(statement);
        }
        directory=new FakeDirectory();
        directory.users.put("founder",new UserDirectory.DirectoryUser("founder","founder@example.test","Founder",false,List.of("USER","SUPER_ADMIN")));
        directory.users.put("staff",new UserDirectory.DirectoryUser("staff","staff@example.test","Staff",false,List.of("USER")));
        roles=new AdminRoleService(directory,jdbc,new DataSourceTransactionManager(data));
    }
    private AdminRoleService.RolesView update(List<String> desired,String key) {
        return roles.update("founder",SUPER,"staff",desired,key,UUID.randomUUID().toString());
    }
    @Test void onlySuperAdminCanManageRoles() {
        assertThatThrownBy(()->roles.list("staff",Set.of("USER","STAFF"),null,20)).isInstanceOf(ResponseStatusException.class).satisfies(error->assertThat(((ResponseStatusException)error).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
        assertThat(directory.writes).isZero();
    }
    @Test void successfulChangeIsAuditedAndDuplicateRequestDoesNotRepeatSideEffect() {
        var first=update(List.of("STAFF"),"same-key");
        var again=update(List.of("STAFF"),"same-key");
        assertThat(again).isEqualTo(first);
        assertThat(first.roles()).containsExactly("STAFF","USER");
        assertThat(directory.writes).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT state FROM role_change_request",String.class)).isEqualTo("APPLIED");
        assertThat(jdbc.queryForObject("SELECT previous_roles FROM role_change_request",String.class)).isEqualTo("USER");
    }
    @Test void changedPayloadCannotReuseIdempotencyKey() {
        update(List.of("STAFF"),"same-key");
        assertThatThrownBy(()->update(List.of("USER"),"same-key")).isInstanceOf(ResponseStatusException.class);
        assertThat(directory.users.get("staff").roles()).contains("STAFF");
        assertThat(directory.writes).isEqualTo(1);
    }
    @Test void unknownRemoteOutcomeIsRecordedAndSameDesiredStateCanBeReconciled() {
        directory.failAfterWrite=true;
        assertThatThrownBy(()->update(List.of("STAFF"),"retry-key")).isInstanceOf(ResponseStatusException.class);
        assertThat(jdbc.queryForObject("SELECT state FROM role_change_request",String.class)).isEqualTo("UNKNOWN");
        assertThat(directory.users.get("staff").roles()).contains("STAFF");
        directory.failAfterWrite=false;
        assertThat(update(List.of("STAFF"),"retry-key").roles()).contains("STAFF");
        assertThat(jdbc.queryForObject("SELECT state FROM role_change_request",String.class)).isEqualTo("APPLIED");
    }
    @Test void oldSuperAdminTokenCannotBypassCurrentFirebaseDemotion() {
        directory.users.put("founder",new UserDirectory.DirectoryUser("founder",null,null,false,List.of("USER","STAFF")));
        assertThatThrownBy(()->update(List.of("SUPER_ADMIN"),"stale-token")).isInstanceOf(ResponseStatusException.class);
        assertThat(directory.writes).isZero();
    }
    @Test void superAdminCannotRemoveOwnRecoveryAccess() {
        assertThatThrownBy(()->roles.update("founder",SUPER,"founder",List.of("USER"),"self",UUID.randomUUID().toString())).isInstanceOf(ResponseStatusException.class);
        assertThat(directory.writes).isZero();
    }
    @Test void unknownRoleCannotBeGrantedAndLegacyAdminMapsOnlyToStaff() {
        assertThatThrownBy(()->update(List.of("ROOT"),"bad-role")).isInstanceOf(ResponseStatusException.class);
        assertThat(RolePolicy.fromClaims(Map.of("admin",true))).containsExactly("STAFF","USER");
        assertThat(RolePolicy.fromClaims(Map.of("roles",List.of("ADMIN")))).doesNotContain("SUPER_ADMIN");
    }
    private static class FakeDirectory implements UserDirectory {
        final Map<String,DirectoryUser> users=new HashMap<>(); int writes; boolean failAfterWrite;
        @Override public DirectoryUser get(String uid) { if(!users.containsKey(uid)) throw new ResponseStatusException(HttpStatus.NOT_FOUND); return users.get(uid); }
        @Override public DirectoryPage list(String cursor,int size) { return new DirectoryPage(users.values().stream().limit(size).toList(),null); }
        @Override public void setRoles(String uid,List<String> desired) {
            var current=get(uid); writes++; users.put(uid,new DirectoryUser(uid,current.email(),current.displayName(),current.disabled(),desired));
            if(failAfterWrite) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Lost provider response");
        }
    }
}
