// provider-sync — canonical football ingestion.
// Reads enabled providers by priority, runs adapter -> normalizer -> upsert,
// logs the run to ingestion_logs (surfaced as sync_logs) and reports health.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/envelope.ts";
import { buildProvider, loadConnections, Normalizer, recordHealth } from "../_shared/providers/index.ts";

interface SyncRequest {
  provider?: string;
  window?: "upcoming" | "recent" | "today";
  include_events?: boolean;
  chain_markets?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  let body: SyncRequest = {};
  try {
    body = req.method === "POST" ? ((await req.json().catch(() => ({}))) as SyncRequest) : {};
  } catch {
    body = {};
  }

  const results: Record<string, unknown>[] = [];

  try {
    const connections = await loadConnections(db, body.provider);
    if (!connections.length) {
      return new Response(JSON.stringify({ ok: false, error: "No enabled providers" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const connection of connections) {
      const provider = buildProvider(connection);
      if (!provider) {
        results.push({ provider: connection.provider, skipped: "no_adapter" });
        continue;
      }

      const normalizer = new Normalizer(db, connection.provider);
      let fetched = 0;
      let processed = 0;
      let eventsWritten = 0;
      let failure: string | null = null;

      try {
        const fixtures = await provider.listFixtures({ window: body.window });
        fetched = fixtures.length;

        for (const fixture of fixtures) {
          const { id } = await normalizer.upsertFixture(fixture);
          if (!id) continue;
          processed += 1;

          if (body.include_events && (fixture.status === "live" || fixture.status === "finished")) {
            const events = await provider.listEvents(fixture.external_id);
            eventsWritten += await normalizer.replaceEvents(id, events);
          }
        }
      } catch (e) {
        failure = e instanceof Error ? e.message : String(e);
      }

      const stats = provider.stats();
      const avgLatency = stats.requests ? Math.round(stats.latency_ms / stats.requests) : null;
      const status = failure ? "down" : processed > 0 || fetched === 0 ? "healthy" : "degraded";

      await recordHealth(db, connection.id, status, avgLatency, failure);

      await db.from("ingestion_logs").insert({
        source_name: `provider:${connection.provider}`,
        status: failure ? "error" : "success",
        records_fetched: fetched,
        records_processed: processed,
        error_message: failure,
        raw_data: {
          window: body.window ?? "all",
          requests: stats.requests,
          avg_latency_ms: avgLatency,
          events_written: eventsWritten,
        },
      });

      await db.from("event_log").insert({
        aggregate_type: "provider",
        event_type: failure ? "provider.sync_failed" : "provider.synced",
        payload: {
          provider: connection.provider,
          fetched,
          processed,
          events_written: eventsWritten,
          avg_latency_ms: avgLatency,
          error: failure,
        },
        idempotency_key: `provider_sync:${connection.provider}:${Date.now()}`,
      });

      results.push({
        provider: connection.provider,
        fetched,
        processed,
        events_written: eventsWritten,
        avg_latency_ms: avgLatency,
        health: status,
        error: failure,
      });
    }

    // Keep the existing market lifecycle chain intact.
    let marketsCreated = 0;
    let marketsResolved = 0;
    if (body.chain_markets !== false) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/manage-markets`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        });
        if (res.ok) {
          const payload = await res.json();
          marketsCreated = payload.markets_created ?? 0;
          marketsResolved = payload.markets_resolved ?? 0;
        }
      } catch (e) {
        console.log("[provider-sync] manage-markets chain failed:", e);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, data: { results, markets_created: marketsCreated, markets_resolved: marketsResolved } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[provider-sync] error:", e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Unknown error", results }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
