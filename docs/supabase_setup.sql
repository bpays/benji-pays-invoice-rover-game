-- ─────────────────────────────────────────────────────
--  BENJI PAYS: INVOICE ROVER — Supabase Schema
--  Run this in Supabase SQL Editor (supabase.com → SQL Editor)
-- ─────────────────────────────────────────────────────

-- ── SCORES TABLE ──────────────────────────────────────
create table if not exists scores (
  id           uuid default gen_random_uuid() primary key,
  player_name  text not null,
  email        text,
  score        integer not null default 0,
  city_reached text,
  city_flag    text,
  best_combo   integer default 0,
  distance     integer default 0,
  flagged      boolean default false,
  created_at   timestamptz default now()
);

-- Index for leaderboard queries (fast sort by score)
create index if not exists scores_score_idx on scores (score desc);
create index if not exists scores_created_idx on scores (created_at desc);

-- ── SETTINGS TABLE ────────────────────────────────────
-- Key/value store for admin controls
create table if not exists settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz default now()
);

-- Default settings
insert into settings (key, value) values
  ('leaderboard_reset_at', now()::text),
  ('event_name',           'Benji Pays: Invoice Rover'),
  ('event_active',         'true'),
  ('daily_prize',          '$50'),
  ('grand_prize',          '$500')
on conflict (key) do nothing;

-- ── ROW LEVEL SECURITY ────────────────────────────────
-- Allow anyone to INSERT scores (lead capture)
alter table scores enable row level security;

create policy "Anyone can submit a score"
  on scores for insert
  with check (true);

create policy "Anyone can read non-flagged scores"
  on scores for select
  using (flagged = false);

-- Settings readable by anyone, writable only via service key
alter table settings enable row level security;

create policy "Anyone can read settings"
  on settings for select
  using (true);

-- ── VERIFY ────────────────────────────────────────────
-- Run this to confirm setup worked:
-- select * from settings;
-- select count(*) from scores;
