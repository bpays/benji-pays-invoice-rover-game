You’re right: repeating reinstalls is not solving the persistent builder failure. The latest logs show the real failure path is the compiler/bundler layer: Vite is invoking Rollup, and Rollup is trying to load its native Linux package `@rollup/rollup-linux-x64-gnu`. That optional native package is intermittently missing in the build environment, which then surfaces as the misleading `incorrect main/module/exports` error.

Plan for a different fix:

1. Stop relying on Rollup’s native compiler package
   - Replace the current direct `@rollup/rollup-linux-x64-gnu` workaround.
   - Add `@rollup/wasm-node` instead.
   - Add a package override so Vite’s internal `rollup` dependency resolves to the WASM Rollup implementation.
   - This directly answers your question: yes, this can be the compiler/bundler, and this fix changes that path instead of reinstalling the same native compiler again.

2. Keep the React Router fix, but do not make it the main fix
   - Keep `react-router-dom` pinned to `6.30.1` because React Router 7.14 was producing unstable development chunk resolution in this app.
   - Do not keep chasing React Router if the logs continue to point at Rollup native loading.

3. Keep dependency installation deterministic
   - Keep only `bun.lock`.
   - Keep `packageManager` pinned.
   - Remove any package-lock based or native-platform workaround that can conflict with the builder.

4. Validate like the production builder
   - Delete `node_modules` and `dist`.
   - Run a frozen install from the lockfile.
   - Run `build:dev` and production `build`.
   - Confirm the dev-server log no longer contains `Cannot find module @rollup/rollup-linux-x64-gnu`.

Fallback if the WASM override is not accepted by the package manager:

5. Use an older Vite/Rollup compiler line that does not use Rollup’s native optional package loader
   - Pin Vite to a compatible version whose Rollup dependency avoids this native-package path.
   - Rebuild from a clean install again.

Why this is different:
Previous attempts tried to repair the same native Rollup path by reinstalling or pinning `@rollup/rollup-linux-x64-gnu`. This plan removes that native dependency path entirely and makes Vite build through a deterministic WASM Rollup implementation.

<lov-actions><lov-open-history>View History</lov-open-history></lov-actions>

<lov-actions><lov-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</lov-link></lov-actions>