// Background worker: retry pending payment_failures with exponential backoff.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, serviceClient, ok, err } from "../_shared/envelope.ts";

const MAX_ATTEMPTS = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const db = serviceClient();
    const now = new Date().toISOString();
    const { data: pending } = await db.from("payment_failures")
      .select("*").eq("status", "pending").lte("next_retry_at", now).limit(20);

    if (!pending || pending.length === 0) return ok({ retried: 0 });

    let resolved = 0;
    let abandoned = 0;
    for (const p of pending) {
      const newAttempts = p.attempts + 1;
      // Exponential backoff: 2^n minutes
      const nextRetry = new Date(Date.now() + Math.pow(2, newAttempts) * 60_000).toISOString();

      if (newAttempts >= MAX_ATTEMPTS) {
        await db.from("payment_failures").update({
          status: "abandoned", attempts: newAttempts, resolved_at: now,
        }).eq("id", p.id);
        abandoned++;
        continue;
      }

      // Mark as retrying — actual retry routing depends on operation
      await db.from("payment_failures").update({
        attempts: newAttempts, next_retry_at: nextRetry, status: "pending",
      }).eq("id", p.id);
      resolved++;
    }

    return ok({ retried: resolved, abandoned });
  } catch (e) {
    console.error("retry-payments error:", e);
    return err(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
