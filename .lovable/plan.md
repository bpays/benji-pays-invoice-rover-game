# Fix: Intermittent blurry / right-margin game render on mobile

## What the user sees
On mobile, occasionally:
- The game looks low quality (blurry / pixelated)
- There is a margin on the right side of the playfield
- A page refresh fixes it

## Root cause

In `src/features/game/shellRuntime.ts`, the canvas sizing has gaps:

1. **`resizeCanvas()` is never called on initial mount** — it only runs from the `window` `resize` listener. If no resize fires before the first frame paints, the canvas backing store stays at the default **300×150** and is stretched by CSS to fill the wrap. Result: blurry render.
2. **Only the `resize` event is observed.** On mobile:
   - `orientationchange` may fire without a `resize`
   - The mobile URL-bar collapse fires `visualViewport` resize, not always `window.resize`
   - Layout settles in stages (fonts, dvh resolving, safe-area insets, the inline `#benji-loading` overlay being removed) — none of these re-trigger a measure
3. **No `ResizeObserver` on `#gameWrap`.** When the wrap's actual `clientWidth` changes due to any of the above, the canvas is never resized to match → the visible CSS box becomes wider than what the canvas occupies, producing the right-side gap.
4. The mobile branch in `src/styles/game.css` switches `#app` to `align-items: stretch; justify-content: flex-start` and adds `padding-left/right: env(safe-area-inset-*)`. If the wrap is measured before insets resolve, the wrap is narrower than the final layout — and stays that way because nothing re-measures.

## Fix (single file: `src/features/game/shellRuntime.ts`)

1. **Call `resizeCanvas()` immediately on mount**, right after the canvas/wrap refs are obtained, and again on the next `requestAnimationFrame` to catch post-layout values.
2. **Add an `orientationchange` listener** that calls `onWindowResize()`.
3. **Listen to `window.visualViewport` `resize`** (when present) and call `onWindowResize()`.
4. **Attach a `ResizeObserver` to `#gameWrap`** that calls `onWindowResize()` whenever its content box changes. This catches font-load reflows, the loader removal, dvh recompute, safe-area insets resolving, and any future layout source.
5. **Guard against zero-size measurements**: in `resizeCanvas()`, if `wrap.clientWidth` or `clientHeight` is `0`, skip and re-schedule on the next animation frame (prevents locking in a degenerate size if measured during a transient layout state).
6. **Clean up** all new listeners and the `ResizeObserver` inside the existing unmount path (`__unmountGameShell`) so `resetInvoiceRoverGameMount` stays leak-free.

## Technical sketch

```ts
function resizeCanvas() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  if (w === 0 || h === 0) {
    requestAnimationFrame(resizeCanvas);
    return;
  }
  const dprCap = __BP_IS_MOBILE ? 1.5 : 2;
  const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  canvas.width = w * dpr; canvas.height = h * dpr;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// Initial measure (immediate + post-layout)
resizeCanvas();
requestAnimationFrame(() => { resizeCanvas(); updateGameBleedShades(); });

window.addEventListener('resize', onWindowResize);
window.addEventListener('orientationchange', onWindowResize);
window.visualViewport?.addEventListener('resize', onWindowResize);

const wrapRO = new ResizeObserver(() => onWindowResize());
wrapRO.observe(wrap);

// In unmount:
window.removeEventListener('orientationchange', onWindowResize);
window.visualViewport?.removeEventListener('resize', onWindowResize);
wrapRO.disconnect();
```

## What this does not change
- DPR caps, shadow gating, and other perf work stay as-is.
- No CSS changes — the mobile layout (`@media (max-width: 600px)`) is correct; the bug is purely the canvas not re-measuring to match it.
- Audio / admin / scoring code untouched.

## Verification after build
- Hard-refresh the game on a phone several times in portrait, then rotate to landscape and back.
- Toggle the mobile URL bar by scrolling — the canvas should remain crisp and flush to both edges.
- No right-side gap should appear regardless of when the loader hides relative to first paint.
