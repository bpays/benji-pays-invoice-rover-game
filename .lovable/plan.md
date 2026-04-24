## Fix submit-score edge function build error

**Problem:** `npm:leo-profanity@1` isn't resolvable by edge-runtime, so the `submit-score` function fails to deploy.

**Fix:** Switch to the esm.sh specifier which resolves reliably in Deno edge-runtime, and pin a concrete version.

### Change

In `supabase/functions/submit-score/index.ts`, replace:

```ts
import filter from "npm:leo-profanity@1";
```

with:

```ts
import filter from "https://esm.sh/leo-profanity@1.7.0";
```

No other code changes needed — the `filter.add()`, `filter.check()`, and `filter.list()` API surface is identical.

### Validation

1. Deploy `submit-score`.
2. Check function logs for successful boot (no module resolution errors).
3. Curl the function with a test payload (valid name + work email + score) and confirm a 200 response.
4. Curl with a profane name and confirm a 400 `invalid_name`.
