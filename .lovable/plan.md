

## Cleanup Plan

### 1. Create `.gitignore`
Add a `.gitignore` file with standard entries:
- `node_modules/`, `.env`, `dist/`, `.DS_Store`, `tsconfig.tsbuildinfo`, etc.
- This ensures `.env` and other sensitive/generated files won't be pushed to GitHub.

### 2. Delete unnecessary files
| File/Folder | Reason |
|---|---|
| `netlify.toml` | Netlify-specific, not used |
| `admin/` | Duplicate of `public/admin/` |
| `game/` | Duplicate of `public/game/` |
| `leaderboard/` | Duplicate of `public/leaderboard/` |
| `strategy/` | Duplicate of `public/strategy/` |
| `docs/` | Setup SQL notes, already applied |
| `package-lock.json` | Redundant with `bun.lock` |
| `tsconfig.tsbuildinfo` | Generated build cache |

### What stays
- `public/` (all static assets served by Vite)
- `src/`, `supabase/`, `.lovable/`
- `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json`, `bun.lock`
- `README.md`, `.env` (kept locally but excluded from git)

No functionality changes — the live site serves from `public/`.

