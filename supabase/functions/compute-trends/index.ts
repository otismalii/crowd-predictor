// Aggregates trade activity into market_trends rows for 1h, 24h, 7d windows.
// Run via pg_cron every 15 minutes.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, serviceClient, ok, err } from "../_shared/envelope.ts";

const WINDOWS: Array<{ label: "1h" | "24h" | "7d"; ms: number }> = [
  { label: "1h", ms: 3600_000 },
  { label: "24h", ms: 86_400_000 },
  { label: "7d", ms: 7 * 86_400_000 },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const db = serviceClient();
    const { data: markets } = await db.from("markets").select("id").eq("status", "open");
    if (!markets) return ok({ markets: 0 });

    const inserts: Array<Record<string, unknown>> = [];

    for (const m of markets) {
      for (const w of WINDOWS) {
        const since = new Date(Date.now() - w.ms).toISOString();
        const { data: trades } = await db.from("trades").select("user_id, total_cost, price_per_share, created_at")
          .eq("market_id", m.id).gte("created_at", since);

        if (!trades || trades.length === 0) {
          inserts.push({
            market_id: m.id, window: w.label,
            volume_delta: 0, price_delta: 0, unique_traders: 0, trade_count: 0,
          });
          continue;
        }

        const volume = trades.reduce((s, t) => s + Number(t.total_cost || 0), 0);
        const uniqueTraders = new Set(trades.map(t => t.user_id)).size;
        const sortedByTime = [...trades].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
        const priceDelta = sortedByTime.length > 1
          ? Number(sortedByTime[sortedByTime.length - 1].price_per_share) - Number(sortedByTime[0].price_per_share)
          : 0;

        inserts.push({
          market_id: m.id,
          window: w.label,
          volume_delta: +volume.toFixed(2),
          price_delta: +priceDelta.toFixed(4),
          unique_traders: uniqueTraders,
          trade_count: trades.length,
        });
      }
    }

    if (inserts.length > 0) await db.from("market_trends").insert(inserts);
    return ok({ markets: markets.length, rows: inserts.length });
  } catch (e) {
    console.error("compute-trends error:", e);
    return err(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
