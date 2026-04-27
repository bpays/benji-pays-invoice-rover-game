# Automated Scores Backups (Every 3 Hours)

Add a scheduled backup job that exports the full `scores` table to a CSV file in Lovable Cloud storage every 3 hours, with an on/off toggle in the admin panel.

## What you'll see

**Admin page** — new "Backups" card:
- Toggle: **Automated backups: ON / OFF**
- Status line: "Last backup: 2026-04-27 14:00 ET — 1,234 rows"
- "Run backup now" button for an on-demand snapshot

Backup files live in Lovable Cloud storage (accessible via the Cloud → Storage tab) — no in-app browser needed.

**Behavior:**
- When ON: a CSV snapshot of `scores` is saved every 3 hours
- When OFF: schedule still fires but the function exits immediately (no file written)
- Files named `scores-backup-YYYY-MM-DD-HHmm.csv` (ET timezone)
- Old backups (>30 days) auto-pruned to keep storage tidy

## Implementation

### 1. Storage
Create a private storage bucket `scores-backups`. Files written by the edge function (service role); not exposed to clients.

### 2. Settings flag
Add row in `settings` table:
- `key = 'backups_enabled'`, `value = 'false'` (default off)
- `key = 'backups_last_run'`, `value = ISO timestamp + row count` (updated by the function)

### 3. Edge function: `backup-scores`
- Accepts optional `{ force: true }` to bypass the toggle (for the manual button)
- Reads `settings.backups_enabled` — if `'false'` and not forced, return `{ skipped: true }`
- Selects all rows from `scores` (paginated, 1000 at a time)
- Builds CSV with all columns: `id, player_name, email, score, city_reached, city_flag, best_combo, event_tag, run_id, duration_s, flagged, created_at`
- Uploads to `scores-backups/scores-backup-<timestamp>.csv`
- Updates `settings.backups_last_run`
- Prunes files older than 30 days

### 4. Schedule
`pg_cron` job running every 3 hours, posting to `/functions/v1/backup-scores`.

### 5. Admin UI (`AdminView.tsx`)
- New "Backups" section after the events controls
- Toggle writes to `settings.backups_enabled`
- Shows last-run timestamp + row count
- "Run backup now" button calls `backup-scores` with `{ force: true }`

## Database changes

```sql
-- seed settings
insert into settings (key, value) values
  ('backups_enabled', 'false'),
  ('backups_last_run', '')
on conflict (key) do nothing;

-- enable pg_cron + pg_net, schedule every 3 hours
```

## Notes

- Backups capture everything including flagged rows for faithful restore
- Pairs with the existing `admin-import-scores` function — download a CSV from Cloud storage, re-import to restore
- Default OFF so it stays quiet between events; flip ON in admin when an event starts
