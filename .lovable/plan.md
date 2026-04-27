## Goal

Tie the lead-capture (run start) to the final game-over submission via a server-issued `run_id`, persist a server-computed `duration_s` on each score, and surface that duration on the admin page. Treat the timing as analytics/review signal — never block a score on it.

## Anti-cheat scope

This is a **data-collection foundation**, not full anti-cheat. It gives us a trustworthy server-side start/end timestamp pair we can later use to flag impossible runs (e.g. 60k score in 10 seconds). It does not prevent a determined attacker from idling a run and posting a fake score. Stronger measures (HMAC-signed run tokens, periodic score deltas, min score/sec ratios) are out of scope here and can build on top of this later.

## Schema changes (migration)

Add to `public.scores`:
- `run_id uuid` — nullable, indexed.
- `duration_s integer` — nullable.

New table `public.game_runs`:

```text
game_runs
  id           uuid pk default gen_random_uuid()
  started_at   timestamptz not null default now()
  ended_at     timestamptz
  player_name  text
  email        text
  event_tag    text
```

RLS: enabled, deny-all for `public` (only service-role inside edge functions touches it).

Indexes: `scores(run_id)`, `game_runs(started_at desc)`. Hot leaderboard query path is unchanged.

## New edge function: `start-run`

`POST /functions/v1/start-run`

- Validates `player_name` and `email` reusing the same rules as `submit-score` (extracted into `_shared/validation.ts` so both functions stay in lockstep).
- Inserts a `game_runs` row (`started_at = now()`), returns `{ run_id }`.
- Also performs the existing "lead capture" insert into `scores` (score 0, `run_id` stamped) so the lead funnel/leaderboard behavior is unchanged.
- No rate limiting added here (backend lacks good primitives; the existing rate limit on the final `submit-score` is the choke point).
- CORS + `verify_jwt = false`, uses `SUPABASE_SERVICE_ROLE_KEY`.

## Updated edge function: `submit-score`

- Accepts an optional `run_id` (uuid string) in the body.
- If `run_id` is present and matches a `game_runs` row:
  - Update `game_runs.ended_at = now()`.
  - Compute `duration_s = floor(epoch(ended_at - started_at))`.
  - If the value is negative or > 2 hours, store `null` instead of failing.
- Insert the score with `run_id` and `duration_s` populated when available.
- A missing/unknown `run_id` is logged but never blocks the insert (back-compat for any in-flight client).
- All existing validation, rate limiting, and response shapes unchanged.

## Client changes: `src/features/game/shellRuntime.ts`

- In `startGame()`: replace the current "lead capture via `submitScore` with score 0" block with a call to `start-run`. Store the returned id in a module-level `currentRunId`.
- In the game-over submit (around line 848): include `run_id: currentRunId` in the payload.
- Reset `currentRunId = null` when returning to the start screen so each run gets a fresh id.
- Same UX on failure: surface the error and let the user retry.

## Admin page

In `src/pages/admin/AdminView.tsx` (and any types in `adminApi.ts`):
- Add a **Duration** column to the scores table, formatted `m:ss` (e.g. `2:14`) or `—` when null.
- Sortable like other columns.
- No new RPC needed — `duration_s` is selected as part of the existing scores fetch (PostgREST `select=*` already covers it once the column exists).

## Out of scope

- No admin filtering/flagging based on duration yet.
- No background job to prune old `game_runs` rows. Note for later: safe to delete rows older than ~90 days; the linked `scores.duration_s` is already denormalized so nothing is lost.

## Files touched

- New migration (schema + RLS + indexes).
- New: `supabase/functions/start-run/index.ts`
- New: `supabase/functions/_shared/validation.ts` (shared name/email validators)
- Edit: `supabase/functions/submit-score/index.ts` (shared validators, accept `run_id`, write `duration_s`)
- Edit: `src/features/game/shellRuntime.ts` (call `start-run`, track `currentRunId`, send on game over)
- Edit: `src/pages/admin/AdminView.tsx` (+ `adminApi.ts` types) for the Duration column
