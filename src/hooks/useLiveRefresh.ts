import { useMemo, useRef, useState } from "react";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";

type Watched = { table: string; filter?: string };

/**
 * Subscribes to one or more tables and returns a counter that increments when
 * anything changes, throttled so a burst of odds or score updates causes a
 * single refetch instead of dozens.
 */
export function useLiveRefresh(channelPrefix: string, tables: Watched[], throttleMs = 4000) {
  const [tick, setTick] = useState(0);
  const lastRef = useRef(0);
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const key = tables.map((t) => `${t.table}:${t.filter ?? ""}`).join("|");

  const subscriptions = useMemo(() => {
    const bump = () => {
      const now = Date.now();
      const elapsed = now - lastRef.current;
      if (elapsed >= throttleMs) {
        lastRef.current = now;
        setTick((t) => t + 1);
        return;
      }
      if (pendingRef.current) return;
      pendingRef.current = setTimeout(() => {
        pendingRef.current = null;
        lastRef.current = Date.now();
        setTick((t) => t + 1);
      }, throttleMs - elapsed);
    };

    return tables.map((t) => ({
      changes: { event: "*" as const, table: t.table, ...(t.filter ? { filter: t.filter } : {}) },
      callback: bump,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, throttleMs]);

  useRealtimeChannel(`${channelPrefix}-${key}`, subscriptions);

  return tick;
}
