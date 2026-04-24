## Goal

Make score data permanent. No admin action (UI or DB) can ever delete a row in `public.scores`. Replace destructive controls with soft-hide ("Remove from leaderboard") via the existing `flagged` flag, which already excludes rows from every public leaderboard RPC.

## What to remove

**Admin UI (`src/pages/admin/AdminView.tsx`)**
- Remove the per-row red "Del" button and its DELETE call (lines ~907–920).
- Remove the entire "Reset event leaderboard" section and the `onResetEvent` handler (lines ~493–529, ~785–798).

**Admin API helper (`src/pages/admin/adminApi.ts`)**
- Drop `'DELETE'` from the `restApi` method union and remove the `if (method === 'DELETE')` branch, so the helper can no longer issue deletes against `scores`.

**Database (migration)**
- `DROP FUNCTION public.reset_event_scores(text);` — removes the only server-side bulk-delete path.
- Drop the existing "Admins can delete scores" RLS policy on `public.scores`.
- Add a `RESTRICTIVE` RLS policy `"No deletes on scores"` for `DELETE` with `USING (false)` for all roles, so even a future admin token cannot delete a score row via PostgREST.
- Leave `admin_invites` / `user_roles` / `submit_rate_buckets` delete policies untouched (admin management and rate-bucket cleanup still need them).

## What to add

**Admin UI**
- Replace the deleted "Del" button with a single **"Remove from leaderboard"** button (uses existing flag PATCH already wired on line ~894). The current Flag/Unflag toggle stays, just relabeled to make intent clear:
  - When `flagged === false`: button label `Remove from leaderboard` (sets `flagged = true`).
  - When `flagged === true`: button label `Restore to leaderboard` (sets `flagged = false`).
- Add a small helper line under the Scores section: "Removed scores stay in the database for audit — they only disappear from public leaderboards."
- Confirm dialog text updated to: "Hide this score from public leaderboards? The row will be kept in the database."

## Why this is safe

- All public leaderboard reads (`get_daily_dashboard`, `get_event_dashboard`, `get_leaderboard`, `get_today_run_count`, `get_event_submission_count`, `get_admin_stats`) already filter `flagged = false`. Flagging a row removes it from every player-visible surface immediately.
- With the new restrictive `DELETE` policy + dropped `reset_event_scores` function, there is no remaining code path — client, edge function, or RPC — that can remove a row from `public.scores`.
- CSV export still includes flagged rows when "Show flagged" is on, preserving full audit access for admins.

## Files touched

- `src/pages/admin/AdminView.tsx` — remove Del button, remove Reset section + handler, relabel flag button, update confirm text.
- `src/pages/admin/adminApi.ts` — narrow `restApi` to `'GET' | 'PATCH' | 'POST'`.
- new migration — drop `reset_event_scores`, drop admin delete policy on `scores`, add restrictive deny-delete policy.

No changes needed to the `submit-score` edge function, leaderboard page, or game runtime.
