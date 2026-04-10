

## Plan: Update Leaderboard Title, Remove Dog Emojis, Fix Link Targets

### 1. Change "Balance Sheet" to dynamic "Daily/All-Time Leaderboard"

**File: `public/leaderboard/index.html`**
- Line 148: Change title from `Balance / Sheet` to `Daily / Leaderboard` with dynamic scope
- Line 293: Update `setBoard()` to set titleScope to "Daily" or "All-Time" based on active board

### 2. Remove dog emojis from all pages

**`public/leaderboard/index.html`**
- Line 157: Remove 🐾 from "Play to see your rank"
- Line 158: Remove the `<span>🐕</span>` element
- Line 163: Remove 🐕 from "P(L)AY NOW" button
- Line 230: Remove 🐕 from empty state

**`public/game/index.html`**
- Line 251: Remove 🐕 from "Learn More About Benji Pays" link
- Line 950: Remove 🐕 from share text

**`public/game/src/GameOverScene.js`**
- Line 61: Remove 🐕 from share text

**`public/strategy/index.html`**
- Line 170: Remove 🐕 from badge
- Line 292: Remove 🐕 from "Play Invoice Rover" button

**`public/admin/index.html`**
- Line 15: Remove 🐕 from login logo

### 3. Keep internal links in same tab, external links in new tab

**`public/game/index.html`**
- Line 196: `benjipays.com` logo link — keep `target="_blank"` (external site)
- Line 211: `benjipays.com/invoice-rover/` link — keep `target="_blank"` (external)
- Line 251: `benjipays.com/demo` link — keep `target="_blank"` (external)
- Line 1051: `window.open('https://benjipays.com','_blank')` — keep as-is (external)

**`public/strategy/index.html`**
- Lines 157, 292, 293: Change `benji-pays-game.netlify.app` links to use `postMessage` navigation (these are internal game/leaderboard links that should stay in-tab)
- Line 294: `suno.com` playlist link — keep `target="_blank"` (external)

All `postMessage`-based navigation already stays in the same tab, so no changes needed for those.

### Technical details
- The strategy page currently links to `benji-pays-game.netlify.app` which appears to be an old deployment URL. These will be changed to use `postMessage` navigation to `/game` and `/leaderboard` routes to stay in the same tab.
- No database or backend changes needed.

