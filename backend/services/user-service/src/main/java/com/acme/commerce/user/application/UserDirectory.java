package com.acme.commerce.user.application;
import java.util.List;
/** Credential/claim administration boundary. This service never verifies Firebase JWTs. */
public interface UserDirectory {
    record DirectoryUser(String uid,String email,String displayName,boolean disabled,List<String> roles) {}
    record DirectoryPage(List<DirectoryUser> users,String nextCursor) {}
    DirectoryUser get(String uid);
    DirectoryPage list(String cursor,int size);
    void setRoles(String uid,List<String> roles);
}
