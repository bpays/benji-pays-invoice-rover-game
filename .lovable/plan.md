

## Plan: Google-Only Login + Invite-Record Model (No Email Sending)

### Summary
1. Remove password-based login entirely — Google SSO only
2. Replace user pre-creation with a lightweight `admin_invites` table
3. On Google sign-in, check invite record, auto-assign role, then MFA
4. If no invite and no existing role: deny access **and sign the user out**
5. No email sending — admins communicate invites manually

### Database Migration

Create `admin_invites` table:

```sql
CREATE TABLE public.admin_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role app_role NOT NULL DEFAULT 'admin',
  invited_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write (but actual operations go through edge function with service role)
CREATE POLICY "Admins can view invites" ON public.admin_invites
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert invites" ON public.admin_invites
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete invites" ON public.admin_invites
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
```

### File Changes

**`public/admin/index.html`**

Login screen:
- Remove email/password inputs, "Sign In" button, "or" divider
- Keep only the Google SSO button
- Remove the "Change Password" screen entirely

Login logic:
- Remove `tryLogin()`, `submitNewPassword()`, `generatePw()` functions
- Remove related Enter-key handlers and session restore for password logins
- Update `handleOAuthSession()`: after domain check, if no `user_roles` entry, check `admin_invites` for matching email. If found, call edge function to claim the invite (assigns role). If neither exists, show "Access denied" and **sign out**.

Invite form:
- Remove "Temporary Password" field and "Generate Password" button
- Keep only: email input + "Invite Admin" button
- Update `inviteAdmin()` to call edge function without password
- Success message: "Invited name@benjipays.com — let them know to sign in with Google at /admin"

Admin list:
- Show both active admins (from `user_roles`) and pending invites (from `admin_invites`) with status labels

**`supabase/functions/admin-invite/index.ts`**

- **invite action**: Insert into `admin_invites` (email + role + invited_by). No user creation, no password. Return success.
- **list action**: Query both `user_roles` (active) and `admin_invites` (pending). Return combined list with status.
- **remove action**: Delete from `user_roles` AND `admin_invites` for the given email/user.
- **New `claim` action**: Called during Google sign-in. Verifies caller's email matches an `admin_invites` record, assigns role in `user_roles`, optionally deletes the invite. Server-side only (service role key).

**Sync**: Copy `public/admin/index.html` to `admin/index.html`

### Login Flow After Changes

```text
Admin clicks "Sign in with Google"
  → Google OAuth (restricted to @benjipays.com)
  → Return to /admin with session
  → Check user_roles for admin role
     ├─ Has role → proceed to MFA
     └─ No role → check admin_invites for email
         ├─ Found → call edge function "claim" → assigns role → proceed to MFA
         └─ Not found → show "Access denied" → sign out
```

### Security
- `admin_invites` protected by RLS (admin-only) + edge function uses service role
- Role assignment only happens server-side in the edge function `claim` action
- Client never writes to `admin_invites` or `user_roles` directly
- Domain validation + invite check + role check + MFA = 4 layers

