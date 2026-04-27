import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const ALLOWED_DOMAIN = "benjipays.com";

const VALID_CITIES = new Set([
  "Vancouver","Toronto","Montreal","Dallas","New York",
  "Los Angeles","Miami","London","Australia","Cyber City",
]);
const VALID_FLAGS = new Set(["🇨🇦","🤠","🗽","🌴","🌊","🇬🇧","🇦🇺","🤖"]);

const MAX_SCORE = 100000;
const MAX_COMBO = 500;
const MAX_BATCH = 1000;

function getJwtAal(authHeader: string): string | null {
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "=");
    const claims = JSON.parse(atob(padded));
    return typeof claims?.aal === "string" ? claims.aal : null;
  } catch (_err) {
    return null;
  }
}

type Row = {
  player_name: string;
  email: string;
  score: number;
  city_reached?: string;
  city_flag?: string;
  best_combo?: number;
  event_tag: string;
  created_at?: string | null;
};

function err(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return err(405, "Method not allowed");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return err(401, "Not authenticated");

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) return err(401, "Invalid session");

    const callerDomain = caller.email?.split("@")[1]?.toLowerCase();
    if (callerDomain !== ALLOWED_DOMAIN) {
      return err(403, "Access restricted to @" + ALLOWED_DOMAIN);
    }

    // Require aal2 (read directly from JWT claim for reliability)
    if (getJwtAal(authHeader) !== "aal2") return err(403, "MFA (aal2) required");

    // Require admin role
    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin");
    if (!callerRoles || callerRoles.length === 0) return err(403, "Admin access required");

    const body = await req.json();
    const rows = body?.rows;
    if (!Array.isArray(rows)) return err(400, "rows[] required");
    if (rows.length === 0) return err(400, "No rows to import");
    if (rows.length > MAX_BATCH) return err(400, `Max ${MAX_BATCH} rows per request`);

    const inserts: Row[] = [];
    const errors: { index: number; reason: string }[] = [];

    rows.forEach((raw: any, idx: number) => {
      const player_name = typeof raw?.player_name === "string" ? raw.player_name.trim() : "";
      const email = typeof raw?.email === "string" ? raw.email.trim().toLowerCase() : "";
      const scoreNum = Number(raw?.score);
      const comboNum = Number(raw?.best_combo ?? 0);
      const event_tag = typeof raw?.event_tag === "string" ? raw.event_tag.trim() : "";

      if (!player_name || player_name.length < 2 || player_name.length > 60) {
        errors.push({ index: idx, reason: "Invalid name" }); return;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
        errors.push({ index: idx, reason: "Invalid email" }); return;
      }
      if (!Number.isFinite(scoreNum) || scoreNum < 0 || scoreNum > MAX_SCORE) {
        errors.push({ index: idx, reason: "Invalid score" }); return;
      }
      if (!Number.isFinite(comboNum) || comboNum < 0 || comboNum > MAX_COMBO) {
        errors.push({ index: idx, reason: "Invalid combo" }); return;
      }
      if (!event_tag || event_tag.length > 50) {
        errors.push({ index: idx, reason: "Invalid event_tag" }); return;
      }

      const city = typeof raw?.city_reached === "string" && VALID_CITIES.has(raw.city_reached)
        ? raw.city_reached : "Vancouver";
      const flag = typeof raw?.city_flag === "string" && VALID_FLAGS.has(raw.city_flag)
        ? raw.city_flag : "🇨🇦";

      let created_at: string | null = null;
      if (typeof raw?.created_at === "string" && raw.created_at) {
        const d = new Date(raw.created_at);
        if (!Number.isNaN(d.getTime())) created_at = d.toISOString();
      }

      const ins: any = {
        player_name,
        email,
        score: Math.floor(scoreNum),
        city_reached: city,
        city_flag: flag,
        best_combo: Math.floor(comboNum),
        event_tag,
        flagged: false,
      };
      if (created_at) ins.created_at = created_at;
      inserts.push(ins);
    });

    let inserted = 0;
    if (inserts.length > 0) {
      // INSERT-only. Never updates or deletes existing rows.
      const { error: insErr, count } = await adminClient
        .from("scores")
        .insert(inserts, { count: "exact" });
      if (insErr) {
        return new Response(
          JSON.stringify({ error: insErr.message, inserted: 0, skipped: errors.length, errors }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      inserted = count ?? inserts.length;
    }

    return new Response(
      JSON.stringify({ success: true, inserted, skipped: errors.length, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("admin-import-scores error:", e);
    return err(500, "Internal server error");
  }
});
