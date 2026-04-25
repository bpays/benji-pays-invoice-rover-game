I’ll apply the build-tool fix, not another app-code change. The failure is happening before the app builds: Vite’s installed package is missing its own internal `dist/node/chunks/dep-*.js` file, so publish/preview can fail even when the app source is fine.

Plan to fix it:

1. Clean the corrupted dependency state
   - Remove the broken installed `node_modules` state from the project environment.
   - Keep dependency truth in `package.json` and `bun.lock` only.
   - Do not edit files inside `node_modules` manually.

2. Add a Vite integrity guard
   - Create a small script that checks the installed Vite CLI before `dev`, `build`, or `build:dev` runs.
   - It will read Vite’s `cli.js`, detect the internal `./chunks/dep-*.js` import, and verify that file exists.
   - If Vite is incomplete, it will repair the local Vite install from the lockfile or stop with a clear error instead of the confusing `ERR_MODULE_NOT_FOUND` stack trace.

3. Make preview and publish use the same guard
   - Update scripts so all build paths go through the guard first:
     - `dev`
     - `build`
     - `build:dev`
   - This addresses both the publish failure and the preview “build unsuccessful” message.

4. Keep package management consistent
   - Keep Bun as the project package manager because the project is already configured with `packageManager: bun@1.3.3` and `bun.lock`.
   - Avoid adding npm lockfiles or relying on npm-installed dependency state.
   - Locally, `npm run dev` can run the script, but dependency installation should not be mixed. The safer local flow will be `bun install`, then `bun run dev` / `bun run build`.

5. Validate from scratch
   - Perform a clean install from the lockfile.
   - Run production build: `bun run build`.
   - Run development build: `bun run build:dev`.
   - Check the preview server log to confirm the missing Vite chunk error is gone.

Fallback if the package cache still installs broken Vite:

6. Move Vite to a different exact patch version and regenerate the lockfile
   - If a clean lockfile install still creates a Vite package without its `dist/node/chunks` files, I’ll pin a different exact Vite version that installs complete files in this environment.
   - Then I’ll rebuild and verify again.

Expected result:

- Publish should no longer fail with:
  `Cannot find module '/dev-server/node_modules/vite/dist/node/chunks/dep-827b23df.js'`
- Preview should stop reporting the Vite startup failure.
- Future failures, if any, should be real app build errors rather than a corrupted compiler install.

<lov-actions>
  <lov-open-history>View History</lov-open-history>
</lov-actions>

<lov-actions>
<lov-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</lov-link>
</lov-actions>