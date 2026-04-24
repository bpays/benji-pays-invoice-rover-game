# Replace partner branding with generic Power-Up icons

## What changes

The third legend card on the start screen currently shows 4 partner logos (HaloPSA, ScalePad, Moneris, Elavon) with a "Partner Boost" label. Replace that with the two new pixel-art icons (Shield, Instant Pay) and a new "POWER-UP" label, matching the layout of the Collect and Dodge cards.

The same partner sprites are also used in-game as the actual power-up pickups, so update those to match.

## New assets to add

Copy the three uploaded images into `public/game/assets/powerups/`:

- `shield.png` (from `user-uploads://Shield.png`) — represents the invincibility shield power-up
- `instant-pay.png` (from `user-uploads://Instant_Pay.png`) — represents the boost / score-multiplier power-up
- `power-up-label.png` (from `user-uploads://POWER_UP.png`) — the "POWER-UP" label image used under the icons

## Files to edit

### 1. `src/features/game/appInnerHtml.ts` (the start screen legend, ~line 50–53)

Replace the third legend card so it matches the structure of the Collect and Dodge cards:

- Show two icons: `shield.png` and `instant-pay.png` (sized like the other 2-icon cards, not the 4-up grid)
- Show the `power-up-label.png` underneath via `legend-title-img`
- Update the `aria-label` to "Power-ups: Shield and Instant Pay"
- Remove `legend-title-partner` modifier so it uses the standard label sizing like Collect/Dodge

### 2. `src/styles/game.css`

Remove or repurpose `.legend-partner-icons` (the 2×2 grid layout) since the new card uses 2 horizontal icons. Easiest: change the third card's icon container class to `legend-collect-icons` (already styled as a horizontal row at the right size), or add a generic `.legend-powerup-icons` rule mirroring `.legend-collect-icons`.

Also drop the now-unused `.legend-title-partner` override.

### 3. `src/features/game/shellRuntime.ts` (in-game power-up sprites)

Update `PU_TYPES` (lines 222–227) so the four power-up types use the two new generic icons instead of partner logos:

- `halopsa` (shield / invincibility) → `img: '/game/assets/powerups/shield.png'`, name `'Shield'`
- `moneris` (paid-in-full / clear obstacles) → `img: '/game/assets/powerups/shield.png'`, name `'Paid In Full'` (keeps shield iconography for the "save" effect) **or** keep using `instant-pay.png` — see Decisions below
- `scalepad` (2× score boost) → `img: '/game/assets/powerups/instant-pay.png'`, name `'Boost'`
- `elavon` (double points streak) → `img: '/game/assets/powerups/instant-pay.png'`, name `'Payment Streak'`

Update the badge constant at line 267:
```
const PARTNER_BOOST_BADGE = '/game/assets/powerups/power-up-label.png';
```
Rename the helper `getPartnerBoostBadgeKeyOut` → `getPowerUpBadgeKeyOut` and `drawPartnerBoostBadge` → `drawPowerUpBadge` for clarity (purely cosmetic refactor; update the call site at line 846).

Game IDs (`halopsa`, `moneris`, etc.) stay the same so nothing else breaks — only display names and sprites change.

## Decisions you may want to weigh in on

1. **Icon mapping for the 4 in-game power-ups** — there are 4 effects but only 2 icons. Default mapping above uses Shield for defensive effects (invincibility, clear obstacles) and Instant Pay for offensive/scoring effects (2× boost, streak). Let me know if you'd prefer a different split.
2. **Power-up display names** — I'll drop the partner brand names ("HaloPSA Shield" → "Shield", etc.). Confirm or supply preferred names.

## Visual result

Start screen third card will look like the Collect / Dodge cards: two horizontal pixel-art icons on top, "POWER-UP" label image underneath. In-game pickups will drop the same Shield or Instant Pay sprite (depending on effect) with the POWER-UP banner overlay.
