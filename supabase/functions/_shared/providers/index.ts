// Provider registry: builds a FootballProvider from a provider_connections row.
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { TheSportsDbProvider } from "./thesportsdb.ts";
import type { FootballProvider, ProviderConnection } from "./types.ts";

export * from "./types.ts";
export { Normalizer } from "./normalize.ts";

export async function loadConnections(db: SupabaseClient, provider?: string): Promise<ProviderConnection[]> {
  let query = db
    .from("provider_connections")
    .select("id, provider, display_name, base_url, secret_name, priority, is_enabled, rate_limit_per_min, config")
    .eq("is_enabled", true)
    .order("priority", { ascending: true });
  if (provider) query = query.eq("provider", provider);
  const { data, error } = await query;
  if (error) throw new Error(`loadConnections failed: ${error.message}`);
  return (data ?? []) as ProviderConnection[];
}

export function buildProvider(connection: ProviderConnection): FootballProvider | null {
  const secret = connection.secret_name ? Deno.env.get(connection.secret_name) : null;

  switch (connection.provider) {
    case "thesportsdb": {
      const key = secret ?? (connection.config?.api_key as string | undefined) ?? "123";
      return new TheSportsDbProvider(connection, key);
    }
    default:
      console.log(`[providers] no adapter registered for "${connection.provider}"`);
      return null;
  }
}

export async function recordHealth(
  db: SupabaseClient,
  connectionId: string,
  status: "healthy" | "degraded" | "down",
  latencyMs: number | null,
  error?: string | null,
) {
  await db
    .from("provider_connections")
    .update({
      health_status: status,
      last_latency_ms: latencyMs,
      last_checked_at: new Date().toISOString(),
      last_error: error ?? null,
    })
    .eq("id", connectionId);
}
