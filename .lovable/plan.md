

## Apply Database Migration

Execute the SQL from `supabase/migrations/20260409180000_daily_event_leaderboard_rpcs.sql` to create three missing database functions:

1. **`get_daily_leaderboard(p_event_tag, p_limit)`** — Returns best score per player for current UTC day, optional event filtering
2. **`get_event_submission_count(p_event_tag)`** — Returns count of non-flagged submissions for an event
3. **`reset_event_scores(p_event_tag)`** — Admin-only: deletes all scores for a given event tag

Permissions:
- `anon` and `authenticated` get EXECUTE on the two read functions
- Only `authenticated` gets EXECUTE on the reset function (with internal admin check)

No table changes — only new functions and grants.

