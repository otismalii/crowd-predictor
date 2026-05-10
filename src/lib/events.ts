import { supabase } from "@/integrations/supabase/client";

export type EventType =
  | "market.created" | "market.updated" | "market.resolved" | "market.paused"
  | "trade.placed" | "trade.failed"
  | "price.updated" | "liquidity.changed"
  | "deposit.requested" | "deposit.completed" | "deposit.failed"
  | "withdraw.requested" | "withdraw.approved" | "withdraw.completed" | "withdraw.failed"
  | "risk.flagged" | "reconciliation.completed"
  | "intel.trend.updated" | "fee.collected";

export interface AppEvent {
  id: string;
  event_type: EventType | string;
  aggregate_type: string;
  aggregate_id: string | null;
  actor_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

/** Read recent events for an aggregate (e.g. a market) — admin-only via RLS. */
export async function readEvents(opts: {
  aggregateType?: string;
  aggregateId?: string;
  eventType?: string;
  limit?: number;
}): Promise<AppEvent[]> {
  let q = supabase.from("event_log").select("*").order("created_at", { ascending: false }).limit(opts.limit ?? 50);
  if (opts.aggregateType) q = q.eq("aggregate_type", opts.aggregateType);
  if (opts.aggregateId) q = q.eq("aggregate_id", opts.aggregateId);
  if (opts.eventType) q = q.eq("event_type", opts.eventType);
  const { data, error } = await q;
  if (error) {
    console.warn("[events] read failed:", error.message);
    return [];
  }
  return (data as AppEvent[]) || [];
}
