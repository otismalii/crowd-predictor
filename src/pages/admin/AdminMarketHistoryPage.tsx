import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader, AdminPageBody, AdminEmptyState } from "@/components/admin/primitives";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const AdminMarketHistoryPage = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("market_audit_log").select("*").order("created_at", { ascending: false }).limit(200);
      setRows(data || []); setLoading(false);
    })();
  }, []);
  return (
    <>
      <AdminPageHeader icon={History} title="Market History" subtitle="Audit trail across every market lifecycle event" />
      <AdminPageBody>
        {loading ? null : rows.length === 0 ? (
          <AdminEmptyState icon={History} title="No market events" description="Market lifecycle events will appear here." />
        ) : (
          <div className="grid gap-2">
            {rows.map((r) => (
              <Card key={r.id} className="p-3 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{r.action}</div>
                  <div className="text-xs text-muted-foreground">market {r.market_id?.slice(0, 8)} · {new Date(r.created_at).toLocaleString()}</div>
                </div>
                <Badge variant="outline">{r.actor_id?.slice(0, 8) || "system"}</Badge>
              </Card>
            ))}
          </div>
        )}
      </AdminPageBody>
    </>
  );
};

export default AdminMarketHistoryPage;
