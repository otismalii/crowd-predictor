import { supabase } from "@/integrations/supabase/client";
import { safeFetch } from "@/lib/api";

export async function fetchWallet(userId: string) {
  return safeFetch(
    supabase.from("wallets").select("*").eq("user_id", userId).single() as any
  );
}

export async function fetchTransactions(userId: string, limit = 50) {
  return safeFetch(
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit) as any
  );
}

export async function fetchUserLedger(userId: string, limit = 50) {
  return safeFetch(
    supabase
      .from("ledger_entries")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit) as any
  );
}
