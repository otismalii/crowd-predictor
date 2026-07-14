import { supabase } from "@/integrations/supabase/client";

export interface MarketIntelligence {
  market_id: string;
  summary: string | null;
  bull_case: string | null;
  bear_case: string | null;
  risk_level: "low" | "medium" | "high" | "critical" | null;
  risk_notes: string | null;
  confidence: number | null;
  momentum: number | null;
  buy_pressure: number | null;
  sell_pressure: number | null;
  liquidity_score: number | null;
  event_timeline: Array<{ ts: string; label: string; kind: string }>;
  sources: Array<{ url?: string; publisher?: string; source_type?: string; snapshot_excerpt?: string }>;
  generated_by: string | null;
  oracle_run_id: string | null;
  lang: string | null;
  generated_at: string;
  updated_at: string;
}

export async function fetchIntelligence(marketId: string): Promise<MarketIntelligence | null> {
  const { data } = await (supabase as any)
    .from("market_intelligence")
    .select("*")
    .eq("market_id", marketId)
    .maybeSingle();
  return data as MarketIntelligence | null;
}

/** Trigger edge function to generate/refresh intelligence. Returns row. */
export async function requestIntelligence(marketId: string, opts?: { force?: boolean; lang?: "en" | "sw" }) {
  const { data, error } = await supabase.functions.invoke("market-intelligence", {
    body: { market_id: marketId, force: opts?.force ?? false, lang: opts?.lang ?? "en" },
  });
  if (error) throw error;
  return data?.row as MarketIntelligence | null;
}
