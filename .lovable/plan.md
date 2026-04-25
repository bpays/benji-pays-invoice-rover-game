The mobile lag is in the Phaser game loop, not in React. After reading `public/game/src/GameScene.js`, `config.js`, and `main.js`, I can see specific things that crush mobile FPS:

1. **Phaser is rendering at full device pixel ratio.** `main.js` sets the canvas to 390x844 with `Phaser.Scale.FIT` and no resolution cap. On a phone with `devicePixelRatio: 3`, Phaser renders at ~3x the pixels per frame, which is the single biggest cause of low FPS.
2. **Per-frame Text mutations.** `updateHUD()` runs every 100ms and calls `setText` plus `setVisible` on multiple `Text` objects. Each `setText` recreates a canvas texture for that text — expensive on mobile GPUs.
3. **Per-frame style mutations.** `setStrokeStyle`, `setFillStyle`, and `setAlpha` are called every frame on the shield ring, power-up bar, and Benji group. Each one dirties the GPU pipeline.
4. **Heavy emoji `Text` objects everywhere.** Obstacles, collectibles, power-ups, and badges are all `add.text` (one Text per spawn), which means several texture uploads per spawn, garbage collection pressure, and slow text rendering.
5. **No object pooling.** Every spawn does `add.rectangle` / `add.text` and every despawn does `.destroy()`, plus `burst()` creates 8–12 short-lived circles per hit. This thrashes WebGL texture allocation on mobile.
6. **Animations driven by `Math.sin(time*…)` on multiple targets** (legs, tail, body bounce, shield ring) — fine on desktop, but combined with the above this adds up.

I will not change gameplay tuning, lane layout, or visual style. The goal is purely smoother mobile FPS.

Plan:

1. Cap render resolution
   - Add a `resolution` setting / scale cap in `main.js` so the canvas does not render above ~1.5x device pixel ratio on mobile.
   - Force `roundPixels: true` to skip subpixel rasterization.
   - Disable `antialias` for the WebGL renderer (Phaser still looks crisp because everything is solid colors and emoji).

2. Throttle HUD updates
   - Only call `setText` on `hudScore`, `hudCombo`, and `hudMulti` when the displayed value actually changes.
   - Stop calling `setVisible` every frame; only toggle it on transitions.

3. Reduce per-frame style churn
   - Remove `setStrokeStyle` and `setFillStyle` calls from inside `update()`. Set them once when state changes (shield activated, warning starts, etc.).
   - Replace per-frame `benjiGroup.setAlpha` flashing with a Phaser tween that runs only while flashing is active.

4. Lighter spawn objects
   - Reduce concurrent on-screen text objects: drop the small "DODGE" / "COLLECT" / "POWER-UP" badge text on small viewports (mobile breakpoint by viewport width). Keep them on desktop.
   - Cap particle bursts on mobile (e.g. 4 instead of 8–12).

5. Object pooling for spawns and particles
   - Add a simple pool for obstacles, collectibles, power-ups, and burst particles so they get reused with `setActive(true)/setVisible(true)` instead of being created/destroyed each spawn.
   - Honor existing pool caps from memory: Obstacles 30, Collectibles 20, Power-ups 8, Particles 80.

6. Minor loop hygiene
   - Do leg/tail bounce math less often (every other frame) on mobile.
   - Avoid recreating the `types` arrays inside each spawn function — hoist them to module scope or `create()`.

7. Validate
   - Run a production build and a development build to confirm nothing is broken.
   - Use the browser performance profiler against the preview to verify the JS frame time goes down on a small viewport.
   - Keep all gameplay numbers in `config.js` unchanged.

Out of scope:
- No changes to game balance, scoring, city thresholds, or controls.
- No changes to React app shell, Supabase, auth, or leaderboard.
- No visual redesign — the look stays the same; mobile just gets a smaller render target and fewer per-frame allocations.

After approval I will implement steps 1–6, then run the builds and profile.

<lov-actions>
  <lov-open-history>View History</lov-open-history>
</lov-actions>