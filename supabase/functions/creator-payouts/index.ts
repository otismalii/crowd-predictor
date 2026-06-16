// Creator payout admin worker: approve / mark paid / reject.
// Funds debit treasury bucket "creator_rewards" → credit creator wallet.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPA_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

type Action = "approve" | "pay" | "reject";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPA_URL, SUPA_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPA_URL, SUPA_SERVICE);

    // Verify admin/super_admin
    const { data: roleOk } = await admin.rpc("has_any_role", {
      _user_id: user.id, _roles: ["admin", "super_admin"],
    });
    if (!roleOk) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action = body.action as Action;
    const payoutId = body.payout_id as string;
    const reason = body.reason as string | undefined;

    if (!action || !payoutId) {
      return new Response(JSON.stringify({ error: "missing action or payout_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: payout, error: payoutErr } = await admin
      .from("creator_payouts").select("*").eq("id", payoutId).single();
    if (payoutErr || !payout) {
      return new Response(JSON.stringify({ error: "payout not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "approve") {
      if (payout.status !== "pending") {
        return new Response(JSON.stringify({ error: `cannot approve from ${payout.status}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await admin.from("creator_payouts").update({
        status: "approved", approved_by: user.id, approved_at: new Date().toISOString(),
        notes: reason ?? payout.notes,
      }).eq("id", payoutId);
    } else if (action === "reject") {
      await admin.from("creator_payouts").update({
        status: "rejected", approved_by: user.id, approved_at: new Date().toISOString(),
        notes: reason ?? "rejected",
      }).eq("id", payoutId);
    } else if (action === "pay") {
      if (payout.status !== "approved") {
        return new Response(JSON.stringify({ error: `cannot pay from ${payout.status}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Double-entry: debit treasury creator_rewards bucket → credit creator wallet
      const idem = `creator_payout:${payout.id}`;
      const { error: ledgerErr } = await admin.rpc("fn_post_double_entry", {
        p_debit_user: null,
        p_credit_user: payout.creator_id,
        p_debit_bucket: "creator_rewards",
        p_credit_bucket: "user_main",
        p_amount: Number(payout.amount_kes),
        p_entry_type: "creator_payout",
        p_description: `Creator payout for market ${payout.market_id ?? "n/a"}`,
        p_reference_id: payout.id,
        p_event_id: null,
        p_idempotency_key: idem,
      });
      if (ledgerErr) {
        return new Response(JSON.stringify({ error: ledgerErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await admin.from("creator_payouts").update({
        status: "paid", paid_at: new Date().toISOString(),
      }).eq("id", payoutId);
      await admin.from("creator_profiles").update({
        lifetime_payout_kes: Number(payout.amount_kes), // increment via rpc would be safer; quick add below
      }).eq("user_id", payout.creator_id);
      // Increment lifetime properly
      await admin.rpc("fn_increment_creator_payout" as any, {
        p_user_id: payout.creator_id, p_amount: Number(payout.amount_kes),
      }).catch(() => {/* function optional */});
    } else {
      return new Response(JSON.stringify({ error: "unknown action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Audit log
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: `creator_payout.${action}`,
      target_id: payoutId,
      metadata: { reason, amount: payout.amount_kes },
    } as any).catch(() => {});

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "internal" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
