# Fix music toggle logic across all three sound buttons

The game has **three sound toggle buttons** that have drifted out of sync. This is almost certainly why the player reported "sound effects but no music" — one button was toggled off and the others still displayed "Music On", so the global `soundOn` flag was actually `false` while the UI lied about it.

## Buttons involved

| Button id | Where it lives | Current handler |
|---|---|---|
| `startSoundBtn` | Start screen | `toggleMusicFromStart` (line 506) |
| `soundBtn` | In-game HUD (bottom right) | inline handler (line 992) |
| `overSoundBtn` | Game-over screen | `toggleSoundFromGameOver` (line 892) |

There is also a **dead** `toggleSoundFromStart` function (line 884) that nothing calls — leftover from a prior refactor.

## Bugs to fix

1. **Buttons don't sync with each other.** Each toggle updates only some of the three button labels, so flipping one leaves the others showing the wrong state.
2. **Dead duplicate code.** `toggleSoundFromStart` (line 884) is unreachable — only `toggleMusicFromStart` is actually wired up. Confusing and risky.
3. **Game-over toggle plays title music.** When you die, music is intentionally stopped. If you toggle music back on from the game-over screen, `toggleSoundFromGameOver` calls `playTitleMusic()` — but you're not on the title screen. It should be a no-op for music while on the game-over screen (the next retry/CTA flow will start city music again).
4. **In-game toggle ignores game-over button label.** Toggling sound off mid-run, then dying, leaves `overSoundBtn` showing "🔊 Music On".

## Fix

Consolidate into a **single** `setSoundOn(on, opts)` helper that:

- Updates `soundOn` once.
- Updates the label/icon on **all three** buttons every time, regardless of which one was clicked.
- Decides what to play based on the current `state` (`'start' | 'playing' | 'gameover'`):
  - `start` → `playTitleMusic()` when turning on, `stopMusic()` when off.
  - `playing` → `swapToDayMusic(currentCity?.name || 'Vancouver')` when on, `stopMusic()` when off.
  - `gameover` → no music either way (it's intentionally silent there); `stopMusic()` if turning off.
- Resumes the AudioContext if suspended.

Wire all three buttons (`startSoundBtn`, `soundBtn`, `overSoundBtn`) to call `setSoundOn(!soundOn)`.

Delete the dead `toggleSoundFromStart` function. Keep `toggleMusicFromStart` and `toggleSoundFromGameOver` as thin wrappers around `setSoundOn` (or remove them entirely and inline the listener — preferred, less surface area).

## Files

- `src/features/game/shellRuntime.ts` — single edit covering lines ~506–513, ~884–903, ~992–1004.

## Out of scope

- Splitting "music" and "SFX" into independent toggles. Today `soundOn` controls both (`beep()` checks `soundOn` at line 499). The reporter's "SFX work, music doesn't" is consistent with desynced UI, not separate channels — no split needed.
- Autoplay-policy changes. Music already correctly waits for a user gesture (Play button or sound toggle).
