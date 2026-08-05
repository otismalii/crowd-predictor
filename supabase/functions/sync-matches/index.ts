// sync-matches — legacy entrypoint kept for the existing pg_cron schedule and admin buttons.
// Ingestion now lives in provider-sync (canonical football core). This is a thin forwarder.
import { corsHeaders } from "../_shared/envelope.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/provider-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ include_events: true, chain_markets: true }),
    });
    const payload = await res.json();

    const results: any[] = payload?.data?.results ?? [];
    const synced = results.reduce((sum, r) => sum + (r.processed ?? 0), 0);
    const total = results.reduce((sum, r) => sum + (r.fetched ?? 0), 0);

    return new Response(
      JSON.stringify({
        success: payload?.ok ?? false,
        synced,
        total,
        markets_created: payload?.data?.markets_created ?? 0,
        markets_resolved: payload?.data?.markets_resolved ?? 0,
        providers: results,
      }),
      { status: res.ok ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("sync-matches forward error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
