# Fix Mobile Hitching: Game Swipes & Leaderboard Scroll

Two unrelated jank sources, both rooted in expensive GPU compositing on mobile Safari/Chrome. Plus a few additional perf wins discovered while investigating.

## Problem 1 — Swipe hitch in the game (mobile)

Touch handlers are already `{passive:true}` and cheap. The hitch shows up because, on every swipe, the canvas is composited against multiple full-bleed overlays that use `backdrop-filter: blur(...)`:

- `#cityBanner .city-pill` — `backdrop-filter: blur(12px)` (shows briefly when entering a new city)
- `#gameOverScreen` — `backdrop-filter: blur(14px)`
- `#ctaScreen` — `backdrop-filter: blur(14px)`

`backdrop-filter` is one of the most expensive operations on mobile GPUs and forces the underlying canvas + score-pop DOM nodes to re-rasterize each frame. When a swipe triggers the lane-tween (canvas redraws every frame for ~150ms) and a city-pill or score popup overlaps, the compositor stalls.

`#gameWrap` also doesn't explicitly set `touch-action`, so the browser still evaluates scroll/zoom gestures even though `html.benji-game-page` sets `touch-action:none`. Making it explicit on `#gameWrap` removes input-delay.

## Problem 2 — Leaderboard hitch when scrolling to bottom (mobile)

`/leaderboard` paints two background orbs:

```css
.orb1 { width:300px; height:300px; filter: blur(80px); }
.orb2 { width:200px; height:200px; filter: blur(80px); }
```

inside a `position:fixed` `.bg`. On iOS, an 80px CSS blur on a 300px box is very expensive. They share a compositor layer with the page, so every overscroll/elastic-bounce at the bottom forces a full re-rasterize — exactly when users feel the hitch.

`.rank-row` also runs `animation: rowIn .4s ease both` with inline `animation-delay`, and `.pulse` runs an infinite `transform:scale`. Neither has `will-change`, so the browser repaints them on the main layer.

## Additional perf issues found while investigating

- **Leaderboard: full re-fetch every 60s** runs even when the tab is hidden or the user is idle, doubling background CPU on low-power devices. Skip the poll when `document.hidden`.
- **`.empty-dog` and `.pulse` keyframes** animate continuously even when off-screen — minor, but add `will-change: transform` so they stay on the GPU layer instead of repainting.
- **Google Fonts `@import`** at the top of both `game.css` and `leaderboard.css` blocks CSS parsing until the font CSS is fetched. Move to `<link rel="preconnect">` + `<link rel="stylesheet">` in `index.html` so it loads in parallel with the bundle.

## Fix Plan

### 1. `src/styles/game.css`

- Remove `backdrop-filter: blur(12px)` from `.city-pill`. Keep gradient + border so it still reads as a glass pill.
- Replace `backdrop-filter: blur(14px)` on `#gameOverScreen` and `#ctaScreen` with a more opaque solid (`rgba(0,18,36,.985)`).
- Add `touch-action: none;` to `#gameWrap`.
- Add `will-change: transform;` to `#gameCanvas`.
- Drop the `@import` for Google Fonts (handled by `index.html` instead).

### 2. `src/styles/leaderboard.css`

- Reduce `.orb1`/`.orb2` blur from `80px` → `40px`, bump opacity slightly to keep similar weight.
- Add `transform: translateZ(0); will-change: transform;` to `.bg`.
- Add a scoped `html.benji-leaderboard-page, html.benji-leaderboard-page body { overscroll-behavior-y: none; }` rule to disable iOS rubber-band.
- Add `will-change: transform, opacity;` to `.rank-row` and `will-change: transform;` to `.pulse`/`.empty-dog`.
- Drop the `@import` for Google Fonts.

### 3. `src/pages/LeaderboardPage.tsx`

- `useEffect` that adds `benji-leaderboard-page` to `document.documentElement` on mount and removes it on unmount (mirrors existing `benji-game-page` pattern).
- Wrap the 60s poll interval so it skips when `document.hidden`, and trigger an immediate refresh on `visibilitychange` back to visible.

### 4. `index.html`

- Add `<link rel="preconnect" href="https://fonts.googleapis.com">`, `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`, and one consolidated `<link rel="stylesheet">` for the Barlow + Barlow Condensed weights used by both pages.

## Files to edit

- `src/styles/game.css`
- `src/styles/leaderboard.css`
- `src/pages/LeaderboardPage.tsx`
- `index.html`

## Out of scope / not changing

- Touch handler logic, lane-tween timing, or the game loop itself.
- Leaderboard data shape / RPC behavior.
- Visual design — all changes are perceptually equivalent on mobile.
- Backend / Lovable Cloud compute sizing — this is a pure-frontend rendering problem; upgrading the instance would not help.
