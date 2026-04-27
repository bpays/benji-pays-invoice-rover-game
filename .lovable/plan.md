# Plan: remove night mode entirely + add loading screen

## 1. Remove night mode from the game

**File:** `src/features/game/shellRuntime.ts`

Night mode is currently triggered exclusively by power‑ups (`activatePU` → `activateNight`) and toggled off via the `nightTimer` countdown in the game loop. We will rip it out so:
- Power‑ups still apply their gameplay effects (shield, double points, clear obstacles)
- The screen never dims (`#nightOverlay` stays at opacity 0)
- The music never swaps mid‑run; it only changes when the player advances to a new city

**Concrete edits:**

- **`activatePU(t)` (line 565‑571):** remove the `activateNight();` call. Keep the rest (banner, shield/double‑points flags, `activePUName`, `activePUTimer`).
- **`activateNight()` function (lines 555‑564):** delete entirely. No callers remain after the change above and the game‑loop change below.
- **Game loop `nightTimer` block (line 789):** delete the line `if(nightTimer>0){ nightTimer-=delta; if(nightTimer<=0) activateNight(); }`.
- **`isNight` references in rendering (lines 668, 680, 682, 691, 698, 704, 705, 708, 710):** since `isNight` will always be `false`, leave the variable declared as a constant `false` (simpler than touching every render branch). Easiest: keep `let isNight=false` in the state declaration (line 323) and in `initGame()` (line 519), and never mutate it. All `isNight ? ... : ...` ternaries in drawing code automatically take the day branch. Same for `nightTimer` — leave it at 0.
- **`#nightOverlay` element:** keep in DOM (harmless), opacity stays at `0` from `initGame`. No CSS change needed.
- **Music swap on city change (line 818):** keep — this is the only remaining music swap and matches the requested behavior (only on new level).
- **Other `swapToDayMusic` callsites (lines 938, 949, 959, 970):** keep — these are run start / restart / CTA‑skip, not mid‑run swaps.
- **Dead helpers `swapToNightMusic` (line 480) and `getMusicFile`'s night branch:** leave `swapToNightMusic` defined but unused (safe), or remove it — we'll remove it for cleanliness.

Net result: power‑ups still work, screen never dims, the only music change in a run happens when entering a new city.

## 2. Add a "Benji Pays" loading screen on benjigame.com

**Symptom:** Loading the homepage briefly shows the start screen with missing icons before assets finish downloading.

**Approach:** Show a full‑screen overlay with the Benji Pays white logo and a spinning circle until the React app mounts and a small set of critical above‑the‑fold game assets have loaded. Fade it out once ready.

**Implementation:**

- **`index.html`** — add `<div id="benji-loading">` inside `<body>` directly after the GTM noscript, with an inline `<style>` block so it paints before any JS:
  - Fixed full‑viewport overlay, charcoal `#002843` background, z‑index above everything
  - Centered `<img src="/game/assets/ui/logo-white.svg">` (max‑width ~280px) with a spinner below
  - Spinner: 48px circle, 3px transparent border, top border in copper `#CC7D51`, `@keyframes benji-spin` rotation
  - A `.benji-loading--hidden` class that fades opacity to 0 over 300ms then `display:none`

- **`src/main.tsx`** — after `ReactDOM.createRoot(...).render(<App/>)`:
  - On `/` or `/game`: preload a small list of critical asset URLs via `new Image()` (start‑screen logo, legend icons, how‑to‑play illustration). `Promise.all` with a 2.5s hard timeout fallback.
  - On other routes (`/leaderboard`, `/admin`, `/strategy`): hide as soon as React has painted (`requestAnimationFrame` after mount).
  - Hide by adding `benji-loading--hidden`, then remove the node after the transition.

- **Layout:** overlay is `position:fixed` so React mounts underneath without layout shift.
- **No‑JS fallback:** overlay stays up, matching today's behavior (the app requires JS).

## Files touched
- `src/features/game/shellRuntime.ts` — remove night-mode activation, deletion of `activateNight()`, remove `nightTimer` countdown branch, remove unused `swapToNightMusic`
- `index.html` — add loading overlay markup + inline styles
- `src/main.tsx` — hide loading overlay after mount / critical assets load

## Out of scope
- No gameplay tuning beyond removing the night trigger.
- No changes to which power‑ups grant which effects.
