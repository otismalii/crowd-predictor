import { supabase } from "@/integrations/supabase/client";
import { safeFetch } from "@/lib/api";

export interface TreasurySummary {
  totalInflow: number;
  totalOutflow: number;
  netBalance: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  totalWalletBalances: number;
}

export interface TransactionRow {
  id: string;
  user_id: string;
  wallet_id: string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
  mpesa_receipt: string | null;
  phone_number: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { username: string | null; email: string | null };
}

export async function fetchTreasurySummary(): Promise<{ data: TreasurySummary | null; error: string | null }> {
  const [txRes, walletRes] = await Promise.all([
    safeFetch(supabase.from("transactions").select("type, amount, status").limit(5000) as any),
    safeFetch(supabase.from("wallets").select("balance").limit(5000) as any),
  ]);

  if (txRes.error) return { data: null, error: txRes.error };

  const transactions = (txRes.data as any[]) || [];
  const wallets = (walletRes.data as any[]) || [];

  const completedDeposits = transactions.filter(t => t.type === "deposit" && t.status === "completed");
  const completedWithdrawals = transactions.filter(t => t.type === "withdrawal" && t.status === "completed");
  const pendingDeposits = transactions.filter(t => t.type === "deposit" && t.status === "pending");
  const pendingWithdrawals = transactions.filter(t => t.type === "withdrawal" && t.status === "pending");

  const totalInflow = completedDeposits.reduce((s, t) => s + Number(t.amount), 0);
  const totalOutflow = completedWithdrawals.reduce((s, t) => s + Number(t.amount), 0);
  const totalWalletBalances = wallets.reduce((s, w) => s + Number(w.balance), 0);

  return {
    data: {
      totalInflow,
      totalOutflow,
      netBalance: totalInflow - totalOutflow,
      pendingDeposits: pendingDeposits.reduce((s, t) => s + Number(t.amount), 0),
      pendingWithdrawals: pendingWithdrawals.reduce((s, t) => s + Number(t.amount), 0),
      totalWalletBalances,
    },
    error: null,
  };
}

export async function fetchAdminTransactions(
  filters: { status?: string; type?: string; search?: string; limit?: number }
): Promise<{ data: TransactionRow[] | null; error: string | null }> {
  let query = supabase
    .from("transactions")
    .select("*, profiles:user_id(username, email)")
    .order("created_at", { ascending: false })
    .limit(filters.limit || 100);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status as any);
  }
  if (filters.type && filters.type !== "all") {
    query = query.eq("type", filters.type as any);
  }
  if (filters.search) {
    query = query.or(`mpesa_receipt.ilike.%${filters.search}%,phone_number.ilike.%${filters.search}%`);
  }

  return safeFetch(query as any) as any;
}

export async function fetchLedgerEntries(limit = 100) {
  return safeFetch(
    supabase
      .from("ledger_entries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit) as any
  );
}

/**
 * Approve a pending transaction (deposit or withdrawal).
 * For deposits: credit wallet. For withdrawals: mark as processed (funds already held).
 */
export async function approveTransaction(tx: TransactionRow): Promise<{ error: string | null }> {
  try {
    if (tx.type === "deposit") {
      // Credit wallet
      const { data: wallet } = await supabase.from("wallets").select("id, balance").eq("id", tx.wallet_id).single();
      if (wallet) {
        await supabase.from("wallets").update({
          balance: Number(wallet.balance) + Number(tx.amount),
          updated_at: new Date().toISOString(),
        }).eq("id", wallet.id);
      }
    }
    // Update transaction status
    await supabase.from("transactions").update({
      status: "completed",
      updated_at: new Date().toISOString(),
    }).eq("id", tx.id);

    // Notify user
    await supabase.from("notifications").insert({
      user_id: tx.user_id,
      type: tx.type,
      title: tx.type === "deposit" ? "Deposit Approved" : "Withdrawal Processed",
      message: `Your ${tx.type} of KES ${Number(tx.amount).toLocaleString()} has been approved`,
      link: "/wallet",
    });

    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}

/**
 * Reject a pending transaction.
 * For withdrawals: refund the held balance.
 */
export async function rejectTransaction(tx: TransactionRow): Promise<{ error: string | null }> {
  try {
    if (tx.type === "withdrawal") {
      // Refund wallet
      const { data: wallet } = await supabase.from("wallets").select("id, balance").eq("id", tx.wallet_id).single();
      if (wallet) {
        await supabase.from("wallets").update({
          balance: Number(wallet.balance) + Number(tx.amount),
          updated_at: new Date().toISOString(),
        }).eq("id", wallet.id);
      }
    }
    await supabase.from("transactions").update({
      status: "failed",
      description: (tx.description || "") + " [REJECTED BY ADMIN]",
      updated_at: new Date().toISOString(),
    }).eq("id", tx.id);

    await supabase.from("notifications").insert({
      user_id: tx.user_id,
      type: tx.type,
      title: tx.type === "deposit" ? "Deposit Rejected" : "Withdrawal Rejected",
      message: `Your ${tx.type} of KES ${Number(tx.amount).toLocaleString()} was rejected`,
      link: "/wallet",
    });

    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}
