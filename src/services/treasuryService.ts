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

async function invokeFn(fn: string, body: Record<string, unknown>): Promise<{ data: any; error: string | null }> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    let msg = error.message;
    try { const ctx = await (error as any).context?.json?.(); if (ctx?.error) msg = ctx.error; } catch { /* ignore */ }
    return { data: null, error: msg };
  }
  if (data && typeof data === "object" && "error" in data) return { data: null, error: String(data.error) };
  return { data, error: null };
}

async function findWithdrawalRequestId(tx: TransactionRow): Promise<string | null> {
  const { data } = await supabase.from("withdrawal_requests").select("id").eq("transaction_id", tx.id).maybeSingle();
  return (data as any)?.id ?? null;
}

/**
 * Approve a pending transaction. All money movement runs server-side:
 * - withdrawals: atomic claim + real M-Pesa payout + ledger settlement
 * - deposits: re-verified with PesaPal and credited only if PesaPal confirms payment
 */
export async function approveTransaction(tx: TransactionRow, reason?: string): Promise<{ error: string | null }> {
  if (!reason?.trim()) return { error: "A reason is required" };
  if (tx.type === "withdrawal") {
    const requestId = await findWithdrawalRequestId(tx);
    if (!requestId) return { error: "No withdrawal request linked to this transaction" };
    const { error } = await invokeFn("admin-finance-actions", { action: "approve_withdrawal", request_id: requestId, reason });
    return { error };
  }
  if (tx.type === "deposit") {
    const { error } = await invokeFn("pesapal-status", {});
    if (error) return { error };
    const { data } = await supabase.from("transactions").select("status").eq("id", tx.id).maybeSingle();
    if ((data as any)?.status !== "completed") {
      return { error: "PesaPal has not confirmed this payment yet — deposits are only credited once PesaPal confirms" };
    }
    return { error: null };
  }
  return { error: "This transaction type cannot be approved manually" };
}

/**
 * Reject a pending transaction. Withdrawals release held funds through the ledger server-side.
 */
export async function rejectTransaction(tx: TransactionRow, reason?: string): Promise<{ error: string | null }> {
  if (!reason?.trim()) return { error: "A reason is required" };
  if (tx.type === "withdrawal") {
    const requestId = await findWithdrawalRequestId(tx);
    if (!requestId) return { error: "No withdrawal request linked to this transaction" };
    const { error } = await invokeFn("admin-finance-actions", { action: "reject_withdrawal", request_id: requestId, reason });
    return { error };
  }
  // Deposits: no money moved yet, just mark the intent failed.
  const { error } = await supabase.from("transactions").update({
    status: "failed",
    description: (tx.description || "") + ` [REJECTED: ${reason}]`,
    updated_at: new Date().toISOString(),
  }).eq("id", tx.id);
  return { error: error?.message ?? null };
}
