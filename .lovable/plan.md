# Remove white power-up backgrounds & shorten Shield duration

Three small changes to `src/features/game/shellRuntime.ts`:

## 1. Remove the white circle behind in-game power-up sprites

In `drawPUSprite` (around lines 628–645), drop the white-fill circle and the colored ring around it. Just draw the sprite directly so the transparent PNG (Shield / Instant Pay) sits cleanly on the playfield.

Replace the white-circle block with a no-op — keep the clipping/scaling so the icon still sizes correctly, or simply draw the image at the computed size with no backdrop.

## 2. Remove the white pill behind the "POWER-UP" label

In `drawPartnerBoostBadge` (around lines 602–620), remove the white rounded-rect fill and just draw the keyed-out label image. The image already has its own styled lettering, so no plate is needed.

(Same treatment is intentionally NOT applied to the COLLECT/DODGE labels — those keep their existing white plate.)

## 3. Shield duration: 15s → 7.5s

In `PU_TYPES` (line 223), change the `halopsa` (Shield) entry:
- `dur: 15*60` → `dur: 7.5*60`
- `effect: 'INVINCIBILITY · 15s'` → `'INVINCIBILITY · 7.5s'`

Other power-up durations stay the same.

## Files touched

- `src/features/game/shellRuntime.ts` only.
