// admin-sportsbook-actions — audited sportsbook operations for admins.
// Actions: override_odds, reset_odds, suspend, unsuspend, regenerate, settle_match, void_match, update_score.
// Every action requires a reason and writes to audit_logs.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const ACTIONS = [
  "override_odds", "reset_odds", "suspend", "unsuspend",
  "regenerate", "settle_match", "void_match", "update_score",
] as const;
type Action = typeof ACTIONS[number];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Missing auth" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Not authenticated" }, 401);

  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
  const held = new Set((roles ?? []).map((r: { role: string }) => r.role));
  if (!held.has("admin") && !held.has("super_admin")) return json({ error: "Forbidden" }, 403);

  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "Invalid JSON body" }, 400);

  const action = body.action as Action;
  if (!ACTIONS.includes(action)) return json({ error: `Unknown action. One of: ${ACTIONS.join(", ")}` }, 400);
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 4) return json({ error: "A reason of at least 4 characters is required" }, 400);

  let result: Record<string, unknown> = {};

  try {
    switch (action) {
      case "override_odds": {
        const odds = Number(body.odds);
        if (!body.odds_id || !Number.isFinite(odds) || odds < 1.01 || odds > 1000) {
          return json({ error: "odds_id and an odds value between 1.01 and 1000 are required" }, 400);
        }
        const { data, error } = await admin.from("match_odds")
          .update({ override_odds: odds, overridden_by: user.id, overridden_at: new Date().toISOString() })
          .eq("id", body.odds_id).select("id, match_id, market, selection, line, override_odds").single();
        if (error) throw error;
        result = data;
        break;
      }
      case "reset_odds": {
        const { data, error } = await admin.from("match_odds")
          .update({ override_odds: null, overridden_by: user.id, overridden_at: new Date().toISOString() })
          .eq("id", body.odds_id).select("id, match_id, market, selection").single();
        if (error) throw error;
        result = data;
        break;
      }
      case "suspend":
      case "unsuspend": {
        const suspend = action === "suspend";
        let q = admin.from("match_odds").update({ is_suspended: suspend });
        if (body.odds_id) q = q.eq("id", body.odds_id);
        else if (body.match_id && body.market) q = q.eq("match_id", body.match_id).eq("market", body.market);
        else if (body.match_id) q = q.eq("match_id", body.match_id);
        else return json({ error: "odds_id or match_id is required" }, 400);
        const { data, error } = await q.select("id");
        if (error) throw error;
        result = { affected: data?.length ?? 0 };
        break;
      }
      case "regenerate": {
        if (!body.match_id) return json({ error: "match_id is required" }, 400);
        const { error } = await admin.rpc("fn_generate_match_odds", { p_match_id: body.match_id });
        if (error) throw error;
        result = { match_id: body.match_id, regenerated: true };
        break;
      }
      case "update_score": {
        if (!body.match_id) return json({ error: "match_id is required" }, 400);
        const patch: Record<string, unknown> = { last_synced_at: new Date().toISOString() };
        if (body.home_score !== undefined) patch.home_score = Number(body.home_score);
        if (body.away_score !== undefined) patch.away_score = Number(body.away_score);
        if (body.status) patch.status = body.status;
        if (body.minute !== undefined) patch.minute = Number(body.minute);
        const { data, error } = await admin.from("platform_matches")
          .update(patch).eq("id", body.match_id).select("id, status, home_score, away_score").single();
        if (error) throw error;
        result = data;
        break;
      }
      case "void_match": {
        if (!body.match_id) return json({ error: "match_id is required" }, 400);
        const { error: upErr } = await admin.from("platform_matches")
          .update({ status: "cancelled" }).eq("id", body.match_id);
        if (upErr) throw upErr;
        const { data, error } = await admin.rpc("fn_settle_match_bets", { p_match_id: body.match_id });
        if (error) throw error;
        result = data as Record<string, unknown>;
        break;
      }
      case "settle_match": {
        if (!body.match_id) return json({ error: "match_id is required" }, 400);
        const { data, error } = await admin.rpc("fn_settle_match_bets", { p_match_id: body.match_id });
        if (error) throw error;
        result = data as Record<string, unknown>;
        break;
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[admin-sportsbook-actions]", action, message);
    return json({ error: message }, 400);
  }

  await admin.from("audit_logs").insert({
    user_id: user.id,
    action: `sportsbook.${action}`,
    resource_type: body.odds_id ? "match_odds" : "platform_matches",
    resource_id: body.odds_id ?? body.match_id ?? null,
    metadata: { reason, request: body, result },
  }).select();

  return json({ ok: true, action, result });
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
