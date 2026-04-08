

## Plan: Add Gamepad Controller Support

### Summary
Add gamepad input support to `GameScene.js` for two controller types: Xbox and "Tata". Poll gamepad state each frame in the `update()` loop.

### Controller Mappings

| Action | Xbox Controller | Tata Controller |
|--------|----------------|-----------------|
| Move left | Left stick left, LT (axis 6/button 6), LB (button 4) | Left stick left |
| Move right | Left stick right, RT (axis 7/button 7), RB (button 5) | Left stick right |
| Jump | A button (B0) | X button (B3) |

### File Changes

**`public/game/src/GameScene.js`**

1. **Enable gamepad in `create()`**: Add `this.input.gamepad.once('connected', ...)` listener. Initialize tracking state (`this.padPrevLeft`, `this.padPrevRight`, `this.padPrevJump`) for edge detection so holding a button doesn't repeat actions every frame.

2. **Add gamepad polling in `update()`**: At the top of the update loop (after the alive check), read the first connected pad. Check:
   - **Left stick X axis**: Use a deadzone (~0.3). On crossing threshold left/right (edge-triggered), change `targetLane`.
   - **LT/RT (buttons 6/7 or axes)**: Edge-triggered lane changes.
   - **LB/RB (buttons 4/5)**: Edge-triggered lane changes.
   - **Jump buttons**: A (index 0) for Xbox, X (index 3) for Tata — both checked, so either controller "just works" without needing a controller-type selector.

3. **Edge detection logic**: Track previous frame's button/stick state. Only trigger lane change or jump on the transition from "not pressed" to "pressed" (rising edge). This prevents continuous lane switching while a button is held.

**Sync**: Copy updated `public/game/src/GameScene.js` to `game/src/GameScene.js`.

### Technical Notes
- Phaser 3's gamepad API uses the standard Gamepad API mapping. Button indices: 0=A/Cross, 1=B/Circle, 2=X/Square, 3=Y/Triangle, 4=LB, 5=RB, 6=LT, 7=RT.
- Both jump buttons (B0 and B3) will be active simultaneously — no need for a controller selector. This means either controller can use either button.
- The left stick deadzone prevents drift from causing unintended lane changes.
- No config.js changes needed; gamepad settings are simple enough to keep inline.

