import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type Opts = {
  channel: string;
  table: string;
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  filter?: string;
  onChange: (payload: any) => void;
  enabled?: boolean;
};

/**
 * Wraps Supabase realtime per project rule: unique channel name, removeChannel cleanup.
 */
export const useAdminRealtime = ({ channel, table, event = "*", filter, onChange, enabled = true }: Opts) => {
  useEffect(() => {
    if (!enabled) return;
    const name = `admin:${channel}:${crypto.randomUUID()}`;
    const ch = supabase
      .channel(name)
      .on("postgres_changes" as any, { event, schema: "public", table, filter }, onChange)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, table, event, filter, enabled]);
};
