# Fix Leaderboard Scroll + Admin List "MFA required" Error

## Issue 1: Leaderboard not scrollable

**Root cause:** `src/styles/leaderboard.css` line 3 sets `html, body { width:100%; min-height:100% }` but there is a competing rule in `src/index.css` that sets `overflow-y: auto` on **both** `html` and `body`. When both elements are set to `overflow:auto`, browsers commonly only scroll the html container, and any leftover transform/positioning from the previous game route can suppress that scroll.

Additionally, when the user navigates SPA-style from `/` (game) → `/leaderboard`, the GameView cleanup runs but if a user lands on `/leaderboard` directly the `bg` fixed background plus `min-height:100%` (not `min-height:100vh`) on body can cause body to size to viewport only, hiding the overflow.

**Fix in `src/styles/leaderboard.css`:**
- Scope an explicit scroll container under `html.benji-leaderboard-page`:
  - `html.benji-leaderboard-page, html.benji-leaderboard-page body { height:auto; min-height:100vh; overflow-y:auto; overflow-x:hidden; }`
- Ensure `.page` doesn't constrain height (already fine — only sets `padding-bottom`).

This guarantees window-level vertical scroll on the leaderboard route without affecting the game route (which uses `html.benji-game-page` with `overflow:hidden`).

## Issue 2: "Could not load admins: MFA (aal2) required"

**Root cause:** The `admin-invite` edge function requires `aal2` for the `list` action. The error means the JWT sent by `inviteEdgeFn` to the function does **not** carry `aal: "aal2"`. This happens when:

1. The user signed in via Google and the bootstrap flow at `AdminView.tsx` lines 360–402 found a verified TOTP factor and called `enterApp()` directly when `aal.currentLevel === 'aal2'` — but that branch is only taken when the session ALREADY has aal2. If the access token was refreshed at any point, gotrue mints a new access_token preserving aal — but if the verify path (lines 471–480) was never run on this device for the current session and only `getAuthenticatorAssuranceLevel` reported aal2 (which compares enrolled factors), the token itself may still be aal1.

2. More commonly: `loadAdminList` runs immediately inside `enterApp()` (line 251) right after MFA verify. The `supabase.auth.getSession()` call in `inviteEdgeFn` reads the in-memory session, but the new aal2 access_token from `mfa.verify` may not yet be persisted to the client cache, so the **previous aal1 token** is sent.

**Fix:**

**A. In `src/pages/admin/AdminView.tsx` `verifyMfa()` (and `verifyEnrollment()`):**
After `mfa.verify` succeeds, force a session refresh so the new aal2 token is loaded before `enterApp()`:
```ts
await supabase.auth.refreshSession();
await enterApp();
```

**B. In `src/pages/admin/AdminView.tsx` auto-restore branch (around line 389):**
Before calling `enterApp()` on the `aal2` path, also refresh the session to ensure the freshest token is in memory:
```ts
} else if (aal && aal.currentLevel === 'aal2') {
  await supabase.auth.refreshSession();
  await enterApp();
  return;
}
```

**C. Defensive fallback in `src/pages/admin/adminApi.ts` `inviteEdgeFn`:**
If the response indicates `MFA (aal2) required`, automatically call `supabase.auth.refreshSession()` once and retry the request. This handles edge cases where the cached token is stale without forcing a re-login:
```ts
async function inviteEdgeFnWithRetry(body) {
  let res = await callOnce(body);
  if (res?.error === 'MFA (aal2) required') {
    await supabase.auth.refreshSession();
    res = await callOnce(body);
  }
  return res;
}
```

## Files to change

- `src/styles/leaderboard.css` — add explicit scroll rules under `html.benji-leaderboard-page`.
- `src/pages/admin/AdminView.tsx` — call `supabase.auth.refreshSession()` before `enterApp()` after MFA verify and in the aal2 auto-restore branch.
- `src/pages/admin/adminApi.ts` — retry once after refresh on `MFA (aal2) required` response.

## Out of scope / preserved

- No database changes.
- No edge function changes (the aal2 check at the server stays as-is; it is correct security).
- No auth flow changes — Google + TOTP MFA stays intact.
- No data is deleted.
