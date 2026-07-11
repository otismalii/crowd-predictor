import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDistanceToNow } from "date-fns";
import type { AdminMarket } from "@/hooks/useMarketsAdmin";

type Entry = { id: string; action: string; details: any; created_at: string; performed_by: string | null };

const MarketAuditDrawer = ({ market, onClose }: { market: AdminMarket | null; onClose: () => void }) => {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    if (!market) return;
    (async () => {
      const { data } = await supabase
        .from("market_audit_log")
        .select("id,action,details,created_at,performed_by")
        .eq("market_id", market.id)
        .order("created_at", { ascending: false })
        .limit(100);
      setEntries((data as any) ?? []);
    })();
  }, [market]);

  return (
    <Sheet open={!!market} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle className="truncate">{market?.title}</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-2">
          {entries.length === 0 && <p className="text-sm text-muted-foreground">No audit entries yet.</p>}
          {entries.map((e) => (
            <div key={e.id} className="border border-border/30 rounded-md p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{e.action}</span>
                <span className="text-muted-foreground">{formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</span>
              </div>
              {e.details && (
                <pre className="mt-2 text-[10px] text-muted-foreground overflow-x-auto whitespace-pre-wrap">
{JSON.stringify(e.details, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MarketAuditDrawer;
