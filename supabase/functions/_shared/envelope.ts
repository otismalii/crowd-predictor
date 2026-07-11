// Shared event envelope contract for all money-moving edge functions.
// Every privileged action emits one envelope row before any state changes.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export interface Envelope {
  event_type: string;
  aggregate_type: string;
  aggregate_id?: string;
  actor_id?: string;
  payload: Record<string, unknown>;
  idempotency_key: string;
  correlation_id?: string;
  causation_id?: string;
}

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export function userClient(authHeader: string): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
}

/** Emit an event envelope. Returns event_id; if idempotency_key already exists, returns the original event_id. */
export async function emitEvent(db: SupabaseClient, env: Envelope): Promise<{ event_id: string; replayed: boolean }> {
  const { data: existing } = await db.from("event_log").select("id").eq("idempotency_key", env.idempotency_key).maybeSingle();
  if (existing) return { event_id: existing.id, replayed: true };

  const { data, error } = await db.from("event_log").insert({
    event_type: env.event_type,
    aggregate_type: env.aggregate_type,
    aggregate_id: env.aggregate_id ?? null,
    actor_id: env.actor_id ?? null,
    payload: env.payload,
    idempotency_key: env.idempotency_key,
  }).select("id").single();

  if (error) throw new Error(`emitEvent failed: ${error.message}`);
  return { event_id: data.id, replayed: false };
}

export function ok(data: Record<string, unknown>, correlation_id?: string) {
  return new Response(JSON.stringify({ ok: true, data, correlation_id }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
export function err(message: string, status = 400, correlation_id?: string) {
  return new Response(JSON.stringify({ ok: false, error: message, correlation_id }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
