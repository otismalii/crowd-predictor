import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await userSupabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { amount, phone_number } = await req.json();
    if (!amount || amount < 10) {
      return new Response(JSON.stringify({ error: "Minimum withdrawal is KES 10" }), { status: 400, headers: corsHeaders });
    }
    if (!phone_number) {
      return new Response(JSON.stringify({ error: "Phone number required" }), { status: 400, headers: corsHeaders });
    }

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: wallet } = await db.from("wallets").select("id, balance").eq("user_id", user.id).single();
    if (!wallet || Number(wallet.balance) < amount) {
      return new Response(JSON.stringify({ error: "Insufficient balance" }), { status: 400, headers: corsHeaders });
    }

    // Deduct immediately (hold)
    await db.from("wallets").update({
      balance: Number(wallet.balance) - amount,
      updated_at: new Date().toISOString(),
    }).eq("id", wallet.id);

    // Create pending withdrawal transaction
    const { data: tx } = await db.from("transactions").insert({
      user_id: user.id,
      wallet_id: wallet.id,
      type: "withdrawal",
      amount,
      status: "pending",
      phone_number,
      reference: `WDR-${Date.now()}-${user.id.slice(0, 8)}`,
      description: `Withdrawal request of KES ${amount} to ${phone_number}`,
    }).select("id").single();

    // Ledger entry
    await db.from("ledger_entries").insert({
      user_id: user.id,
      wallet_id: wallet.id,
      entry_type: "withdrawal",
      amount: -amount,
      balance_after: Number(wallet.balance) - amount,
      reference_id: tx?.id,
      description: `Withdrawal hold - pending admin approval`,
    });

    // Notify user
    await db.from("notifications").insert({
      user_id: user.id,
      type: "withdrawal",
      title: "Withdrawal Submitted",
      message: `Your withdrawal of KES ${amount.toLocaleString()} is pending approval`,
      link: "/wallet",
    });

    return new Response(
      JSON.stringify({ success: true, message: "Withdrawal submitted for admin approval", transaction_id: tx?.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("pesapal-withdraw error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
