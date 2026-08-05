// Shared security helpers for every /api/v1 handler: caller identity, API keys, RBAC, rate limiting.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const apiCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-product, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

export type CallerKind = "anon" | "user" | "service";

export interface Caller {
  kind: CallerKind;
  userId: string | null;
  roles: string[];
  scopes: string[];
  product: string;
}

export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Identify the caller from either a Supabase JWT or a platform API key. Never throws. */
export async function identify(req: Request, db: SupabaseClient): Promise<Caller> {
  const product = req.headers.get("x-product") ?? "pagaza";
  const apiKey = req.headers.get("x-api-key");

  if (apiKey) {
    const hash = await sha256Hex(apiKey);
    const { data } = await db
      .from("api_keys")
      .select("id, scopes, product, is_active, expires_at, revoked_at")
      .eq("key_hash", hash)
      .maybeSingle();
    const valid =
      data?.is_active &&
      !data.revoked_at &&
      (!data.expires_at || new Date(data.expires_at).getTime() > Date.now());
    if (valid) {
      await db.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data!.id);
      return { kind: "service", userId: null, roles: [], scopes: data!.scopes ?? ["read"], product: data!.product ?? product };
    }
    return { kind: "anon", userId: null, roles: [], scopes: [], product };
  }

  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const { data, error } = await db.auth.getClaims(token);
    const userId = (data as any)?.claims?.sub as string | undefined;
    if (!error && userId) {
      const { data: roleRows } = await db.from("user_roles").select("role").eq("user_id", userId);
      return {
        kind: "user",
        userId,
        roles: (roleRows ?? []).map((r: any) => r.role),
        scopes: ["read", "write"],
        product,
      };
    }
  }

  return { kind: "anon", userId: null, roles: [], scopes: [], product };
}

export function hasAnyRole(caller: Caller, roles: string[]): boolean {
  return caller.roles.some((r) => roles.includes(r));
}

export const ADMIN_ROLES = ["admin", "super_admin"];
export const OPERATOR_ROLES = ["admin", "super_admin", "market_operator", "market_manager", "mini_admin"];

/** Coarse per-caller rate limit backed by cache_entries. Fails open on storage errors. */
export async function rateLimit(
  db: SupabaseClient,
  caller: Caller,
  bucket: string,
  limit: number,
  windowSeconds = 60,
): Promise<{ allowed: boolean; remaining: number }> {
  const identity = caller.userId ?? `${caller.kind}:${caller.product}`;
  const slot = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = `ratelimit:${bucket}:${identity}:${slot}`;
  try {
    const { data } = await db.from("cache_entries").select("value").eq("key", key).maybeSingle();
    const count = ((data?.value as any)?.count ?? 0) + 1;
    await db.from("cache_entries").upsert(
      {
        key,
        value: { count },
        tags: ["ratelimit"],
        expires_at: new Date(Date.now() + windowSeconds * 1000).toISOString(),
      },
      { onConflict: "key" },
    );
    return { allowed: count <= limit, remaining: Math.max(limit - count, 0) };
  } catch {
    return { allowed: true, remaining: limit };
  }
}
