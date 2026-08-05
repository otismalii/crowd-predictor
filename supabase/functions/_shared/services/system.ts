// SystemService — platform health, feature flags, providers, sync monitor reads.
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export class SystemService {
  constructor(private db: SupabaseClient) {}

  async featureFlags(product = "all") {
    const { data, error } = await this.db
      .from("feature_flags")
      .select("key, description, product, is_enabled, rollout_percentage, payload")
      .in("product", product === "all" ? ["all"] : ["all", product]);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async providers() {
    const { data, error } = await this.db
      .from("provider_connections")
      .select("id, provider, display_name, base_url, priority, is_enabled, rate_limit_per_min, health_status, last_latency_ms, last_checked_at, last_error")
      .order("priority", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async syncLogs(limit = 50) {
    const { data, error } = await this.db
      .from("sync_logs")
      .select("id, source_name, status, records_fetched, records_processed, error_message, raw_data, created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 200));
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async syncJobs(limit = 50) {
    const { data, error } = await this.db
      .from("sync_jobs")
      .select("id, job_type, status, attempts, max_attempts, last_error, priority, started_at, finished_at, duration_ms, created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 200));
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async health() {
    const [matches, markets, providers] = await Promise.all([
      this.db.from("platform_matches").select("id", { count: "exact", head: true }),
      this.db.from("markets").select("id", { count: "exact", head: true }),
      this.db.from("provider_connections").select("provider, health_status, last_latency_ms").eq("is_enabled", true),
    ]);
    return {
      status: "ok",
      canonical_matches: matches.count ?? 0,
      markets: markets.count ?? 0,
      providers: providers.data ?? [],
      checked_at: new Date().toISOString(),
    };
  }

  async search(term: string, limit = 10) {
    const [markets, teams, competitions] = await Promise.all([
      this.db.from("markets").select("id, slug, title, category, status").ilike("title", `%${term}%`).limit(limit),
      this.db.from("teams").select("id, slug, name, logo_url").ilike("name", `%${term}%`).limit(limit),
      this.db.from("competitions").select("id, slug, name, country").ilike("name", `%${term}%`).limit(limit),
    ]);
    return { markets: markets.data ?? [], teams: teams.data ?? [], competitions: competitions.data ?? [] };
  }
}
