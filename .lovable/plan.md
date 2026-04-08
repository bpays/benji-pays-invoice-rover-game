
Goal: fix the actual live game and page wiring, not the unused Phaser source files.

What I found
- The preview/live route `/game` renders `public/game/index.html` inside an iframe via `src/App.tsx`.
- The currently running game is the custom canvas game in `public/game/index.html`, not `public/game/src/GameScene.js`.
- That explains why the earlier controller work appears to do nothing: it was added to files that are not driving the live experience.
- The “Book a Demo” and “Learn more” actions already exist in `public/game/index.html`, but they use `window.open(...)` from inside the iframe, which is likely being blocked or ignored in preview/live.
- “Play again” is also in `public/game/index.html`; its current logic shows the CTA screen after multiple plays instead of always restarting, which matches the “doesn’t work” report.
- The leaderboard layout issue is in `leaderboard/index.html` and `public/leaderboard/index.html`, where the main CTA is fixed to the bottom and can overlap the scrollable content.

Implementation plan

1. Fix controller support in the real game
- Update `public/game/index.html` and `game/index.html`, since those files power the live game.
- Add gamepad polling to the active canvas loop:
  - left stick horizontal movement with deadzone
  - LT/LB move left
  - RT/RB move right
  - jump on A and X
  - rising-edge handling so held buttons do not spam actions
- Keep the existing connected-controller indicator, but wire it to the same real gamepad detection used by gameplay so the indicator and controls stay in sync.
- Allow controller start/restart from the start screen, CTA screen, and game-over state.

2. Fix “Play again”
- Change the game-over “Run Again” flow so it always restarts the run immediately.
- If you still want the promo CTA after a run, I’ll keep it reachable separately instead of hijacking the retry action.
- Also let controller confirm buttons restart from the game-over/CTA screens.

3. Fix external links in the iframe
- Replace iframe-local `window.open(...)` handlers for:
  - Book a Demo → `https://benjipays.com/demo`
  - Learn more → `https://benjipays.com`
- Use a top-level navigation approach that works reliably from inside the embedded iframe in preview and live.

4. Fix leaderboard CTA placement and scroll space
- Move the “Run With Benji” button from the fixed footer into the page flow above the leaderboard list.
- Remove the fixed bottom CTA bar so it no longer covers content.
- Add enough bottom padding/margin after the list so the full leaderboard can be scrolled into view cleanly.

5. Keep mirrored files aligned
- Apply the same HTML/JS fixes in both:
  - `public/game/index.html` and `game/index.html`
  - `public/leaderboard/index.html` and `leaderboard/index.html`
- This avoids preview/live drift.

Technical notes
- The key bug is architectural: controller logic was added to Phaser scene files, but the shipped experience is the standalone HTML canvas game.
- The safest fix is to patch the active runtime in `public/game/index.html`.
- For external links from iframe content, top-window navigation or direct anchor links are more reliable than `window.open`.
- For gamepad support in the active game, I’ll centralize input state near the existing keyboard/touch handlers and consume it inside the main game loop.

Files I expect to update
- `public/game/index.html`
- `game/index.html`
- `public/leaderboard/index.html`
- `leaderboard/index.html`
