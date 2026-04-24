## Problem

The runtime error `Uncaught Error: supabaseUrl is required.` happens because `src/integrations/supabase/client.ts` reads `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, but the project's `.env` file is missing from the sandbox (only `.env.example` exists). `.env` is in `.gitignore`, so when the recent large change reset the workspace, the managed `.env` was lost and Vite built/served the app with `undefined` for both values — which crashes `createClient()` immediately on load.

## Fix

1. Recreate `/dev-server/.env` with the known-good Lovable Cloud values:
   - `VITE_SUPABASE_URL=https://wowzqjrvmgkcustjdxpo.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY=<the project's publishable anon key>`
   - `VITE_SUPABASE_PROJECT_ID=wowzqjrvmgkcustjdxpo`
2. Restart the Vite dev server so the new env is picked up by the preview.
3. Verify the preview loads (no `supabaseUrl is required` error, Supabase requests succeed).
4. Once preview is healthy, the user should republish so `invoicerovergame.lovable.app` (and the custom domains) get a build with the env baked in.

## Notes

- No app code changes are needed — the client code is correct.
- `.env` stays gitignored; it is regenerated/managed by the Lovable Cloud integration.
- If after restart the preview still fails, the next step is to refresh the Lovable Cloud integration so it re-emits `.env`.
