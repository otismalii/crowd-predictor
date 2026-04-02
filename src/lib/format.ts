import { formatDistanceToNow, format } from "date-fns";

export function formatKES(amount: number, compact = false): string {
  if (compact) {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  }
  return Math.round(amount).toLocaleString();
}

export function formatPercent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatPnl(value: number): string {
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${formatKES(value)}`;
}

export function formatTimeLeft(date: string | null): string | null {
  if (!date) return null;
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatDate(date: string, pattern = "MMM d, yyyy"): string {
  return format(new Date(date), pattern);
}

export function formatDateTime(date: string): string {
  return format(new Date(date), "MMM d, HH:mm");
}
