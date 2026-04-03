import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface PostgresChangeConfig {
  event: "INSERT" | "UPDATE" | "DELETE" | "*";
  schema?: string;
  table: string;
  filter?: string;
}

interface ChannelSubscription {
  changes: PostgresChangeConfig;
  callback: (payload: any) => void;
}

/**
 * Centralized hook for Supabase realtime subscriptions.
 * Handles unique channel naming, proper cleanup, and reconnection.
 */
export function useRealtimeChannel(
  channelPrefix: string,
  subscriptions: ChannelSubscription[],
  enabled = true
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled || subscriptions.length === 0) return;

    // Unique name prevents reuse collisions on re-renders
    const channelName = `${channelPrefix}-${Date.now()}`;

    let channel = supabase.channel(channelName);

    for (const sub of subscriptions) {
      channel = channel.on(
        "postgres_changes" as any,
        {
          event: sub.changes.event,
          schema: sub.changes.schema || "public",
          table: sub.changes.table,
          ...(sub.changes.filter ? { filter: sub.changes.filter } : {}),
        },
        sub.callback
      );
    }

    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.warn(`[realtime] Channel ${channelPrefix} error, will auto-retry`);
      }
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // Re-subscribe when subscriptions identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelPrefix, enabled]);
}
