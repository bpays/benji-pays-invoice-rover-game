# Security Hardening Plan

Two independent fixes: lock down `postMessage` navigation, and stop loading the profanity checker from a CDN at runtime.

---

## 1. Harden postMessage navigation

**Files:** `src/components/NavigationMessageBridge.tsx`, `src/components/EmbedFrame.tsx`

Both components currently accept any `postMessage({ type: 'navigate', path })` from any origin and pass `path` straight to `react-router`'s `navigate()`. A malicious embedder/iframe could push the SPA to attacker-controlled paths or trigger `javascript:`-style values if anything downstream interprets them.

Add a shared validator and apply it in both handlers:

- **Origin check:** Accept the message only if `e.origin === window.location.origin`. Optionally allow extra origins via a comma-separated `VITE_ALLOWED_MESSAGE_ORIGINS` env var (trimmed, exact match). Messages from any other origin are silently ignored.
- **Path validation** for `e.data.path`:
  - Must be a non-empty `string`
  - Must start with exactly one `/` (reject `//evil.com`, protocol-relative URLs)
  - Must not contain `:` (blocks `javascript:`, `http:`, `data:`, etc.)
  - Cap length (e.g. 512 chars) and reject control characters
- For `EmbedFrame`, additionally require `e.source === iframeRef.current?.contentWindow` so only the embedded iframe we rendered can drive navigation. Add a `useRef` on the `<iframe>` for this.
- Add a brief comment above each handler explaining the origin + path checks exist to prevent open-redirect / XSS-style abuse via `postMessage`.

Extract the validator into a small helper (e.g. `src/lib/safeNavigateMessage.ts`) so both components share one implementation and tests are trivial to add later.

No `.env` change is required; if `VITE_ALLOWED_MESSAGE_ORIGINS` is unset the check defaults to same-origin only.

## 2. Remove CDN-loaded profanity checker

**Files:** `src/features/game/shellRuntime.ts`, `package.json`

Currently `ensureProfanityChecker()` does `await import('https://esm.sh/obscenity@0.4.6')` — a runtime fetch from a third-party CDN. That's a supply-chain and CSP risk and can break offline/strict-CSP deployments.

Approach:

- Add `obscenity` as a normal dependency in `package.json` (`bun add obscenity`, pinned to `^0.4.6` to match the version already in use).
- At the top of `shellRuntime.ts`, import statically:
  ```ts
  import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity';
  ```
- Replace `ensureProfanityChecker()` with a synchronous module-level singleton:
  ```ts
  const bpProfanityMatcher = new RegExpMatcher({
    ...englishDataset.build(),
    ...englishRecommendedTransformers,
  });
  function bpProfanityCheck(s: string) { return bpProfanityMatcher.hasMatch(s); }
  ```
- Update `validatePlayerForm()` to drop the `await ensureProfanityChecker()` call and use `bpProfanityCheck(name)` directly. Server-side validation in `supabase/functions/submit-score/index.ts` (leo-profanity) remains the source of truth — the client check is purely UX.
- Remove the now-unused `window.__bpProfanityCheck` assignment and its global type augmentation if present.
- Run a production build and `rg -n "esm.sh" dist/` to confirm no CDN URLs remain in the bundle.

## Notes

- No database/edge-function changes; server-side name validation is unchanged.
- No user-visible behavior change: navigation still works for our own embeds, and the same profanity dataset is used — just bundled instead of fetched.
- Bundle size grows modestly (obscenity is small, ~tens of KB gzipped) in exchange for removing a runtime CDN dependency.
