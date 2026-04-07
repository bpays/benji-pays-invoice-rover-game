# Benji Pays: Invoice Rover 🐕

A branded mobile endless runner game for Benji Pays.
Browser-based, no app download. Scan a QR code and play instantly on any phone.

---

## Live URLs

| Page | URL |
|------|-----|
| Game | https://benji-pays-game.netlify.app |
| Leaderboard | https://benji-pays-game.netlify.app/leaderboard |
| Admin Panel | https://benji-pays-game.netlify.app/admin |
| Strategy Page | https://benji-pays-game.netlify.app/strategy |

---

## What Is This?

Invoice Rover is a three-lane endless runner starring Benji, the Benji Pays mascot dog.
Players dodge bad payments and collect good ones across 10 global cities — each with its own parallax skyline, city arrival banner, and full Suno soundtrack (day + night versions).

Built for trade show activations, lead generation, and social media campaigns.
Debuting at N-able Empower, Fort Lauderdale — April 13-15, 2026.

---

## Tech Stack

| Layer | Tool |
|-------|------|
| Game Engine | HTML5 Canvas |
| Local Dev | VS Code |
| Version Control | GitHub Desktop |
| Hosting | Netlify (auto-deploy on push to main) |
| Backend | Supabase (scores, leaderboard, lead capture) |
| Music | Suno (20 tracks — 10 cities x day + night) |
| Audio Engine | Web Audio API (AudioContext + fetch + decodeAudioData) |

---

## Folder Structure

```
benjipays-invoice-rover/
  /game                   -> Main game (HTML5 canvas, single file)
    index.html            -> Full game — all mechanics, audio, lead capture
    /assets
      /audio
        /music            -> 20 Suno MP3 tracks (naming: music_city_day/night_loop.mp3)
      /ui                 -> Logo SVG (white + cerulean versions)
  /leaderboard            -> Live leaderboard page
  /admin                  -> Password-protected admin panel
  /strategy               -> Campaign strategy page (external-facing)
  /docs                   -> SQL schema, setup notes
```

---

## The 10 Cities

| # | City | Score Range | Music Style |
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

## The 4 Power-Ups

| Icon | Name | Duration | Effect | Brand Meaning |
|------|------|----------|--------|---------------|
| 🛡️ | Auto-Pay Shield | 15s | Full invincibility, night mode on | Set it and forget it |
| ⚡ | Instant Pay Boost | 12s | Speed +60%, score 2x | Fast, exciting, slightly dangerous |
| 💰 | Paid in Full | Instant | Clears all obstacles in particle burst | Every bad payment: resolved |
| 💫 | Payment Streak | 15s+ | Double points, +0.5s per collect | Compound interest made playable |

---

## Key Mechanics

- **Clutch Save** — First hit doesnt end the run. Resets combo + brief invincibility. Second hit ends it.
- **City Grace Period** — 3-second obstacle pause on every city transition.
- **Combo Shield Milestone** — 10 consecutive collects grants a free Auto-Pay Shield.
- **Power-up Warning Flash** — Benji flashes 3x/sec in the last 4 seconds of any active power-up.
- **Delta-time normalization** — Identical game speed at 30fps (phone) and 120fps (desktop).

---

## Supabase

- **Project:** cxnyfnudhsqrpknyfbft.supabase.co
- **Tables:** scores, settings
- **Event tag:** nable-empower-2026
- **RLS:** Public insert + select (non-flagged scores only)

---

## Workflow

Code edit -> GitHub Desktop commit + push -> Netlify auto-deploys (~60s) -> Live

---

## Admin Panel

- **URL:** benji-pays-game.netlify.app/admin
- **Password:** stored in project credentials (ask Rafael or check 1Password)
- **Features:** Live stats, leaderboard timer control, score edit/flag/delete, CSV export, event filtering

---

*Benji Pays: Invoice Rover — Internal Project*
*Owner: Rafael — Benji Pays MSP Channel & Creative*
github.com/bpays/benjipays-game-invoice-rover
