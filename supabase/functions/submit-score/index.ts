import { createClient } from "npm:@supabase/supabase-js@2";
import filter from "https://esm.sh/leo-profanity@1.7.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Lowercase hostnames — consumer / free mail (tradeshow work-email gate). */
const BLOCKED_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.ca",
  "yahoo.fr",
  "yahoo.de",
  "hotmail.com",
  "hotmail.co.uk",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "pm.me",
  "gmx.com",
  "gmx.de",
  "gmx.net",
  "mail.com",
  "yandex.com",
  "yandex.ru",
  "qq.com",
  "163.com",
  "126.com",
  "sina.com",
  "inbox.com",
  "hey.com",
  "fastmail.com",
  "tutanota.com",
  "tutanota.de",
  "mailfence.com",
]);

/** Whole-token reserved / impersonation (lowercase). */
const RESERVED_NAME_TOKENS = new Set([
  "anonymous",
  "admin",
  "administrator",
  "moderator",
  "mod",
  "root",
  "null",
  "undefined",
  "benjipays",
  "support",
  "official",
]);

const VALID_CITIES = [
  "Vancouver",
  "Toronto",
  "Montreal",
  "Dallas",
  "New York",
  "Los Angeles",
  "Miami",
  "London",
  "Australia",
  "Cyber City",
];

const VALID_FLAGS = ["🇨🇦", "🤠", "🗽", "🌴", "🌊", "🇬🇧", "🇦🇺", "🤖"];

const MAX_SCORE = 100000;
const MAX_COMBO = 500;
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 30;
const MAX_EMAIL_LENGTH = 255;

const NAME_ALLOWED_RE =
  /^[\p{L}\p{M}0-9\s.'-]+$/u;

function jsonErr(
  status: number,
  code: string,
  error: string,
): Response {
  return new Response(JSON.stringify({ code, error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim().slice(0, 128);
  return "unknown";
}

function parseCommaList(key: string): string[] {
  const raw = Deno.env.get(key);
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function extractEmailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase().trim();
}

function validateWorkEmail(emailRaw: string): { ok: true; email: string } | {
  ok: false;
  code: string;
  error: string;
} {
  const email = emailRaw.trim().slice(0, MAX_EMAIL_LENGTH);
  if (!email) {
    return {
      ok: false,
      code: "email_required",
      error: "Please enter your work email.",
    };
  }
  const basic =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!basic) {
    return {
      ok: false,
      code: "invalid_email",
      error: "That email doesn’t look valid.",
    };
  }

  const domain = extractEmailDomain(email);
  if (!domain) {
    return {
      ok: false,
      code: "invalid_email",
      error: "That email doesn’t look valid.",
    };
  }

  const allowedOnly = parseCommaList("ALLOWED_EMAIL_DOMAINS");
  if (allowedOnly.length > 0) {
    if (!allowedOnly.includes(domain)) {
      return {
        ok: false,
        code: "invalid_email_domain",
        error: "This event requires an email from an approved company domain.",
      };
    }
    return { ok: true, email };
  }

  const blocked = new Set([
    ...BLOCKED_EMAIL_DOMAINS,
    ...parseCommaList("EXTRA_BLOCKED_EMAIL_DOMAINS"),
  ]);
  if (blocked.has(domain)) {
    return {
      ok: false,
      code: "invalid_email_domain",
      error:
        "Please use your work email, not a personal address (Gmail, Yahoo, etc.).",
    };
  }

  return { ok: true, email };
}

function nameTokensForReservedCheck(normalized: string): string[] {
  return normalized
    .toLowerCase()
    .split(/[^\p{L}\p{M}0-9]+/u)
    .filter((t) => t.length > 0);
}

function validateDisplayName(raw: string): { ok: true; name: string } | {
  ok: false;
  code: string;
  error: string;
} {
  if (!raw || typeof raw !== "string") {
    return {
      ok: false,
      code: "name_required",
      error: "Please enter your name.",
    };
  }
  let name = raw.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (name.length < MIN_NAME_LENGTH) {
    return {
      ok: false,
      code: "invalid_name",
      error: "Name is too short.",
    };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return {
      ok: false,
      code: "invalid_name",
      error: "Name is too long.",
    };
  }
  if (!NAME_ALLOWED_RE.test(name)) {
    return {
      ok: false,
      code: "invalid_name",
      error: "Name can only use letters, numbers, spaces, and . ' -",
    };
  }
  const lower = name.toLowerCase();
  if (
    lower.includes("http") ||
    lower.includes("www.") ||
    lower.includes("://") ||
    lower.includes("<") ||
    lower.includes(">") ||
    lower.includes("@") ||
    /[\r\n]/.test(name)
  ) {
    return {
      ok: false,
      code: "invalid_name",
      error: "That name isn’t allowed.",
    };
  }
  if (/(.)\1{7,}/u.test(name)) {
    return {
      ok: false,
      code: "invalid_name",
      error: "That name isn’t allowed.",
    };
  }
  const lettersDigits = name.replace(/[^\p{L}\p{M}0-9]/gu, "");
  if (lettersDigits.length > 0 && /^\d+$/u.test(lettersDigits)) {
    return {
      ok: false,
      code: "invalid_name",
      error: "Please use your real name.",
    };
  }

  const extraReserved = new Set(parseCommaList("EXTRA_BLOCKED_NAME_TOKENS"));
  const tokens = nameTokensForReservedCheck(name);
  for (const t of tokens) {
    if (RESERVED_NAME_TOKENS.has(t) || extraReserved.has(t)) {
      return {
        ok: false,
        code: "invalid_name",
        error: "That name isn’t allowed.",
      };
    }
  }

  // leo-profanity filter with extra blocked words from env
  const extraBlocked = parseCommaList("EXTRA_BLOCKED_NAME_TOKENS");
  if (extraBlocked.length) filter.add(extraBlocked);

  if (filter.check(name)) {
    return {
      ok: false,
      code: "invalid_name",
      error: "That name isn't allowed.",
    };
  }

  // Substring scan: catch profanity embedded inside compound words
  const nameLower = name.toLowerCase().replace(/[^a-z]/g, "");
  const allWords: string[] = filter.list();
  for (const word of allWords) {
    if (word.length >= 3 && nameLower.includes(word)) {
      return {
        ok: false,
        code: "invalid_name",
        error: "That name isn't allowed.",
      };
    }
  }

  return { ok: true, name };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const {
    player_name,
    email,
    score,
    city_reached,
    city_flag,
    best_combo,
    event_tag,
    run_id,
  } = body as {
    player_name?: string;
    email?: string;
    score?: number;
    city_reached?: string;
    city_flag?: string;
    best_combo?: number;
    event_tag?: string;
    run_id?: string;
  };

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const cleanRunId = typeof run_id === "string" && UUID_RE.test(run_id) ? run_id : null;

  const nameResult = validateDisplayName(
    typeof player_name === "string" ? player_name : "",
  );
  if (!nameResult.ok) {
    return jsonErr(400, nameResult.code, nameResult.error);
  }
  const cleanName = nameResult.name;

  const emailResult = validateWorkEmail(
    typeof email === "string" ? email : "",
  );
  if (!emailResult.ok) {
    return jsonErr(400, emailResult.code, emailResult.error);
  }
  const cleanEmail = emailResult.email;

  const numScore = typeof score === "number" ? Math.floor(score) : 0;
  if (numScore < 0 || numScore > MAX_SCORE) {
    return jsonErr(400, "invalid_score", "Score out of valid range.");
  }

  const numCombo = typeof best_combo === "number" ? Math.floor(best_combo) : 0;
  if (numCombo < 0 || numCombo > MAX_COMBO) {
    return jsonErr(400, "invalid_combo", "Combo out of valid range.");
  }

  const cleanCity =
    typeof city_reached === "string" && VALID_CITIES.includes(city_reached)
      ? city_reached
      : "Vancouver";

  const cleanFlag =
    typeof city_flag === "string" && VALID_FLAGS.includes(city_flag)
      ? city_flag
      : "🇨🇦";

  const cleanEventTag =
    typeof event_tag === "string" && event_tag.length <= 50
      ? event_tag.trim()
      : null;

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: rateOk, error: rateErr } = await adminClient.rpc(
    "check_submit_score_rate_limit",
    {
      p_ip_key: getClientIp(req),
      p_email_key: cleanEmail,
      p_max_ip: 25,
      p_max_email: 10,
      p_window_secs: 60,
    },
  );
  if (rateErr) {
    console.error("Rate limit check failed:", rateErr);
  } else if (rateOk === false) {
    return jsonErr(
      429,
      "rate_limited",
      "Too many submissions. Try again in a minute.",
    );
  }

  // If a run_id was provided and matches a known run, stamp ended_at and compute duration_s.
  // Never block the submission on this — it's analytics, not a gate.
  let durationS: number | null = null;
  if (cleanRunId) {
    try {
      const { data: runRow, error: runFetchErr } = await adminClient
        .from("game_runs")
        .select("started_at")
        .eq("id", cleanRunId)
        .maybeSingle();
      if (runFetchErr) {
        console.warn("game_runs lookup failed:", runFetchErr);
      } else if (runRow?.started_at) {
        const startedMs = new Date(runRow.started_at as string).getTime();
        const nowMs = Date.now();
        const secs = Math.floor((nowMs - startedMs) / 1000);
        // Reject obviously bogus values (negative or > 2 hours)
        if (secs >= 0 && secs <= 7200) {
          durationS = secs;
        }
        const { error: updErr } = await adminClient
          .from("game_runs")
          .update({ ended_at: new Date(nowMs).toISOString() })
          .eq("id", cleanRunId);
        if (updErr) console.warn("game_runs update failed:", updErr);
      } else {
        console.warn("Unknown run_id received:", cleanRunId);
      }
    } catch (e) {
      console.warn("Run-timing pipeline error:", e);
    }
  }

  const { error: insertError } = await adminClient.from("scores").insert({
    player_name: cleanName,
    email: cleanEmail,
    score: numScore,
    city_reached: cleanCity,
    city_flag: cleanFlag,
    best_combo: numCombo,
    event_tag: cleanEventTag,
    flagged: false,
    run_id: cleanRunId,
    duration_s: durationS,
  });

  if (insertError) {
    console.error("Insert error:", insertError);
    return new Response(
      JSON.stringify({ code: "server_error", error: "Failed to submit score." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
