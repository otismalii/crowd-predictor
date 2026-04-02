/**
 * Ledger entry types and validation.
 * The ledger is the canonical source of truth for all balance changes.
 */

export const ENTRY_TYPES = [
  "deposit",
  "withdrawal",
  "trade_buy",
  "trade_sell",
  "settlement_win",
  "settlement_loss",
  "refund",
  "house_fee",
  "credit_grant",
] as const;

export type EntryType = typeof ENTRY_TYPES[number];

export interface LedgerEntry {
  id: string;
  user_id: string | null;
  guest_id: string | null;
  wallet_id: string | null;
  entry_type: string;
  amount: number;
  balance_after: number;
  reference_id: string | null;
  description: string | null;
  created_at: string;
}

export function getEntryLabel(type: string): string {
  const labels: Record<string, string> = {
    deposit: "Deposit",
    withdrawal: "Withdrawal",
    trade_buy: "Buy Shares",
    trade_sell: "Sell Shares",
    settlement_win: "Settlement (Win)",
    settlement_loss: "Settlement (Loss)",
    refund: "Refund",
    house_fee: "House Fee",
    credit_grant: "Credits Granted",
    bet_stake: "Bet Placed",
    bet_win: "Bet Won",
    bet_refund: "Bet Refund",
  };
  return labels[type] || type;
}

export function isCredit(type: string): boolean {
  return ["deposit", "trade_sell", "settlement_win", "refund", "credit_grant", "bet_win", "bet_refund"].includes(type);
}
