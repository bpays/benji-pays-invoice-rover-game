# Harden remaining MFA (aal2) call sites on the admin page

The `inviteEdgeFn` helper already refreshes the session and retries once when the server reports `MFA (aal2) required`. The rest of the admin page does not. Three other call sites can hit the same stale-AAL JWT problem (most often right after MFA verify, or after a long-lived tab where the cached access token still claims `aal1`):

1. **`get_admin_stats` RPC** (`AdminView.tsx` `loadStats`) — the DB function raises `MFA (aal2) required`, but the caller silently swallows the error. Dashboard tiles stay at 0/—.
2. **CSV import** (`AdminView.tsx` import handler) — calls the `admin-import-scores` edge function directly with no refresh+retry.
3. **`restApi` PostgREST helper** (`adminApi.ts`) — used for scores, settings, events. If any RLS policy ever inspects the `aal` claim it would silently return `null`. Lower priority but easy to harden.

## What to change

### 1. Add a shared "ensure aal2 token" helper in `adminApi.ts`
A small utility that reads the current session, decodes the JWT `aal` claim, and if it is not `aal2` calls `supabase.auth.refreshSession()` once. Returns the (possibly refreshed) access token.

### 2. Use it in `loadStats`
- Call the helper before `supabase.rpc('get_admin_stats', …)`.
- Surface RPC errors with a toast (`toastMsg('Stats failed: …', 'err')`) instead of silently returning, so future regressions are visible.
- If the RPC still returns an MFA error, refresh + retry once (mirrors `inviteEdgeFn`).

### 3. Refactor CSV import to reuse the same retry pattern
Wrap the `admin-import-scores` POST in a small local helper that:
- Sends the request with the current access token.
- On `403 MFA (aal2) required`, refreshes the session and retries once.
- Returns the final JSON + status.

### 4. Light hardening for `restApi`
Have `restApi` reuse the same "ensure aal2 token" helper before issuing the request. No retry logic needed for PostgREST today (no RLS uses the aal claim), but this keeps the token fresh for the rare case where the cached token is still `aal1`.

### 5. No edge function changes
`admin-invite` and `admin-import-scores` already correctly require `aal2` and return a clear error. The fix is purely client-side resilience.

## Files touched

- `src/pages/admin/adminApi.ts` — add `ensureAal2Token()` helper; have `restApi` and `inviteEdgeFn` use it; export a generic `callEdgeFnWithMfaRetry()` used by the CSV importer.
- `src/pages/admin/AdminView.tsx` — `loadStats` surfaces errors and refresh-retries; CSV import handler uses the new helper.

## Out of scope
- Any UI/UX redesign of the admin page.
- Game/loading-screen behaviour.
- Database or edge function logic changes.
