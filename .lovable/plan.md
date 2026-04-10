

## Plan: Admin Page — Reset Confirmation + Remove Timer Section

### 1. Add two-step safety confirmation to "Reset Event Scores" button

**File: `public/admin/index.html`** (~line 497)

Replace the simple `confirm()` with:
1. A strongly worded `confirm()` warning that this permanently deletes all scores and should only be done after the event ends and all data (CSV exports, etc.) has been collected
2. A `prompt()` requiring the user to type the exact event name to proceed; abort with a toast if it doesn't match

### 2. Remove the Leaderboard Reset Timer section

**File: `public/admin/index.html`**

- **HTML** (lines 78-95): Remove the entire "Leaderboard Reset Timer" section div (countdown display, date picker, +24h/+8h/+4h buttons, Reset Now button)
- **JS** (line 283): Remove `resetSeconds` and `timerInterval` variables
- **JS** (line 528): Remove `loadTimerSetting()` and `startTimer()` calls from `init()`
- **JS** (lines 647-694): Remove functions `loadTimerSetting()`, `startTimer()`, `setTimer()`, `setTimerHours()`, and `resetNow()`

The daily leaderboard resets automatically at midnight ET via the `get_daily_leaderboard` RPC — no manual timer is needed. The event reset button (with the new safety confirmation) remains for post-event cleanup.

