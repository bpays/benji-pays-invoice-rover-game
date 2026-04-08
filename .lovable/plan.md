

## Plan: Add Google Sign-In to Admin Panel

### Overview
Add a "Sign in with Google" button to the admin login screen. When an admin clicks it, they'll authenticate via Google OAuth (restricted to @benjipays.com accounts), then go through the same admin role check and MFA flow as password-based login.

### How It Works
Since Google Auth is already enabled in your authentication settings, we just need to wire up the button in the admin panel.

### Steps

1. **Install the Lovable Cloud auth module** — Use the Configure Social Auth tool to generate the `lovable` integration module that handles Google OAuth.

2. **Add Google Sign-In button to the admin login screen** (`public/admin/index.html` + `game/index.html` mirror)
   - Add a "Sign in with Google" button below the existing email/password form
   - Style it to match the existing login UI
   - Add a visual divider ("— or —") between the two login methods

3. **Implement the Google sign-in handler**
   - On click, call `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + '/admin', extraParams: { hd: 'benjipays.com' } })` to restrict to the benjipays.com domain
   - Handle the OAuth redirect callback on the admin page load — detect when returning from Google, check the session, validate the admin role in `user_roles`, then proceed through the existing MFA flow

4. **Handle the post-redirect session**
   - On admin page load, check for an active Supabase session (from the OAuth redirect)
   - If found, validate the user's email domain is @benjipays.com
   - Check they have an admin role in `user_roles`
   - Route them through the existing MFA enrollment/verification flow

5. **Sync files** — Copy updated `public/admin/index.html` content to keep files in sync.

### Technical Details
- The `hd: 'benjipays.com'` parameter tells Google to only show @benjipays.com accounts in the picker
- Server-side domain validation is still performed as a security backstop
- The existing MFA flow (TOTP enrollment + verification) applies identically after Google sign-in
- Users must still be pre-invited (exist in `user_roles` with admin role) — Google sign-in alone won't grant access

