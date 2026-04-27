## Investigation summary

### Admin login — backend is healthy
Auth logs from the last hour show admin sign-in is **working end to end**:
- Google OIDC login succeeded (`chris.mitchell@benjipays.com`, 200)
- TOTP MFA challenge + verify succeeded (200, login_method=`mfa`)
- `admin-invite` edge function: only `booted` logs, no errors
- `get_admin_stats` (aal2-gated) calls succeeded against the user endpoint

So the backend is fine. Failures are almost always **per-user environmental issues**. The most common causes for "admin login isn't working":

1. **Popup blocked / closed** — Google sign-in opens an OAuth popup. Adblockers, brave shields, or accidental closes throw `Sign in was cancelled` / `Popup was blocked`. The current UI surfaces this only in `loginError` text under the button — easy to miss.
2. **Wrong Google account** — login enforces `@benjipays.com` (`hd: 'benjipays.com'` hint + `validateDomain` check). If the user's default Google account is personal, the popup signs them in with the wrong account, then `handleOAuthSession` calls `signOut()` with message *"Access restricted to @benjipays.com"*.
3. **No invite + no role** — first-time login requires a row in `admin_invites`. If missing → *"Access denied — no admin invite found"* and immediate sign-out. We can't see who's reporting it, so we can't confirm they were invited.
4. **MFA enrollment hang** — past memory note: the MFA "blue screen" hang can recur if a stale unverified factor sticks around. The current code unenrolls unverified factors before re-enrolling, so this should be OK, but worth confirming with the affected user.
5. **Stale session / cached aal1 JWT** — handled in code (`ensureAal2Token` + `refreshSession` retry).

### Game lag — code is reasonable but has a few real costs
`src/features/game/shellRuntime.ts` `gameLoop` (one player canvas loop, runs at rAF):
- Object pools are capped (Obstacles 30 / Collectibles 20 / Powerups 8 / Particles 80) ✓
- `try/catch` around the loop forces `endGame` on crash ✓
- **`document.getElementById('scoreDisplay').textContent = Math.floor(score)` is called every frame** (line 798). This is a DOM write 60×/s even when the integer hasn't changed.
- **`wrap.querySelectorAll('.score-pop')` runs every frame** (line 811) just to cap to 12 — a DOM query per frame.
- **`ctx.save()/restore()` + `ctx.shadowBlur` is used for every collectible, powerup, obstacle, and particle** (lines 822–825). Canvas shadows are the single most expensive per-draw operation in 2D canvas — on a low-end phone, drawing ~30 obstacles + 20 collectibles + 80 particles each frame with shadows is the most likely culprit.
- **Per-frame allocations**: `obstacles=obstacles.filter(...)`, `collectibles=...filter`, `powerups=...filter`, `particles=...filter`, plus a destructured/intermediate `slice` when capping. That's 4–5 new arrays + lots of closures every frame → GC pressure on mobile.
- No mobile-aware downscale. The previous `public/game/src` had a 1.5× DPR cap on coarse-pointer devices and reduced particle counts on mobile (per memory). The current shell loop does not — on a Retina phone the canvas is rendering at 2–3× pixel density with full shadow effects.
- `Math.sqrt(dx*dx+dy*dy)` for collision in three forEach loops — fine on desktop, but compare-against-squared-radius would skip the sqrt.

The auth logs / network logs don't show any backend slowness — the lag is client-side rendering cost.

---

## Plan

### A. Admin login — add diagnostics + better UX (small)
1. Expose login errors more visibly: keep `loginError` text but also `console.warn` the underlying provider error so we (and the user) can read it from devtools.
2. Detect the specific "wrong Google account" case: when `validateDomain` fails, change the message to *"You're signed in as `<email>`. Admin access requires a @benjipays.com account. Use 'Use a different account' in the Google popup."* — much more actionable than the generic line today.
3. Detect the "no invite" case: when `admin-invite claim` returns 403 *no invite found*, show the user's email in the error so we can tell whether they used the right Google account before chasing an invite.
4. Add a brief console log line at each step of `handleOAuthSession` (`session received`, `domain ok`, `role check`, `claim attempt`) — gated to one short log per stage so we can read the user's session replay if it happens again.
5. Ask the reporting user (verbally / in chat reply) for: which email address they tried, which browser, whether a popup appeared, whether they got an error toast, and a screenshot.

### B. Game performance — three small, safe wins
Targeting the cheapest highest-impact reductions; no gameplay changes.

1. **Cap canvas device pixel ratio on mobile** in the shell setup (where the canvas is sized): clamp `devicePixelRatio` used for the backing store to `1.5` on `matchMedia('(pointer: coarse)')` devices, `2` otherwise. This alone typically cuts mobile GPU/fillrate cost ~40%.
2. **Skip per-frame `setText` when score hasn't changed**: cache `lastScoreText`; only write `scoreDisplay.textContent` when `Math.floor(score) !== lastScoreText`.
3. **Drop `ctx.shadowBlur` on coarse-pointer devices**: gate the `shadowBlur`/`shadowColor` calls in the four draw passes (collectibles, powerups, obstacles, particles) behind `!isMobile`. Sprites still render — they just lose the glow halo on mobile, where it's the single biggest per-draw cost.
4. **Replace `wrap.querySelectorAll('.score-pop')` per frame** with an existing counter: `score-pop` elements are added in `scorePop()` and auto-removed by their own animation/timer; track an in-memory count and only query/cull when the counter exceeds 12.
5. **Squared-distance collision** for the three collision forEach loops (no `Math.sqrt`). Trivial change, measurable on mobile.
6. Optional follow-up (not in this pass): pool particle objects instead of allocating per-burst; would need a slightly bigger refactor.

### C. What we are *not* changing
- No DB / RLS / edge function changes — backend is healthy.
- No gameplay tuning (speeds, spawn rates, lives) — purely render cost.
- No new UI surfaces.

---

## Files to touch
- `src/pages/admin/AdminView.tsx` — better login error messaging + step logs in `googleSignIn` / `handleOAuthSession`.
- `src/features/game/shellRuntime.ts` — DPR clamp, `lastScoreText` cache, mobile shadow gating, score-pop counter, squared-distance collision.

---

## Open question for the user before I implement
- Do you know **who** reported the admin login failure and **which email** they used? If they're not in `admin_invites` and don't have an `admin` role yet, no code change will let them in — they need an invite first.