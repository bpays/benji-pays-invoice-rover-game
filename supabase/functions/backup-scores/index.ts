import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const BUCKET = "scores-backups";
const RETENTION_DAYS = 30;
const PAGE_SIZE = 1000;

const COLUMNS = [
  "id",
  "player_name",
  "email",
  "score",
  "city_reached",
  "city_flag",
  "best_combo",
  "event_tag",
  "run_id",
  "duration_s",
  "flagged",
  "created_at",
] as const;

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function etTimestamp(d: Date): string {
  // YYYY-MM-DD-HHmm in America/New_York
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}-${parts.hour}${parts.minute}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  let force = false;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      force = body?.force === true;
    } catch (_) { /* no body */ }
  }

  // Check toggle unless forced
  if (!force) {
    const { data: setting } = await admin
      .from("settings")
      .select("value")
      .eq("key", "backups_enabled")
      .maybeSingle();
    if (!setting || setting.value !== "true") {
      return new Response(JSON.stringify({ skipped: true, reason: "backups disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    // Stream all scores in pages
    const lines: string[] = [COLUMNS.join(",")];
    let from = 0;
    let total = 0;
    while (true) {
      const { data, error } = await admin
        .from("scores")
        .select(COLUMNS.join(","))
        .order("created_at", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const row of data as unknown as Record<string, unknown>[]) {
        lines.push(COLUMNS.map((c) => csvEscape(row[c])).join(","));
      }
      total += data.length;
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const now = new Date();
    const filename = `scores-backup-${etTimestamp(now)}.csv`;
    const csv = lines.join("\n");

    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(filename, new Blob([csv], { type: "text/csv" }), {
        contentType: "text/csv",
        upsert: true,
      });
    if (upErr) throw upErr;

    // Update last-run setting
    const lastRunValue = JSON.stringify({
      at: now.toISOString(),
      filename,
      row_count: total,
    });
    await admin
      .from("settings")
      .update({ value: lastRunValue, updated_at: now.toISOString() })
      .eq("key", "backups_last_run");

    // Prune old files
    const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const { data: files } = await admin.storage.from(BUCKET).list("", { limit: 1000 });
    if (files && files.length > 0) {
      const stale = files
        .filter((f) => {
          const t = f.created_at ? Date.parse(f.created_at) : NaN;
          return Number.isFinite(t) && t < cutoffMs;
        })
        .map((f) => f.name);
      if (stale.length > 0) {
        await admin.storage.from(BUCKET).remove(stale);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, filename, row_count: total, forced: force }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
