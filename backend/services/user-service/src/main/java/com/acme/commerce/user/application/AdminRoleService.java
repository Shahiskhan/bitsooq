package com.acme.commerce.user.application;
import com.acme.commerce.user.domain.RolePolicy;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Semaphore;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
@Service
public class AdminRoleService {
    public record RolesView(String uid,List<String> roles) {}
    private record Result(RolesView view,ResponseStatusException failure) {}
    private final UserDirectory directory;
    private final JdbcTemplate db;
    private final TransactionTemplate tx;
    private final Semaphore administration=new Semaphore(2);
    public AdminRoleService(UserDirectory directory,JdbcTemplate db,PlatformTransactionManager manager) {
        this.directory=directory; this.db=db; this.tx=new TransactionTemplate(manager); this.tx.setTimeout(25);
    }
    private void authorize(String actor,Set<String> trustedRoles) {
        RolePolicy.requireSuper(trustedRoles);
        var live=directory.get(actor);
        if(live.disabled() || !live.roles().contains("SUPER_ADMIN")) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Current Firebase account is not a Super Admin");
    }
    public UserDirectory.DirectoryPage list(String actor,Set<String> roles,String cursor,int size) {
        RolePolicy.requireSuper(roles);
        if(!administration.tryAcquire()) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"User administration is busy; retry shortly");
        try { authorize(actor,roles); return directory.list(cursor,size); } finally { administration.release(); }
    }
    public RolesView get(String actor,Set<String> roles,String target) {
        RolePolicy.requireSuper(roles);
        if(!administration.tryAcquire()) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"User administration is busy; retry shortly");
        try { authorize(actor,roles); var user=directory.get(target); return new RolesView(user.uid(),user.roles()); } finally { administration.release(); }
    }
    public RolesView update(String actor,Set<String> trustedRoles,String target,List<String> requested,String key,String requestId) {
        RolePolicy.requireSuper(trustedRoles);
        List<String> desired=RolePolicy.normalize(requested);
        RolePolicy.preventSelfDemotion(actor,target,desired);
        if(key==null || !key.matches("[A-Za-z0-9._:-]{1,128}")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"A valid Idempotency-Key is required");
        if(!administration.tryAcquire()) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"User administration is busy; retry shortly");
        try {
            authorize(actor,trustedRoles);
            String roles=String.join(",",desired), candidate=UUID.randomUUID().toString();
            db.update("INSERT INTO role_change_request(id,actor_uid,target_uid,idempotency_key,desired_roles,state,request_id,created_at) VALUES(?,?,?,?,?,'PENDING',?,?) ON DUPLICATE KEY UPDATE id=id",
                    candidate,actor,target,key,roles,requestId,Timestamp.from(Instant.now()));
            // Rare privileged writes serialize per target, with bounded provider timeouts and pool bulkhead.
            Result result=tx.execute(status->{
                db.update("INSERT INTO role_target_lock(uid) VALUES(?) ON DUPLICATE KEY UPDATE uid=uid",target);
                db.queryForObject("SELECT uid FROM role_target_lock WHERE uid=? FOR UPDATE",String.class,target);
                Map<String,Object> row=db.queryForMap("SELECT * FROM role_change_request WHERE actor_uid=? AND idempotency_key=? FOR UPDATE",actor,key);
                if(!target.equals(row.get("target_uid")) || !roles.equals(row.get("desired_roles"))) throw new ResponseStatusException(HttpStatus.CONFLICT,"Idempotency-Key was used for a different role change");
                var view=new RolesView(target,desired);
                if("APPLIED".equals(row.get("state"))) return new Result(view,null);
                try {
                    var before=directory.get(target);
                    db.update("UPDATE role_change_request SET previous_roles=? WHERE id=?",String.join(",",before.roles()),row.get("id"));
                    directory.setRoles(target,desired);
                    db.update("UPDATE role_change_request SET state='APPLIED',completed_at=? WHERE id=?",Timestamp.from(Instant.now()),row.get("id"));
                    return new Result(view,null);
                } catch(ResponseStatusException unavailable) {
                    // A remote write might have succeeded despite a lost response. Retrying this same
                    // absolute desired state is safe; never report success without an acknowledged write.
                    db.update("UPDATE role_change_request SET state='UNKNOWN' WHERE id=?",row.get("id"));
                    return new Result(null,unavailable);
                }
            });
            if(result.failure()!=null) throw result.failure();
            return result.view();
        } finally { administration.release(); }
    }
}
