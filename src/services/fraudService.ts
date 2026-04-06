import { supabase } from "@/integrations/supabase/client";
import { safeFetch } from "@/lib/api";

export interface FraudAlert {
  id: string;
  type: "duplicate_mpesa" | "rapid_submission" | "suspicious_amount" | "manual_flag";
  severity: "low" | "medium" | "high" | "critical";
  user_id: string;
  username: string | null;
  description: string;
  metadata: Record<string, any>;
  created_at: string;
}

/**
 * Scans transactions for fraud patterns:
 * 1. Duplicate M-Pesa receipts
 * 2. Rapid submission (multiple deposits in < 2 min)
 * 3. Suspicious large amounts
 */
export async function scanForFraudAlerts(): Promise<{ data: FraudAlert[]; error: string | null }> {
  const { data: transactions, error } = await safeFetch(
    supabase
      .from("transactions")
      .select("*, profiles:user_id(username)")
      .order("created_at", { ascending: false })
      .limit(1000) as any
  );

  if (error || !transactions) return { data: [], error };

  const alerts: FraudAlert[] = [];
  const txList = transactions as any[];

  // 1. Duplicate M-Pesa receipts
  const receiptMap = new Map<string, any[]>();
  for (const tx of txList) {
    if (tx.mpesa_receipt) {
      const existing = receiptMap.get(tx.mpesa_receipt) || [];
      existing.push(tx);
      receiptMap.set(tx.mpesa_receipt, existing);
    }
  }
  for (const [receipt, txs] of receiptMap) {
    if (txs.length > 1) {
      alerts.push({
        id: `dup-${receipt}`,
        type: "duplicate_mpesa",
        severity: "critical",
        user_id: txs[0].user_id,
        username: txs[0].profiles?.username,
        description: `M-Pesa receipt ${receipt} used ${txs.length} times`,
        metadata: { receipt, count: txs.length, transaction_ids: txs.map((t: any) => t.id) },
        created_at: txs[0].created_at,
      });
    }
  }

  // 2. Rapid submissions (same user, < 2 min apart)
  const byUser = new Map<string, any[]>();
  for (const tx of txList.filter(t => t.type === "deposit")) {
    const existing = byUser.get(tx.user_id) || [];
    existing.push(tx);
    byUser.set(tx.user_id, existing);
  }
  for (const [userId, txs] of byUser) {
    const sorted = txs.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    for (let i = 1; i < sorted.length; i++) {
      const gap = new Date(sorted[i].created_at).getTime() - new Date(sorted[i - 1].created_at).getTime();
      if (gap < 120000) { // 2 minutes
        alerts.push({
          id: `rapid-${sorted[i].id}`,
          type: "rapid_submission",
          severity: "high",
          user_id: userId,
          username: sorted[i].profiles?.username,
          description: `Deposit submitted ${Math.round(gap / 1000)}s after previous one`,
          metadata: { gap_seconds: Math.round(gap / 1000), transaction_id: sorted[i].id },
          created_at: sorted[i].created_at,
        });
      }
    }
  }

  // 3. Suspicious amounts (> 50,000 KES)
  for (const tx of txList) {
    if (Number(tx.amount) > 50000) {
      alerts.push({
        id: `large-${tx.id}`,
        type: "suspicious_amount",
        severity: "medium",
        user_id: tx.user_id,
        username: tx.profiles?.username,
        description: `Large ${tx.type} of KES ${Number(tx.amount).toLocaleString()}`,
        metadata: { amount: tx.amount, type: tx.type },
        created_at: tx.created_at,
      });
    }
  }

  // Sort by severity
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return { data: alerts, error: null };
}
