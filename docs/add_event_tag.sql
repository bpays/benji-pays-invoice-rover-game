-- ─────────────────────────────────────────────────────
--  ADD EVENT TAGGING — Run in Supabase SQL Editor
-- ─────────────────────────────────────────────────────

-- Add event_tag column to scores
alter table scores add column if not exists event_tag text default 'nable-empower-2026';

-- Index for fast event filtering
create index if not exists scores_event_tag_idx on scores (event_tag);

-- Add current event to settings
insert into settings (key, value) values
  ('current_event_tag',  'nable-empower-2026'),
  ('current_event_name', 'N-able Empower 2026'),
  ('current_event_dates','April 13–15, 2026 · Fort Lauderdale')
on conflict (key) do update set value = excluded.value;

-- Verify
select key, value from settings order by key;
