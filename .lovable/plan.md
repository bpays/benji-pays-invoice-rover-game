

## Fix submit-score Build Error

### Root Cause
The edge function imports `npm:obscenity@0.4.6`, but Lovable's Deno edge runtime requires a `deno.json` to resolve npm specifiers (other than `@supabase/supabase-js` which is pre-configured). There's no `deno.json` in the project.

### Solution
Replace the `obscenity` npm import with an **inline profanity check** using a curated word list and regex matching. The existing validation logic in the file (blocked email domains, reserved names, etc.) is already solid — we just need to swap out the one broken import.

### Changes

**1. `supabase/functions/submit-score/index.ts`**
- Remove lines 2-6 (the `obscenity` import)
- Remove the `profanityMatcher` constant that uses `RegExpMatcher`
- Add an inline `PROFANITY_WORDS` set (~80 common offensive terms)
- Add a `hasProfanity(text)` function that normalizes input (lowercase, strip non-alpha) and checks each word token against the set using word-boundary matching
- Replace the `profanityMatcher.hasMatch(name)` call in `validateDisplayName()` with `hasProfanity(name)`

No other files change. All existing validation (blocked email domains, reserved names, score bounds, etc.) stays as-is.

### After Deploy
- The function auto-deploys when saved
- Will test with `curl_edge_functions` to confirm:
  - Gmail email → rejected
  - Profane name → rejected
  - Valid submission → accepted

