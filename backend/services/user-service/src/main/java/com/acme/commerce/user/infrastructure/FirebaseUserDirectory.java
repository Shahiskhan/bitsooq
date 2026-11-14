package com.acme.commerce.user.infrastructure;
import com.acme.commerce.user.application.UserDirectory;
import com.acme.commerce.user.domain.RolePolicy;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.AuthErrorCode;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.UserRecord;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
@Component
public class FirebaseUserDirectory implements UserDirectory {
    private final boolean enabled;
    private final String project;
    private volatile FirebaseAuth client;
    public FirebaseUserDirectory(@Value("${FIREBASE_ADMIN_ENABLED:false}") boolean enabled,@Value("${FIREBASE_PROJECT_ID:}") String project) {
        this.enabled=enabled; this.project=project;
    }
    private synchronized FirebaseAuth auth() {
        if(!enabled || project.isBlank()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Firebase Admin is not configured. Enable the server credential overlay to manage users.");
        if(client!=null) return client;
        try {
            var options=FirebaseOptions.builder().setProjectId(project).setCredentials(GoogleCredentials.getApplicationDefault())
                    .setConnectTimeout(2000).setReadTimeout(5000).build();
            client=FirebaseAuth.getInstance(FirebaseApp.initializeApp(options,"commerce-user-directory"));
            return client;
        } catch(Exception unavailable) { throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Firebase Admin credentials could not be initialized"); }
    }
    @Override public DirectoryUser get(String uid) {
        try { return view(auth().getUser(uid)); }
        catch(FirebaseAuthException failure) { throw translate(failure); }
    }
    @Override public DirectoryPage list(String cursor,int size) {
        try {
            var page=auth().listUsers(cursor==null || cursor.isBlank()?null:cursor,size);
            var users=new ArrayList<DirectoryUser>(); for(var record:page.getValues()) users.add(view(record));
            return new DirectoryPage(List.copyOf(users),page.hasNextPage()?page.getNextPageToken():null);
        } catch(FirebaseAuthException failure) { throw translate(failure); }
    }
    @Override public void setRoles(String uid,List<String> roles) {
        try {
            var current=auth().getUser(uid);
            var claims=new HashMap<String,Object>(current.getCustomClaims());
            claims.remove("admin"); // Remove legacy elevation before writing canonical roles.
            claims.put("roles",RolePolicy.normalize(roles));
            auth().setCustomUserClaims(uid,claims);
        } catch(FirebaseAuthException failure) { throw translate(failure); }
    }
    private static DirectoryUser view(UserRecord user) {
        return new DirectoryUser(user.getUid(),user.getEmail(),user.getDisplayName(),user.isDisabled(),RolePolicy.fromClaims(user.getCustomClaims()));
    }
    private static ResponseStatusException translate(FirebaseAuthException failure) {
        if(failure.getAuthErrorCode()==AuthErrorCode.USER_NOT_FOUND) return new ResponseStatusException(HttpStatus.NOT_FOUND,"Firebase user not found");
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Firebase user administration is temporarily unavailable");
    }
}
