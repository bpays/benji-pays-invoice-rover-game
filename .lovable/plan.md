# Fix: Admin page hammering the database

## Diagnosis (from `pg_stat_statements`)

The single most expensive query on your backend is the admin page's full-table `scores` fetch:

- **7,867 calls** of `SELECT id, score, email, city_reached, player_name, created_at, flagged FROM public.scores ... ORDER BY score DESC` — ~39s total exec time, returning every row each call.
- Source: `src/pages/admin/AdminView.tsx`
  - **Line 515**: `setInterval(..., 60000)` auto-refreshes the whole table every minute while admin is open.
  - **Line 124**: initial load + re-runs on filter changes do the same unbounded query.
- With one or more admin tabs left open at events/stations, this drives the database to 100%.

The public leaderboard RPCs (`get_daily_dashboard`, `get_event_dashboard`) are cheap (~2-3ms) and not the problem.

A secondary minor offender: the timezone settings dropdown loads the entire `pg_timezone_names` view (~60k rows × 50 calls).

## Changes

### 1. Stop the admin auto-poll from refetching all scores

In `src/pages/admin/AdminView.tsx`:

- **Remove the 60s `setInterval` at line 513-528** that re-fetches `scores`. Replace with a manual "Refresh" button in the admin header so refreshes are intentional. Keep the existing initial load.
- Alternatively, if live updates are desired, raise the interval to 5 minutes AND change the query to use a lightweight stats RPC (see step 2) instead of pulling rows.

### 2. Add server-side pagination + a stats RPC

The admin currently downloads every score to compute `total / today / active / leads / avg / topScore` client-side. This is the real waste.

- Create a new SECURITY DEFINER RPC `get_admin_stats(p_event_tag text)` that returns the aggregates in a single JSON object (count, today count, active-15-min, distinct emails, avg score, top score/name/city). Returns ~1 row instead of all rows.
- Replace the admin "stats" fetch (line 119-141 `loadStats`, line 124 query, and the polled query at 522) with a call to this RPC.
- For the score list/table view, switch to paginated fetches: add `limit=50&offset=...` to the REST query, plus `order=score.desc`. Already paginated client-side via `PAGE_SIZE` (line 530), so the data was being downloaded entirely for nothing — fetch only the visible page.
- Add a search-mode fetch that uses `ilike` on `player_name`/`email` server-side instead of filtering in JS.

### 3. Stop fetching `email` for list rendering

The list view does not need to display every player email on first load. Drop `email` from the `select=` for the list query; only fetch it when the admin opens a specific row's detail/edit modal. This reduces row size and avoids unnecessary PII transfer.

### 4. Cache the timezone dropdown

In whatever admin component loads `pg_timezone_names` for the leaderboard timezone selector, fetch once on mount and cache in module scope (or hardcode the small list of supported zones — `America/New_York`, `America/Los_Angeles`, `America/Chicago`, `America/Denver`, `Europe/London`, etc.). Avoids repeated 60k-row reads.

### 5. Add an index to support paginated reads (optional)

`CREATE INDEX IF NOT EXISTS scores_event_score_idx ON public.scores (event_tag, score DESC) WHERE flagged = false;`
Speeds up the per-event paginated admin list and the leaderboard RPCs.

## Expected impact

The polled full-table SELECT becomes a single small JSON aggregate every minute (or zero if the poll is removed entirely), and list reads return at most 50 rows instead of every row. Database CPU should drop to near-idle when admin tabs are open.

## Files touched

- `src/pages/admin/AdminView.tsx` — remove/lengthen poll, switch stats to RPC, paginate list query, drop `email` from list select.
- `supabase/migrations/<new>.sql` — add `get_admin_stats` RPC and the optional index.
- Admin timezone selector component (locate during implementation) — cache the timezone list.

No schema-breaking changes; existing data and RLS unaffected.
