# Fix: Slight hitch on side-swipes (mobile)

## What's happening

In `src/features/game/shellRuntime.ts` the swipe handlers are:

```js
wrap.addEventListener('touchstart', e => { txS = e.touches[0].clientX; tyS = e.touches[0].clientY; ttS = Date.now(); }, {passive:true});
wrap.addEventListener('touchend',   e => { /* compute dx/dy; change lane on release */ }, {passive:true});
```

Lane changes happen **only on `touchend`** — i.e. after the finger lifts. The player visual then eases toward the new lane via `benjiX += (laneX(targetLane) - benjiX) * .17 * delta`. Two real effects make this feel like a "slight hitch":

1. **Input latency**: The lane change is held back until the finger leaves the screen. On a deliberate slow swipe, that's ~80-200ms where nothing is happening — reads as a stutter at the start of the move.
2. **No mid-swipe lane chaining**: A long horizontal drag past two lane-widths still only nudges one lane (because we only read `dx` once at release). If a player tries to swipe two lanes fast, the second lane never registers — feels like dropped input.

There's no actual frame-rate hitch here; the GPU/loop work on swipe is trivial. It's perceived latency from the gesture model.

## Fix (single file: `src/features/game/shellRuntime.ts`, lines ~915-917)

Switch to a `touchmove`-driven model that fires the lane change as soon as the finger crosses the swipe threshold, then resets the anchor so a continued drag can chain to the next lane:

```js
let txS = 0, tyS = 0, ttS = 0, swipedX = false;
const SWIPE_PX = 28;

wrap.addEventListener('touchstart', e => {
  if (state !== 'playing') return;
  txS = e.touches[0].clientX; tyS = e.touches[0].clientY;
  ttS = Date.now(); swipedX = false;
}, {passive:true});

wrap.addEventListener('touchmove', e => {
  if (state !== 'playing') return;
  const t = e.touches[0];
  const dx = t.clientX - txS, dy = t.clientY - tyS;
  // Horizontal-dominant swipe: fire as soon as threshold crossed, then re-anchor
  if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0) { if (targetLane < 2) targetLane++; }
    else        { if (targetLane > 0) targetLane--; }
    txS = t.clientX; tyS = t.clientY; // re-anchor so a long drag chains lanes
    swipedX = true;
  }
}, {passive:true});

wrap.addEventListener('touchend', e => {
  if (state !== 'playing') return;
  if (swipedX) return; // already handled in move
  const dx = e.changedTouches[0].clientX - txS;
  const dy = e.changedTouches[0].clientY - tyS;
  const dt = Date.now() - ttS;
  // Tap-to-jump only — no horizontal motion of consequence
  if (Math.abs(dx) < SWIPE_PX && Math.abs(dy) < SWIPE_PX && dt < 300 && !isJumping) doJump();
}, {passive:true});
```

Notes:
- Listeners stay `passive:true` so we never block scroll resolution (and `#gameWrap` already has `touch-action:none` so the browser isn't fighting us).
- Mouse handlers (`mousedown`/`mouseup`) are unchanged — desktop swipes happen on release and that's fine.
- Vertical tap-to-jump still works; we just gate it on "no horizontal swipe was already consumed."
- Lane lerp (`.17 * delta`) and everything else stays the same — the visual ease is intentional.

## Why this fixes the perceived hitch
- Lane intent registers within ~28px of finger movement instead of waiting for liftoff → no dead time at the start of a swipe.
- Long drags can chain into a 2nd lane change → no "dropped input" sensation when the player tries to cross from lane 0 to lane 2.

## Out of scope
- No CSS, audio, scoring, or rendering changes.
- No new dependencies.
