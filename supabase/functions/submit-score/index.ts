import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_CITIES = [
  "Vancouver", "Toronto", "Montreal", "Dallas", "New York",
  "Los Angeles", "Miami", "London", "Australia", "Cyber City",
];

const VALID_FLAGS = ["🇨🇦", "🤠", "🗽", "🌴", "🌊", "🇬🇧", "🇦🇺", "🤖"];

const MAX_SCORE = 100000;
const MAX_COMBO = 500;
const MAX_NAME_LENGTH = 30;
const MAX_EMAIL_LENGTH = 255;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { player_name, email, score, city_reached, city_flag, best_combo, event_tag } = body as {
    player_name?: string;
    email?: string;
    score?: number;
    city_reached?: string;
    city_flag?: string;
    best_combo?: number;
    event_tag?: string;
  };

  // Validate player_name
  if (!player_name || typeof player_name !== "string" || player_name.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: "player_name is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const cleanName = player_name.trim().slice(0, MAX_NAME_LENGTH);

  // Validate email (optional)
  let cleanEmail: string | null = null;
  if (email && typeof email === "string" && email.trim().length > 0) {
    const emailStr = email.trim().slice(0, MAX_EMAIL_LENGTH);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailStr)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    cleanEmail = emailStr;
  }

  // Validate score
  const numScore = typeof score === "number" ? Math.floor(score) : 0;
  if (numScore < 0 || numScore > MAX_SCORE) {
    return new Response(
      JSON.stringify({ error: "Score out of valid range" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate best_combo
  const numCombo = typeof best_combo === "number" ? Math.floor(best_combo) : 0;
  if (numCombo < 0 || numCombo > MAX_COMBO) {
    return new Response(
      JSON.stringify({ error: "Combo out of valid range" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate city
  const cleanCity = (typeof city_reached === "string" && VALID_CITIES.includes(city_reached))
    ? city_reached : "Vancouver";

  const cleanFlag = (typeof city_flag === "string" && VALID_FLAGS.includes(city_flag))
    ? city_flag : "🇨🇦";

  // Validate event_tag
  const cleanEventTag = (typeof event_tag === "string" && event_tag.length <= 50)
    ? event_tag.trim() : null;

  // Insert using service role
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { error: insertError } = await adminClient.from("scores").insert({
    player_name: cleanName,
    email: cleanEmail,
    score: numScore,
    city_reached: cleanCity,
    city_flag: cleanFlag,
    best_combo: numCombo,
    event_tag: cleanEventTag,
    flagged: false,
  });

  if (insertError) {
    console.error("Insert error:", insertError);
    return new Response(
      JSON.stringify({ error: "Failed to submit score" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
