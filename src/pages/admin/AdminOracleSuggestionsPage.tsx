import { useEffect, useState } from "react";
import { Sparkles, RefreshCw, Check, X, Gauge } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader, AdminPageBody, AdminEmptyState } from "@/components/admin/primitives";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Suggestion = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  domain: string | null;
  status: string;
  quality_score: number | null;
  quality_breakdown: any;
  risk_flags: any;
  source_evidence: any;
  created_at: string;
};

const AdminOracleSuggestionsPage = () => {
  const [rows, setRows] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("market_suggestions")
      .select("id, title, description, category, domain, status, quality_score, quality_breakdown, risk_flags, source_evidence, created_at")
      .in("status", ["pending", "needs_revision"])
      .order("quality_score", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(100);
    setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runOracle = async (action: string, payload: any) => {
    const { data, error } = await supabase.functions.invoke("logik-oracle", { body: { action, payload } });
    if (error) { toast.error(error.message); return null; }
    return data;
  };

  const score = async (id: string) => {
    setBusy(id);
    const r = await runOracle("score_quality", { suggestion_id: id });
    if (r?.ok) toast.success(`Scored: ${r.output?.score ?? "?"}`);
    await load();
    setBusy(null);
  };

  const approve = async (s: Suggestion) => {
    setBusy(s.id);
    // Promote to markets table as draft (humans publish from Creation Queue)
    const outcomes = Array.isArray((s as any).outcomes) ? (s as any).outcomes : [];
    const { data: market, error } = await supabase.from("markets").insert({
      title: s.title,
      description: s.description,
      category: s.category,
      status: "draft",
      created_by: (await supabase.auth.getUser()).data.user?.id,
    } as any).select("id").single();
    if (error) { toast.error(error.message); setBusy(null); return; }
    if (outcomes.length && market) {
      await supabase.from("market_outcomes").insert(
        outcomes.map((o: any) => ({ market_id: market.id, label: o.label }))
      );
    }
    await supabase.from("market_suggestions").update({ status: "approved" }).eq("id", s.id);
    toast.success("Promoted to draft market");
    await load();
    setBusy(null);
  };

  const reject = async (id: string) => {
    setBusy(id);
    await supabase.from("market_suggestions").update({ status: "rejected" }).eq("id", id);
    await load();
    setBusy(null);
  };

  const triggerDetection = async () => {
    setBusy("detect");
    const r = await runOracle("detect_events", {});
    if (r?.ok) {
      const events = r.output?.events ?? [];
      toast.success(`Detected ${events.length} candidate events`);
      // Auto-suggest for each
      for (const ev of events) await runOracle("suggest_markets", { event: ev });
      await load();
    }
    setBusy(null);
  };

  return (
    <>
      <AdminPageHeader
        icon={Sparkles}
        title="Oracle Suggestions"
        subtitle="LOGIK-generated drafts. Humans approve before any market is published."
        actions={
          <Button onClick={triggerDetection} disabled={busy === "detect"} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${busy === "detect" ? "animate-spin" : ""}`} />
            Run detection
          </Button>
        }
      />
      <AdminPageBody>
        {loading ? null : rows.length === 0 ? (
          <AdminEmptyState icon={Sparkles} title="No suggestions yet" description="Run detection to have LOGIK propose market drafts from recent ingestion events." />
        ) : (
          <div className="grid gap-3">
            {rows.map((s) => (
              <Card key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{s.title}</div>
                    {s.description && <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{s.description}</div>}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {s.domain && <Badge variant="outline">{s.domain}</Badge>}
                      {s.category && <Badge variant="outline">{s.category}</Badge>}
                      <Badge variant={s.status === "needs_revision" ? "destructive" : "secondary"}>{s.status}</Badge>
                      {s.quality_score != null && (
                        <Badge variant={s.quality_score >= 85 ? "default" : "destructive"}>
                          <Gauge className="h-3 w-3 mr-1" />Q {s.quality_score}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => score(s.id)} disabled={busy === s.id}>
                      <Gauge className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="default" onClick={() => approve(s)} disabled={busy === s.id || (s.quality_score ?? 0) < 85}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => reject(s.id)} disabled={busy === s.id}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </AdminPageBody>
    </>
  );
};

export default AdminOracleSuggestionsPage;
