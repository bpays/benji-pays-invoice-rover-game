import { createClient } from "npm:@supabase/supabase-js@2";
import filter from "https://esm.sh/leo-profanity@1.7.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BLOCKED_EMAIL_DOMAINS = new Set([
  "gmail.com","googlemail.com","yahoo.com","yahoo.co.uk","yahoo.ca","yahoo.fr","yahoo.de",
  "hotmail.com","hotmail.co.uk","outlook.com","live.com","msn.com","icloud.com","me.com","mac.com",
  "aol.com","protonmail.com","proton.me","pm.me","gmx.com","gmx.de","gmx.net","mail.com",
  "yandex.com","yandex.ru","qq.com","163.com","126.com","sina.com","inbox.com","hey.com",
  "fastmail.com","tutanota.com","tutanota.de","mailfence.com",
]);

const RESERVED_NAME_TOKENS = new Set([
  "anonymous","admin","administrator","moderator","mod","root","null","undefined",
  "benjipays","support","official",
]);

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 30;
const MAX_EMAIL_LENGTH = 255;
const NAME_ALLOWED_RE = /^[\p{L}\p{M}0-9\s.'-]+$/u;

function jsonErr(status: number, code: string, error: string): Response {
  return new Response(JSON.stringify({ code, error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseCommaList(key: string): string[] {
  const raw = Deno.env.get(key);
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function extractEmailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase().trim();
}

function validateWorkEmail(emailRaw: string):
  | { ok: true; email: string }
  | { ok: false; code: string; error: string } {
  const email = emailRaw.trim().slice(0, MAX_EMAIL_LENGTH);
  if (!email) return { ok: false, code: "email_required", error: "Please enter your work email." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, code: "invalid_email", error: "That email doesn’t look valid." };
  }
  const domain = extractEmailDomain(email);
  if (!domain) return { ok: false, code: "invalid_email", error: "That email doesn’t look valid." };

  const allowedOnly = parseCommaList("ALLOWED_EMAIL_DOMAINS");
  if (allowedOnly.length > 0) {
    if (!allowedOnly.includes(domain)) {
      return { ok: false, code: "invalid_email_domain", error: "This event requires an email from an approved company domain." };
    }
    return { ok: true, email };
  }

  const blocked = new Set([
    ...BLOCKED_EMAIL_DOMAINS,
    ...parseCommaList("EXTRA_BLOCKED_EMAIL_DOMAINS"),
  ]);
  if (blocked.has(domain)) {
    return { ok: false, code: "invalid_email_domain", error: "Please use your work email, not a personal address (Gmail, Yahoo, etc.)." };
  }
  return { ok: true, email };
}

function validateDisplayName(raw: string):
  | { ok: true; name: string }
  | { ok: false; code: string; error: string } {
  if (!raw || typeof raw !== "string") return { ok: false, code: "name_required", error: "Please enter your name." };
  let name = raw.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (name.length < MIN_NAME_LENGTH) return { ok: false, code: "invalid_name", error: "Name is too short." };
  if (name.length > MAX_NAME_LENGTH) return { ok: false, code: "invalid_name", error: "Name is too long." };
  if (!NAME_ALLOWED_RE.test(name)) return { ok: false, code: "invalid_name", error: "Name can only use letters, numbers, spaces, and . ' -" };
  const lower = name.toLowerCase();
  if (lower.includes("http") || lower.includes("www.") || lower.includes("://") ||
      lower.includes("<") || lower.includes(">") || lower.includes("@") || /[\r\n]/.test(name)) {
    return { ok: false, code: "invalid_name", error: "That name isn’t allowed." };
  }
  if (/(.)\1{7,}/u.test(name)) return { ok: false, code: "invalid_name", error: "That name isn’t allowed." };
  const lettersDigits = name.replace(/[^\p{L}\p{M}0-9]/gu, "");
  if (lettersDigits.length > 0 && /^\d+$/u.test(lettersDigits)) {
    return { ok: false, code: "invalid_name", error: "Please use your real name." };
  }
  const extraReserved = new Set(parseCommaList("EXTRA_BLOCKED_NAME_TOKENS"));
  const tokens = name.toLowerCase().split(/[^\p{L}\p{M}0-9]+/u).filter((t) => t.length > 0);
  for (const t of tokens) {
    if (RESERVED_NAME_TOKENS.has(t) || extraReserved.has(t)) {
      return { ok: false, code: "invalid_name", error: "That name isn’t allowed." };
    }
  }
  const extraBlocked = parseCommaList("EXTRA_BLOCKED_NAME_TOKENS");
  if (extraBlocked.length) filter.add(extraBlocked);
  if (filter.check(name)) return { ok: false, code: "invalid_name", error: "That name isn't allowed." };
  const nameLower = name.toLowerCase().replace(/[^a-z]/g, "");
  const allWords: string[] = filter.list();
  for (const word of allWords) {
    if (word.length >= 3 && nameLower.includes(word)) {
      return { ok: false, code: "invalid_name", error: "That name isn't allowed." };
    }
  }
  return { ok: true, name };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
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
    return jsonErr(400, "invalid_json", "Invalid JSON");
  }

  const { player_name, email, event_tag } = body as {
    player_name?: string;
    email?: string;
    event_tag?: string;
  };

  const nameResult = validateDisplayName(typeof player_name === "string" ? player_name : "");
  if (!nameResult.ok) return jsonErr(400, nameResult.code, nameResult.error);

  const emailResult = validateWorkEmail(typeof email === "string" ? email : "");
  if (!emailResult.ok) return jsonErr(400, emailResult.code, emailResult.error);

  const cleanEventTag =
    typeof event_tag === "string" && event_tag.length <= 50 ? event_tag.trim() : null;

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: runRow, error: runErr } = await adminClient
    .from("game_runs")
    .insert({
      player_name: nameResult.name,
      email: emailResult.email,
      event_tag: cleanEventTag,
    })
    .select("id")
    .single();

  if (runErr || !runRow) {
    console.error("Failed to create game_run:", runErr);
    return jsonErr(500, "server_error", "Could not start run.");
  }

  const runId = runRow.id as string;

  // Lead-capture row in scores (score 0), tagged with run_id
  const { error: leadErr } = await adminClient.from("scores").insert({
    player_name: nameResult.name,
    email: emailResult.email,
    score: 0,
    city_reached: "Vancouver",
    city_flag: "🇨🇦",
    best_combo: 0,
    event_tag: cleanEventTag,
    flagged: false,
    run_id: runId,
  });

  if (leadErr) {
    console.error("Lead-capture insert failed:", leadErr);
    // Don't fail the whole start — the run row exists and is what matters for timing.
  }

  return new Response(JSON.stringify({ success: true, run_id: runId }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
