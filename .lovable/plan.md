

## UI and Copy Updates for Benji Pays Game

### Summary of Changes

All changes are in `public/game/index.html`. The root `index.html` is fine as-is.

### 1. GTags and HubSpot Placement -- Already Correct
- **GTM script** is in `<head>` (lines 4-10) -- correct
- **GTM noscript** is in `<body>` (lines 103-106) -- correct
- **HubSpot** is at end of `<body>` (lines 1011-1013) -- correct
- Root `index.html` also has both in the right spots. No changes needed.

### 2. Logo Links to benjipays.com
- Wrap the `<svg class="logo-svg">` (line 125-137) inside an `<a href="https://benjipays.com" target="_blank">` tag

### 3. Update "How to Play" Steps
- Replace the current 6-item grid (line 153) with 5 items:
  1. Tap to Jump
  2. Collect payments, autopay and installments
  3. Power up with integrations
  4. Dodge excuses, delays and NSF
  5. Build combinations

### 4. Play Button Text
- Change `RUN WITH BENJI →` (line 150) to `P(L)AY NOW`

### 5. Rename "Score"/"points" to "$ Collected"
- HUD label (line 111): `Score` → `$ Collected`
- HUD score display in JS (line 827): update `scoreDisplay` text
- Game over stat label (line 167): `Final Score` → `$ Collected`
- Share copy text (line 859): replace "scored X pts" with "collected $X"

### 6. Bigger Final Score + New Copy
- Make the `#finalScore` stat card span full width and increase font size
- Change the game over title area to say: **Collected $X in Accounts Receivable** (larger text, replacing or augmenting the current "WIPED OUT" title)

### 7. "Learn More About Benji Pays" Button
- Add a prominent button between the music toggle (line 177) and leaderboard link (line 178) on the game over screen
- Links to `https://benjipays.com/demo`
- Styled as a large CTA button matching the game aesthetic

### Files Modified
- `public/game/index.html` (all changes in this single file)

