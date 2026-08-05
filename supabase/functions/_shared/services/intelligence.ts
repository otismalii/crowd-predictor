// IntelligenceService — market intelligence and Oracle output reads (absorbs the LOGIK Oracle surface).
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export class IntelligenceService {
  constructor(private db: SupabaseClient) {}

  async forMarket(marketId: string) {
    const { data, error } = await this.db
      .from("market_intelligence")
      .select("*")
      .eq("market_id", marketId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async sources(marketId: string) {
    const { data, error } = await this.db
      .from("market_sources")
      .select("id, source_type, source_name, source_url, confidence, fetched_at")
      .eq("market_id", marketId)
      .order("confidence", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async recentRuns(limit = 50) {
    const { data, error } = await this.db
      .from("oracle_runs")
      .select("id, pipeline_stage, action, model, latency_ms, status, error, created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 200));
    if (error) throw new Error(error.message);
    return data ?? [];
  }
}
