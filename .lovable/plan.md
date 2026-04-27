# Fix Leaderboard Scroll

## Problem

On `/leaderboard`, a scrollbar appears (so the document is taller than the viewport), but neither mouse wheel nor touch will actually scroll. This is a classic symptom of **two stacked scroll containers** (`html` and `body` both with `overflow-y: auto`) where neither cleanly receives scroll input — particularly after our earlier fix added `overflow-y` to both elements via `leaderboard.css`.

## Root Cause

Currently the cascade for the leaderboard route ends up with:

- `src/index.css`: `html, body { min-height: 100%; overflow-y: auto }` (applies globally)
- `src/styles/leaderboard.css`: `html.benji-leaderboard-page { overflow-y: auto }` and `... body { overflow-y: visible }`

`html` has `min-height: 100%` (= viewport) and `overflow-y: auto`, while `body` also has `min-height: 100%` and a competing `overflow-y` declaration. The browser ends up showing a scrollbar on the root but scroll events get swallowed by the nested container chain.

## Fix

Make the leaderboard page use a **single, document-level scroll container** by overriding both the global rules and the previous leaderboard rules so that:

- `html.benji-leaderboard-page` → `height: auto; min-height: 100vh; overflow-x: hidden; overflow-y: auto;`
- `html.benji-leaderboard-page body` → `height: auto; min-height: 100vh; overflow: visible !important;` (force visible to defeat `index.css`'s `body { overflow-y: auto }` regardless of cascade order)
- `html.benji-leaderboard-page #root` → `min-height: 100vh; overflow: visible;` (in case anything constrains it)

Only the `html` element scrolls. `body` and `#root` simply grow to fit content. This eliminates the dual-container conflict.

### Files changed

- `src/styles/leaderboard.css` — replace the two `html.benji-leaderboard-page` / `... body` rules with the three rules above and add `!important` on body's `overflow` so it wins against `src/index.css` regardless of import order.

No JS changes, no functional changes elsewhere. Game and admin pages are unaffected because rules are scoped to `html.benji-leaderboard-page`.

## Verification

After the change:

1. Visit `/leaderboard` on desktop → wheel scroll moves the page.
2. Visit `/leaderboard` on mobile → touch scroll works, no rubber-band trapping.
3. Visit `/game` → still locked (no change to `benji-game-page` rules).
4. Visit `/admin` → unaffected.
