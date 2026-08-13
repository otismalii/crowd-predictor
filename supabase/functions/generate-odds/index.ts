// generate-odds — prices upcoming fixtures. Runs on a schedule via jobs-dispatch and
// can be invoked manually from the admin Odds Manager.
// Admin overrides are never touched; suspended selections stay suspended.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const started = Date.now();

  const matchIds: string[] = [];

  if (typeof body.match_id === "string") {
    matchIds.push(body.match_id);
  } else {
    const horizonHours = Number(body.horizon_hours ?? 168);
    const until = new Date(Date.now() + horizonHours * 3600_000).toISOString();
    const { data, error } = await db
      .from("platform_matches")
      .select("id")
      .eq("status", "upcoming")
      .gt("kickoff_at", new Date().toISOString())
      .lt("kickoff_at", until)
      .order("kickoff_at", { ascending: true })
      .limit(Number(body.limit ?? 300));
    if (error) return json({ error: error.message }, 500);
    for (const m of data ?? []) matchIds.push(m.id);
  }

  let priced = 0;
  const failures: string[] = [];
  for (const id of matchIds) {
    const { error } = await db.rpc("fn_generate_match_odds", { p_match_id: id });
    if (error) failures.push(`${id}: ${error.message}`);
    else priced += 1;
  }

  // Suspend every market on matches that have kicked off.
  const { error: suspendError } = await db
    .from("match_odds")
    .update({ is_suspended: true })
    .eq("is_suspended", false)
    .in(
      "match_id",
      (await db.from("platform_matches").select("id").in("status", ["live", "finished", "postponed", "cancelled"]).limit(500))
        .data?.map((m: { id: string }) => m.id) ?? ["00000000-0000-0000-0000-000000000000"],
    );
  if (suspendError) failures.push(`suspend: ${suspendError.message}`);

  const result = { priced, requested: matchIds.length, failures: failures.slice(0, 10), duration_ms: Date.now() - started };
  console.log("[generate-odds]", JSON.stringify(result));
  return json({ ok: failures.length === 0, ...result });
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
