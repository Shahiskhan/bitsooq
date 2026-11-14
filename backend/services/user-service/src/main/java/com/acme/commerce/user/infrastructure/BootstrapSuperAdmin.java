package com.acme.commerce.user.infrastructure;
import java.util.List;
/** Explicit operator CLI only. No HTTP endpoint or default account can bootstrap privileges. */
public final class BootstrapSuperAdmin {
    public static void main(String[] args) {
        if(args.length!=2) throw new IllegalArgumentException("Usage: BootstrapSuperAdmin <FirebaseProjectId> <existingFirebaseUid>");
        var directory=new FirebaseUserDirectory(true,args[0]);
        var target=directory.get(args[1]);
        if(target.disabled()) throw new IllegalStateException("Cannot bootstrap a disabled Firebase user");
        directory.setRoles(target.uid(),List.of("USER","SUPER_ADMIN"));
        System.out.println("Super Admin claim applied to the requested existing UID. Sign out and sign in to refresh claims.");
    }
}
