# Admin overhaul + dead code cleanup

## 1. Delete dead game code

Remove the unused `public/game/` directory (BootScene/GameScene/StartScene/GameOverScene/config/main + assets folders + index.html). The active game runs from `src/features/game/shellRuntime.ts`. This was the source of the earlier threshold confusion.

No data is touched.

## 2. Fix the missing Admin list

The admin list currently silently fails when the `admin-invite` edge function returns an error — `loadAdminList` exits without surfacing why, so the section just renders "—".

Fixes:
- Surface the error via toast and an inline message inside the Admins panel.
- Log the response detail to the browser console for diagnosis.
- Make sure `loadAdminList` is called *after* the MFA (aal2) session is fully established (currently called from `enterApp`, which is correct, but we'll add a retry-on-mount inside the Admin Management section so it reloads if it raced ahead of the session).
- The edge function's `list` action requires `aal2`; the existing flow does already complete MFA before `enterApp`, so the auth path remains unchanged. **No security regressions** — admin-only + MFA-required gates stay intact.

Also add a "Refresh" button to the Admins panel.

## 3. New events system (dynamic, no hardcoding)

### Database (additive only — no destructive changes)

New table `events`:
- `tag` text PRIMARY KEY (slug, e.g. `nable-empower-2026`)
- `label` text NOT NULL
- `created_at` timestamptz default now()
- `created_by` uuid
- RLS: anyone can SELECT (needed by leaderboard); only admins (with `aal2`) can INSERT.
- Seed two rows: `general` (label "General Play") and `nable-empower-2026` (label "N-able Empower 2026") so existing data continues to display.

New row in `settings` table (already exists, additive):
- `key='active_event'`, `value='nable-empower-2026'` initially. This is the currently active event used by the game and the public leaderboard.
- Anyone can SELECT (existing policy); only admins can UPDATE (existing policy).

The `scores` table is **not modified at all**. No drops, no column changes, no deletes. Scores keep their existing `event_tag`. Submissions for unknown event tags will still be accepted (the submit-score edge function already permits any string ≤50 chars in `event_tag`), so historical data is untouched.

### Game submission flow

`src/features/game/shellRuntime.ts` currently hardcodes `event_tag: 'nable-empower-2026'` in two places. Replace with a runtime fetch of `settings.active_event` (cached per session, refreshed on game start). Fallback to `'general'` if missing.

### Public leaderboard

`src/pages/LeaderboardPage.tsx` currently hardcodes `EVENT_TAG`. Replace with a fetch of `settings.active_event` on mount, then call the existing `get_leaderboard` / `get_daily_leaderboard` RPCs with that tag. Public users only ever see the active event.

### Admin page

Replace the hardcoded `EVENTS` map with a live list:
- Load all rows from `events` on mount.
- Event selector dropdown is populated from that list, plus an "All Events" option (admin-only view).
- Show which event is the **currently active** one with a badge in the dropdown.
- New "Create event" inline form below the selector:
  - Text input for label (e.g. "RSA Conference 2026")
  - Auto-generates tag (slug) but allows override
  - "Create" button → inserts into `events` table
  - "Set as active" button next to the selector → updates `settings.active_event`
- All admin views (stats, scores table, CSV export) continue to scope by the selected event tag.

## 4. CSV upload (import)

Add an "Import CSV" button next to the existing "CSV" export button.

- Accepts the **same column format** the export produces: `Rank, Name, Email, Score, City, Combo, Event, Date`.
- Parses client-side, validates each row (name + email required, score is a non-negative integer ≤ 100000, combo ≤ 500, city must be in valid list else defaults to Vancouver, event_tag falls back to currently selected event if blank).
- Sends rows in batches to a **new edge function `admin-import-scores`** that:
  - Requires admin role + `aal2` (mirrors `admin-invite` pattern).
  - Uses the service role key to insert into `scores` (RLS forbids client inserts — by design).
  - Inserts only — never updates or deletes existing rows. Each imported row gets a fresh `id`.
  - Returns `{ inserted, skipped, errors[] }` so the UI can show a summary.
- Shows a confirmation modal before importing ("This will insert N rows. Existing data will not be modified.").
- "Date" column from the export is preserved into `created_at` when valid; otherwise `now()`.

## 5. Data safety guarantees

To make accidental deletion impossible:
- **No DELETE policy on `scores`** — already enforced (`No deletes on scores` policy with `USING(false)`). We keep it that way; the import function uses INSERT only.
- The new `admin-import-scores` function explicitly does not call `.delete()` or `.update()` anywhere.
- The flag/restore action stays as a soft `flagged` boolean — never a delete.
- Migrations in this change are additive (CREATE TABLE, INSERT seed rows). No DROP/ALTER on existing tables.

## Technical notes

- **Migrations**: one migration creates `events` table + RLS policies, seeds 2 rows, and inserts `active_event` settings row.
- **Edge functions**: new `admin-import-scores`; `admin-invite` unchanged.
- **Files touched**:
  - delete: `public/game/**`
  - edit: `src/pages/admin/AdminView.tsx`, `src/features/game/shellRuntime.ts`, `src/pages/LeaderboardPage.tsx`
  - new: `supabase/functions/admin-import-scores/index.ts`
- TypeScript types regenerate automatically after the migration.

## Open question

For the CSV import: if a row's email already appears in the existing scores for that event, do you want me to (a) insert anyway as an additional run, (b) skip duplicates, or (c) only insert if the imported score is higher than the existing best? Default in the plan above is **(a) insert anyway** since each row is its own run — let me know if you'd prefer different dedupe behavior.
