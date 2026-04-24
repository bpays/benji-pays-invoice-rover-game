## What's wrong

Your app code is fine. The Vite dev server in the sandbox is crash-looping because of a known npm bug ([npm/cli#4828](https://github.com/npm/cli/issues/4828)) with Rollup's optional native binaries:

```
Error: Cannot find module @rollup/rollup-linux-x64-gnu
```

After a large change, `package-lock.json` got out of sync and npm skipped installing the Linux-specific Rollup binary that Vite needs to start. Result: blank preview.

This is **not** related to:
- Your Supabase env variables (those are still set)
- Your edge functions (`submit-score`, `admin-invite`)
- Your React/routing code
- The recent profanity-filter / leo-profanity work

## Fix

Two small steps, both in the sandbox — no app code changes:

1. **Reset the broken install**
   - Delete `node_modules/` and `package-lock.json`
   - Run a clean `npm install` so npm correctly picks up `@rollup/rollup-linux-x64-gnu` as an optional dep for the Linux sandbox

2. **Verify Vite boots**
   - Tail `/tmp/dev-server-logs/dev-server.log` and confirm Vite starts on port 8080 with no rollup error
   - Reload the preview to confirm `/`, `/leaderboard`, and `/admin` render

## Why nothing else needs to change

- `package.json` itself is fine — this is purely an install-state bug
- No need to pin or downgrade Rollup/Vite; the clean reinstall resolves it
- Env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) are unaffected — they only matter once Vite is actually running
- Edge functions are deployed independently and aren't impacted

Approve and I'll run the reinstall and verify the preview comes back up.