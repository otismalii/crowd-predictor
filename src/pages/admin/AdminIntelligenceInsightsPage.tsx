import { useEffect, useState } from "react";
import { Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader, AdminPageBody, AdminEmptyState } from "@/components/admin/primitives";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Run = {
  id: string;
  pipeline_stage: string;
  action: string;
  model: string | null;
  latency_ms: number | null;
  status: string;
  error: string | null;
  created_at: string;
};

const AdminIntelligenceInsightsPage = () => {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("oracle_runs")
        .select("id, pipeline_stage, action, model, latency_ms, status, error, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      setRuns((data as any) ?? []);
      setLoading(false);
    })();
  }, []);

  const avgLatency = runs.length
    ? Math.round(runs.reduce((a, r) => a + (r.latency_ms ?? 0), 0) / runs.length)
    : 0;
  const errorRate = runs.length
    ? Math.round((runs.filter((r) => r.status !== "success").length / runs.length) * 100)
    : 0;

  return (
    <>
      <AdminPageHeader icon={Brain} title="LOGIK Insights" subtitle="Oracle run log, calibration metrics, and confidence drift" />
      <AdminPageBody>
        {loading ? null : runs.length === 0 ? (
          <AdminEmptyState icon={Brain} title="No Oracle activity yet" description="Trigger detection from the Oracle Suggestions page to see runs here." />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-4"><div className="text-xs text-muted-foreground">Runs (last 100)</div><div className="text-2xl font-bold">{runs.length}</div></Card>
              <Card className="p-4"><div className="text-xs text-muted-foreground">Avg latency</div><div className="text-2xl font-bold">{avgLatency} ms</div></Card>
              <Card className="p-4"><div className="text-xs text-muted-foreground">Error rate</div><div className="text-2xl font-bold">{errorRate}%</div></Card>
            </div>
            <div className="grid gap-2">
              {runs.map((r) => (
                <Card key={r.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-sm truncate">{r.pipeline_stage} / {r.action}</div>
                    <div className="text-xs text-muted-foreground">{r.model} · {new Date(r.created_at).toLocaleString()}</div>
                    {r.error && <div className="text-xs text-destructive mt-1 truncate">{r.error}</div>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline">{r.latency_ms ?? 0} ms</Badge>
                    <Badge variant={r.status === "success" ? "default" : "destructive"}>{r.status}</Badge>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </AdminPageBody>
    </>
  );
};

export default AdminIntelligenceInsightsPage;
