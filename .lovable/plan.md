

## Plan: Secure CSV Export with Email Addresses

### Problem
The CSV export already includes an "Email" column, but when viewing the **Daily** leaderboard, emails are stripped out (set to `null` on line 583) because the daily view uses the `get_daily_leaderboard` RPC, which doesn't return email addresses.

The **Event** (all-time) view already fetches emails securely from the `scores` table using the admin's auth token and RLS.

### Solution
When in **daily** board mode, instead of using the public RPC (which omits emails), query the `scores` table directly with a date filter — the same way the event mode works. Since the `scores` table has admin-only RLS on SELECT, this is already secure.

### Changes

**File: `public/admin/index.html`**
- Modify the daily-mode branch of `loadScores()` to query the `scores` table directly (via the authenticated Supabase REST API) with a `created_at` filter for today (ET timezone), instead of calling the `get_daily_leaderboard` RPC
- This ensures `allScores` always contains email addresses regardless of board mode
- Remove the `email:null` override on line 583

No database changes or new edge functions needed — the existing admin-only RLS on the `scores` table already secures this.

