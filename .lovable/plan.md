

## Plan: Replace hardcoded profanity filter with `bad-words` npm package

### Current state
The `submit-score` edge function has a manually curated ~70-word `PROFANITY_WORDS` set with basic whole-word matching. This misses compound words, leet-speak, and non-English profanity.

### Approach
Replace the custom filter with the [`bad-words`](https://www.npmjs.com/package/bad-words) package (or its maintained fork `leo-profanity`). Since edge functions run on Deno, we import via `npm:` specifier — no build step needed.

**Recommended package: `leo-profanity`** — actively maintained, supports multiple languages, works well via `npm:leo-profanity`.

### Changes

**File: `supabase/functions/submit-score/index.ts`**

1. Add import at the top:
   ```typescript
   import filter from "npm:leo-profanity@1";
   ```
2. Remove the entire `PROFANITY_WORDS` set and the `hasProfanity()` function.
3. Replace the profanity check inside `validateDisplayName` with:
   ```typescript
   if (filter.check(name)) {
     return { ok: false, code: "invalid_name", error: "That name isn't allowed." };
   }
   ```
4. Optionally add extra words from `EXTRA_BLOCKED_NAME_TOKENS` env var to the filter:
   ```typescript
   const extraWords = parseCommaList("EXTRA_BLOCKED_NAME_TOKENS");
   if (extraWords.length) filter.add(extraWords);
   ```

5. Redeploy the edge function.

### Benefits
- Much larger built-in word list (~800+ words)
- Handles partial/substring matches
- Multi-language support available
- Maintained by community — no manual curation needed

