// Uniform response envelope + tag-based read cache for the /api/v1 gateway.
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { apiCorsHeaders } from "./security.ts";

export const API_VERSION = "v1";

export function apiOk(data: unknown, meta: Record<string, unknown> = {}, status = 200) {
  return new Response(JSON.stringify({ ok: true, data, error: null, meta: { version: API_VERSION, ...meta } }), {
    status,
    headers: { ...apiCorsHeaders, "Content-Type": "application/json" },
  });
}

export function apiErr(message: string, status = 400, meta: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ ok: false, data: null, error: message, meta: { version: API_VERSION, ...meta } }), {
    status,
    headers: { ...apiCorsHeaders, "Content-Type": "application/json" },
  });
}

/** Read-through cache for public reads. Falls back to the loader on any cache failure. */
export async function cached<T>(
  db: SupabaseClient,
  key: string,
  tags: string[],
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<{ value: T; hit: boolean }> {
  try {
    const { data } = await db
      .from("cache_entries")
      .select("value, expires_at")
      .eq("key", key)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (data) return { value: data.value as T, hit: true };
  } catch {
    // fall through to loader
  }

  const value = await loader();
  try {
    await db.from("cache_entries").upsert(
      {
        key,
        value: value as unknown as Record<string, unknown>,
        tags,
        expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      },
      { onConflict: "key" },
    );
  } catch {
    // cache write is best-effort
  }
  return { value, hit: false };
}

export async function invalidateTags(db: SupabaseClient, tags: string[]) {
  if (!tags.length) return;
  await db.from("cache_entries").delete().overlaps("tags", tags);
  await db.from("event_log").insert({
    aggregate_type: "cache",
    event_type: "cache.invalidated",
    payload: { tags },
    idempotency_key: `cache_invalidated:${tags.join(",")}:${Date.now()}`,
  });
}
