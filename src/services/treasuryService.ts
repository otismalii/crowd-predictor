import { supabase } from "@/integrations/supabase/client";
import { safeFetch } from "@/lib/api";

export interface TreasurySummary {
  totalInflow: number;
  totalOutflow: number;
  netBalance: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  totalWalletBalances: number;
  platformRevenue: number;
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
  const [txRes, walletRes, ledgerRes] = await Promise.all([
    safeFetch(supabase.from("transactions").select("type, amount, status").limit(5000) as any),
    safeFetch(supabase.from("wallets").select("balance").limit(5000) as any),
    safeFetch(supabase.from("ledger_entries").select("entry_type, amount").eq("entry_type", "house_fee").limit(5000) as any),
  ]);

  if (txRes.error) return { data: null, error: txRes.error };

  const transactions = (txRes.data as any[]) || [];
  const wallets = (walletRes.data as any[]) || [];
  const fees = (ledgerRes.data as any[]) || [];

  const completedDeposits = transactions.filter(t => t.type === "deposit" && t.status === "completed");
  const completedWithdrawals = transactions.filter(t => t.type === "withdrawal" && t.status === "completed");
  const pendingDeposits = transactions.filter(t => t.type === "deposit" && t.status === "pending");
  const pendingWithdrawals = transactions.filter(t => t.type === "withdrawal" && t.status === "pending");

  const totalInflow = completedDeposits.reduce((s, t) => s + Number(t.amount), 0);
  const totalOutflow = completedWithdrawals.reduce((s, t) => s + Number(t.amount), 0);
  const totalWalletBalances = wallets.reduce((s, w) => s + Number(w.balance), 0);
  const platformRevenue = fees.reduce((s, f) => s + Math.abs(Number(f.amount)), 0);

  return {
    data: {
      totalInflow,
      totalOutflow,
      netBalance: totalInflow - totalOutflow,
      pendingDeposits: pendingDeposits.reduce((s, t) => s + Number(t.amount), 0),
      pendingWithdrawals: pendingWithdrawals.reduce((s, t) => s + Number(t.amount), 0),
      totalWalletBalances,
      platformRevenue,
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
 * Approve a pending transaction with mandatory reason + audit log.
 */
export async function approveTransaction(tx: TransactionRow, reason?: string): Promise<{ error: string | null }> {
  try {
    const currentUser = (await supabase.auth.getUser()).data.user;

    if (tx.type === "deposit") {
      const { data: wallet } = await supabase.from("wallets").select("id, balance").eq("id", tx.wallet_id).single();
      if (wallet) {
        const newBalance = Number(wallet.balance) + Number(tx.amount);
        await supabase.from("wallets").update({
          balance: newBalance,
          updated_at: new Date().toISOString(),
        }).eq("id", wallet.id);

        await supabase.from("ledger_entries").insert({
          user_id: tx.user_id,
          wallet_id: wallet.id,
          entry_type: "deposit",
          amount: Number(tx.amount),
          balance_after: newBalance,
          reference_id: tx.id,
          description: `Deposit approved - KES ${Number(tx.amount).toLocaleString()}`,
        });
      }
    }

    await supabase.from("transactions").update({
      status: "completed",
      updated_at: new Date().toISOString(),
    }).eq("id", tx.id);

    // Audit log
    if (currentUser) {
      await supabase.from("market_audit_log").insert({
        action: "transaction_approved",
        performed_by: currentUser.id,
        details: {
          transaction_id: tx.id,
          type: tx.type,
          amount: tx.amount,
          user_id: tx.user_id,
          reason: reason || "No reason provided",
        },
      });
    }

    await supabase.from("notifications").insert({
      user_id: tx.user_id,
      type: tx.type,
      title: tx.type === "deposit" ? "🦅 Deposit Approved" : "🦅 Landing Confirmed",
      message: `Your ${tx.type} of KES ${Number(tx.amount).toLocaleString()} has been approved`,
      link: "/wallet",
    });

    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}

/**
 * Reject a pending transaction with mandatory reason + audit log.
 */
export async function rejectTransaction(tx: TransactionRow, reason?: string): Promise<{ error: string | null }> {
  try {
    const currentUser = (await supabase.auth.getUser()).data.user;

    if (tx.type === "withdrawal") {
      const { data: wallet } = await supabase.from("wallets").select("id, balance").eq("id", tx.wallet_id).single();
      if (wallet) {
        const newBalance = Number(wallet.balance) + Number(tx.amount);
        await supabase.from("wallets").update({
          balance: newBalance,
          updated_at: new Date().toISOString(),
        }).eq("id", wallet.id);

        await supabase.from("ledger_entries").insert({
          user_id: tx.user_id,
          wallet_id: wallet.id,
          entry_type: "refund",
          amount: Number(tx.amount),
          balance_after: newBalance,
          reference_id: tx.id,
          description: `Withdrawal rejected - funds returned${reason ? `: ${reason}` : ""}`,
        });
      }
    }

    await supabase.from("transactions").update({
      status: "failed",
      description: (tx.description || "") + ` [REJECTED${reason ? `: ${reason}` : ""}]`,
      updated_at: new Date().toISOString(),
    }).eq("id", tx.id);

    // Audit log
    if (currentUser) {
      await supabase.from("market_audit_log").insert({
        action: "transaction_rejected",
        performed_by: currentUser.id,
        details: {
          transaction_id: tx.id,
          type: tx.type,
          amount: tx.amount,
          user_id: tx.user_id,
          reason: reason || "No reason provided",
        },
      });
    }

    await supabase.from("notifications").insert({
      user_id: tx.user_id,
      type: tx.type,
      title: "⚠️ Turbulence Detected",
      message: `Your ${tx.type} of KES ${Number(tx.amount).toLocaleString()} was rejected${reason ? `: ${reason}` : ""}`,
      link: "/wallet",
    });

    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}