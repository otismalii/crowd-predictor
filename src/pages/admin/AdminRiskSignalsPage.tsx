import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader, AdminPageBody, AdminEmptyState } from "@/components/admin/primitives";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const AdminRiskSignalsPage = () => {
  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("risk_signals").select("*").order("created_at", { ascending: false }).limit(100);
      setSignals(data || []); setLoading(false);
    })();
  }, []);
  return (
    <>
      <AdminPageHeader icon={ShieldAlert} title="Risk Signals" subtitle="Automated and Oracle-detected risk events" />
      <AdminPageBody>
        {loading ? null : signals.length === 0 ? (
          <AdminEmptyState icon={ShieldAlert} title="No risk signals" description="System is clean." />
        ) : (
          <div className="grid gap-2">
            {signals.map((s) => (
              <Card key={s.id} className="p-3 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{s.signal_type}</div>
                  <div className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</div>
                </div>
                <Badge variant={s.severity === "high" ? "destructive" : "secondary"}>{s.severity}</Badge>
              </Card>
            ))}
          </div>
        )}
      </AdminPageBody>
    </>
  );
};

export default AdminRiskSignalsPage;
