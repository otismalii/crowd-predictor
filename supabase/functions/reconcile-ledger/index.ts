// Nightly reconciliation: compare wallets.balance to ledger truth (derived_balance).
// Drift > 0.01 KES is logged as critical and notifies admins.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, serviceClient, ok, err } from "../_shared/envelope.ts";

const DRIFT_THRESHOLD = 0.01;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const db = serviceClient();
    const { data: wallets } = await db.from("wallets").select("user_id, balance");
    if (!wallets) return err("No wallets found");

    const runs: Array<Record<string, unknown>> = [];
    let driftCount = 0;
    let criticalCount = 0;

    for (const w of wallets) {
      const { data: derived } = await db.rpc("derived_balance", { p_user_id: w.user_id });
      const ledger = Number(derived ?? 0);
      const cached = Number(w.balance ?? 0);
      const drift = +(cached - ledger).toFixed(4);
      const absDrift = Math.abs(drift);
      let status: "ok" | "drift" | "critical" = "ok";
      if (absDrift > 1) { status = "critical"; criticalCount++; }
      else if (absDrift > DRIFT_THRESHOLD) { status = "drift"; driftCount++; }

      runs.push({
        user_id: w.user_id,
        wallet_balance: cached,
        ledger_balance: ledger,
        drift,
        status,
      });
    }

    // Bulk insert
    const { error: insertErr } = await db.from("reconciliation_runs").insert(runs);
    if (insertErr) throw insertErr;

    // Alert admins on critical drift
    if (criticalCount > 0) {
      const { data: admins } = await db.from("user_roles").select("user_id").in("role", ["admin", "super_admin"]);
      if (admins) {
        const notifs = admins.map(a => ({
          user_id: a.user_id,
          type: "reconciliation_alert",
          title: "🦅 Ledger drift detected",
          message: `${criticalCount} wallets with critical drift, ${driftCount} with minor drift.`,
          link: "/admin/reconciliation",
        }));
        await db.from("notifications").insert(notifs);
      }
    }

    return ok({ checked: wallets.length, drift_count: driftCount, critical_count: criticalCount });
  } catch (e) {
    console.error("reconcile-ledger error:", e);
    return err(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
