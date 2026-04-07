# Benji Pays: Invoice Rover — Dev Setup Notes

## First Time Setup

### What You Need Installed
- [x] Phaser Launcher (Mac)
- [x] VS Code
- [x] Node.js (LTS)
- [x] GitHub Desktop

### Opening the Game Locally
1. Open **Phaser Launcher**
2. Click **Open Project**
3. Navigate to: `Documents/GitHub/benjipays-invoice-rover/game`
4. Select the `index.html` file
5. Click **Run** — game opens in built-in browser with hot-reload

### Pushing Changes to GitHub
1. Make changes in Phaser Launcher or VS Code
2. Open **GitHub Desktop**
3. You'll see changed files listed automatically
4. Write a commit message (e.g. "Add Vancouver background")
5. Click **Commit to main**
6. Click **Push origin**
7. Netlify auto-deploys within ~60 seconds ✅

---

## Folder Guide

```
/game/src/
  config.js       ← All tunable values (speeds, timings, cities)
  main.js         ← Phaser game init + scene list
  BootScene.js    ← Asset preloading
  StartScene.js   ← Name/email capture + play button
  GameScene.js    ← Core runner loop (main build goes here)
  GameOverScene.js← Score display + share prompt

/game/assets/
  /sprites        ← Benji PNG sprite sheets (from Midjourney)
  /backgrounds    ← City parallax strips (30 total)
  /audio/music    ← Suno MP3 loops (20 tracks)
  /audio/sfx      ← WAV sound effects
  /ui             ← HUD, screens, logo SVG
  /powerups       ← Power-up icons + active states

/leaderboard/     ← Standalone leaderboard page (Supabase wired)
/admin/           ← Admin panel (timer control, score edit)
/docs/            ← Project docs, handoff notes
```

---

## Supabase Setup (When Ready)

1. Go to supabase.com — open your project
2. Go to **SQL Editor** and run:

```sql
-- Scores table
create table scores (
  id uuid default gen_random_uuid() primary key,
  player_name text not null,
  email text,
  score integer not null,
  city_reached text,
  city_flag text,
  best_combo integer default 0,
  flagged boolean default false,
  created_at timestamptz default now()
);

-- Settings table (admin controls)
create table settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

-- Default settings
insert into settings (key, value) values
  ('leaderboard_reset_at', now()::text),
  ('event_name', 'Invoice Rover Launch'),
  ('event_active', 'true');
```

3. Go to **Settings → API** in Supabase
4. Copy your **Project URL** and **anon/public key**
5. Paste both into `/game/src/main.js` where indicated

---

## Netlify Connection (When Ready)

1. Go to netlify.com → **Add new site → Import from Git**
2. Choose GitHub → select `benjipays-invoice-rover`
3. Build settings:
   - Base directory: `game`
   - Publish directory: `game`
   - Build command: (leave empty)
4. Click **Deploy site**
5. Every future push to `main` auto-deploys ✅

---

*Benji Pays: Invoice Rover — Internal Dev Notes*
