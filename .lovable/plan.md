# Add `/kaseya26` landing page (Kaseya Connect 2026)

Port the "Empower landing page" project's landing page into this project at the route `/kaseya26`. Once shipped, it will be live at `benjigame.com/kaseya26` (and the other custom domains).

## Key constraint

The source project uses **Tailwind + shadcn/ui + a full HSL design-token system**. This project (Invoice Rover) is intentionally lightweight: **no Tailwind, no shadcn**, just React + vanilla CSS for the game shell. Adding Tailwind here would:

- bloat the bundle that loads on every game session,
- introduce a global preflight reset that could conflict with the existing game/admin/leaderboard CSS,
- pull in dozens of unused Radix dependencies.

So we will **port the visuals, not the toolchain** — convert each section's Tailwind classes into a single scoped CSS module that only applies under `.kaseya26-page`.

## What ships

A new route `/kaseya26` showing the same landing page sections in order:

```text
Navbar
Hero (title, prize pill, CTAs, scroll cue)
BenjiBlurb
HowToPlay
CitiesGrid
PartnerPowerUps  (already in source — included for completeness)
FinalCTA
Footer
```

Internal CTAs (`benjigame.com`, `benjigame.com/leaderboard`) will be rewritten to in-app routes (`/`, `/leaderboard`) so they navigate without a full reload. External links (Calendly, benjipays.com) stay as-is.

## Files to add

- `src/pages/Kaseya26Page.tsx` — page wrapper, mounts the section components inside `<div className="kaseya26-page">`.
- `src/features/kaseya26/components/` — one file per section (`Navbar`, `Hero`, `BenjiBlurb`, `HowToPlay`, `CitiesGrid`, `PartnerPowerUps`, `FinalCTA`, `Footer`).
- `src/features/kaseya26/useScrollReveal.ts` — port of the source hook.
- `src/styles/kaseya26.css` — scoped styles (all selectors prefixed with `.kaseya26-page`), including the page's color tokens, typography (Barlow / Barlow Condensed via Google Fonts), gradients, animations, grain overlay, and per-section layout.
- `src/assets/kaseya26/` — copy of the 5 brand images (`benji-logo.png`, `elavon.png`, `halopsa.png`, `moneris.png`, `scalepad.png`) from the source project.

## Files to edit

- `src/App.tsx` — add `<Route path="/kaseya26" element={<Kaseya26Page />} />` alongside the existing routes.

## Styling approach (details)

- Single CSS file imported by `Kaseya26Page.tsx`. All rules live under `.kaseya26-page { … }` so nothing leaks into `/`, `/game`, `/leaderboard`, `/admin`.
- The source's HSL design tokens (`--navy`, `--orange`, `--mid`, `--deep`, etc.) are redeclared on `.kaseya26-page` instead of `:root` for the same isolation reason.
- Tailwind utility shortcuts get translated to plain CSS: `flex`, `grid`, `clamp()`, `linear-gradient`, `backdrop-filter: blur()`, the radial-gradient hero background, the `fadeUp` / `fadeIn` / `drop` keyframes, and the SVG-noise grain overlay.
- Fonts loaded once via the existing Google Fonts `@import` in the new CSS file.
- Scroll-reveal hook uses `IntersectionObserver` (same as source) and toggles a class that the CSS animates.

## Out of scope

- No SEO/meta tag work beyond the existing `index.html` defaults — can be a follow-up if you want a custom `<title>` / OG image for the Kaseya page.
- No analytics events specific to this landing page.
- No changes to the game, admin, or existing leaderboard.

## Risk / verification

- Bundle size impact: small — pure React components + ~one CSS file + 5 images.
- Visual parity: the port aims to match pixel-for-pixel; minor differences may exist around shadcn primitives (none of the visible sections use them, just `lucide-react` icons in some — will swap for inline SVGs to avoid adding the dep).
- After shipping, sanity-check `/kaseya26`, `/`, `/game`, `/leaderboard`, and `/admin` to confirm nothing else regressed.
