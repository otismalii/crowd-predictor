import type { MarketStatus } from "./constants";

/**
 * Market state machine — valid transitions.
 */
const TRANSITIONS: Record<string, MarketStatus[]> = {
  open: ["closed", "cancelled"],
  closed: ["resolved", "open", "cancelled"],
  resolved: [], // terminal
  cancelled: [], // terminal
};

export function canTransition(from: string, to: MarketStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "open": return "bg-primary/20 text-primary";
    case "closed": return "bg-accent/20 text-accent";
    case "resolved": return "bg-muted text-muted-foreground";
    case "cancelled": return "bg-destructive/20 text-destructive";
    default: return "bg-muted text-muted-foreground";
  }
}

export function isTerminal(status: string): boolean {
  return status === "resolved" || status === "cancelled";
}

export function isTradeableStatus(status: string): boolean {
  return status === "open";
}
