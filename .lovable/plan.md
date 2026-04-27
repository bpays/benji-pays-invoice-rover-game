# Fix: Timezone save silently fails

## Root cause

The `settings` table has no `leaderboard_timezone` row. The admin save uses `PATCH .../settings?key=eq.leaderboard_timezone`, which against a missing row returns HTTP 200 with an empty array `[]`. The current code treats any non-null response as success, so the toast shows "Timezone saved" even though zero rows were updated. On reload, `loadTimezone` finds no row and falls back to the default `America/New_York`.

## Fix

1. **Seed the missing row** in the `settings` table so the timezone has somewhere to be stored:
   ```
   INSERT INTO settings (key, value) VALUES ('leaderboard_timezone', 'America/New_York')
   ON CONFLICT (key) DO NOTHING;
   ```
   (Already executed during diagnosis — confirmed present.)

2. **Harden `onSaveTz` in `src/pages/admin/AdminView.tsx`** so this class of bug surfaces instead of silently passing:
   - Treat the response as success only when the returned array has at least one row (PATCH with `Prefer: return=representation` returns the updated rows).
   - On empty-array response, show a real error toast and inline message ("Could not save — settings row missing").

This same pattern (PATCH-only for a row that may not exist) also affects `active_event` and the new `backups_*` settings, but those rows already exist now, so the immediate user-visible bug is just the timezone one. The hardened check stays specific to the timezone save for this fix.

## Files touched

- `src/pages/admin/AdminView.tsx` — tighten the success check inside `onSaveTz`.
- DB: `settings` row already inserted.
