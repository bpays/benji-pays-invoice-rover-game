# Benji Pays: Invoice Rover

A branded, browser-based endless runner for conference floors and campaigns. Players scan a QR code, enter work contact details, run with Benji the mascot, and land on live leaderboards—no app store install.

---

## Summary

**Invoice Rover** is a lead-gen game for Benji Pays: a three-lane runner through ten stylized cities, with day/night music per city, power-ups, and obstacles themed around getting paid (overdue invoices, angry clients, dodge mechanics). After a run, players submit name and **work email** to save their score; the **daily** and **event** leaderboards are powered by **Supabase** (Postgres, Row Level Security, and Edge Functions).

The repo is built for **production use at busy events**: score writes go through a validated **`submit-score`** Edge Function (not direct table inserts from the browser), optional domain allow/block lists via environment variables, **rate limiting** per IP and email, and an **admin** experience for staff: Google sign-in restricted to **@benjipays.com**, MFA, live stats, score management, CSV export, leaderboard reset timer, **daily-board timezone** (default **US Eastern** / `America/New_York`), and event-scoped data.

Static assets live under **`public/`**; the main shell is [`public/game/index.html`](public/game/index.html) (start flow, lead capture, canvas host) with the core loop in **Phaser 3** ([`public/game/src/`](public/game/src/)). Companion pages: [`public/leaderboard/index.html`](public/leaderboard/index.html), [`public/admin/index.html`](public/admin/index.html), [`public/strategy/index.html`](public/strategy/index.html).

---

## Tech stack

| Layer | Tool |
|-------|------|
| Game runtime | Phaser 3 ([`public/game/src/main.js`](public/game/src/main.js)) |
| Shell / forms / API calls | HTML, CSS, vanilla JS ([`public/game/index.html`](public/game/index.html)) |
| Backend | Supabase (Postgres, Auth, Edge Functions) |
| Migrations | [`supabase/migrations/`](supabase/migrations/) |
| Edge Functions | `submit-score` (writes scores), `admin-invite` (admin invites / role helpers) |
| Hosting | Netlify (example workflow: push to `main` → deploy) |
| Music | Suno loops per city (day + night); Web Audio in the HTML shell |

Supabase **anon** URL and key are embedded in the deployed static pages (normal for public browser clients). **Service role** and secrets stay only in Supabase (Edge Function env)—never in the repo for production.

---

## Folder structure

```
benji-pays-invoice-rover-game/
  public/
    game/                 # Game + lead capture + Phaser bundle
      index.html          # Start / game-over / CTA UI, submit-score, validation
      src/                # Phaser scenes (Boot, Start, Game, GameOver)
      assets/             # Audio, logos, obstacles, partner images
    leaderboard/          # Public daily + event leaderboard (RPCs)
    admin/                # Staff dashboard (Google + MFA)
    strategy/             # External-facing campaign page
    favicon.png
  supabase/
    migrations/           # Schema, RLS, RPCs, rate-limit table, timezone setting
    functions/            # submit-score, admin-invite, shared CORS
```

---

## Backend behavior (short)

- **Scores:** Inserts use the **`submit-score`** Edge Function with the service role. The **`scores`** table does not allow anonymous direct inserts; RLS and grants match the migrations in-repo.
- **Leaderboards:** Anonymous clients call **`get_daily_leaderboard`**, **`get_leaderboard`**, **`get_today_run_count`**, **`get_event_submission_count`**, and **`get_daily_board_clock`** (timezone + countdown). Emails are not exposed on public reads.
- **Daily “today”:** Driven by **`leaderboard_timezone`** in **`settings`** (IANA name, default `America/New_York`). Admins change it in the admin UI after the relevant migration is applied.
- **Abuse:** **`check_submit_score_rate_limit`** (Postgres, service_role-only) backs rolling windows for submit-score.

Apply new migrations with Supabase CLI or the SQL editor, then **redeploy** Edge Functions when their code changes.

---

## The 10 cities

| # | City | Score range | Music style |
|---|------|-------------|-------------|
| 1 | Vancouver 🇨🇦 | 0 – 1,500 | Indie folk |
| 2 | Toronto 🇨🇦 | 1,500 – 3,000 | Canadian indie |
| 3 | Montreal 🇨🇦 | 3,000 – 4,500 | French electronic |
| 4 | Dallas 🤠 | 4,500 – 6,000 | Country hip hop |
| 5 | New York 🗽 | 6,000 – 7,500 | East coast hip hop |
| 6 | Los Angeles 🌴 | 7,500 – 9,000 | West coast lo-fi |
| 7 | Miami 🌊 | 9,000 – 10,500 | Latin electronic |
| 8 | London 🇬🇧 | 10,500 – 12,000 | Drum and bass |
| 9 | Australia 🇦🇺 | 12,000 – 13,500 | Surf rock |
| 10 | Cyber City 🤖 | 13,500+ | Synthwave / glitch |

---

## Power-ups

| Icon | Name | Duration | Effect |
|------|------|----------|--------|
| 🛡️ | Auto-Pay Shield | 15s | Invincibility, night mode |
| ⚡ | Instant Pay Boost | 12s | Speed +60%, score 2x |
| 💰 | Paid in Full | Instant | Clears on-screen obstacles |
| 💫 | Payment Streak | 15s+ | Double points, combo extension |

---

## Key mechanics

- **Clutch save** — First hit does not end the run; second hit does.
- **City grace period** — Brief pause on city transitions.
- **Combo shield milestone** — Long collect streaks can grant a shield.
- **Power-up warning** — Visual flash before expiry.
- **Timing** — Gameplay uses delta time where relevant so feel stays consistent across frame rates.

---

## Admin panel

- **Path:** `/admin/` on your deployed site (e.g. Netlify).
- **Access:** Google OAuth, **@benjipays.com** only, plus **MFA** and **`user_roles`** admin assignment (invites via **`admin-invite`** Edge Function).
- **Capabilities:** Event filter, stats, score edit / flag / delete, CSV export, leaderboard reset timer, **daily leaderboard timezone**, destructive per-event reset (RPC), admin user management.

There is no shared static password in this README; use your org’s identity and Supabase policies.

---

## Workflow

Edit source → commit → push → hosting rebuilds static files → run **Supabase migrations** and **function deploys** when the backend changes.

---

## Event reference

Example event tag used in client pages: **`nable-empower-2026`**. Adjust in HTML or centralize if you fork for another show.

---

*Benji Pays: Invoice Rover — Benji Pays MSP channel and creative.*
