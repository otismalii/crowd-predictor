import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/SEOHead";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

interface Run {
  id: string;
  run_at: string;
  user_id: string;
  wallet_balance: number;
  ledger_balance: number;
  drift: number;
  status: "ok" | "drift" | "critical";
}

const AdminReconciliationPage = () => {
  const { user } = useAuth();
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("reconciliation_runs")
      .select("*").order("run_at", { ascending: false }).limit(200);
    setRuns(data as Run[] || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runReconciliation = async () => {
    setRunning(true);
    await supabase.functions.invoke("reconcile-ledger", { body: {} });
    await load();
    setRunning(false);
  };

  const critical = runs.filter(r => r.status === "critical");
  const drift = runs.filter(r => r.status === "drift");
  const ok = runs.filter(r => r.status === "ok").length;

  return (
    <div className="min-h-screen bg-background">
      <Helmet><title>Reconciliation · Pagaza Admin</title></Helmet>
      <SEOHead title="Reconciliation · Pagaza Admin" description="Ledger reconciliation dashboard" />
      
      <main className="container py-8 pb-24 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-wider">Ledger Reconciliation</h1>
            <p className="text-xs text-muted-foreground mt-1">Wallet snapshots vs ledger truth</p>
          </div>
          <Button onClick={runReconciliation} disabled={running} className="neon-glow min-h-[44px]">
            <RefreshCw className={`h-4 w-4 mr-2 ${running ? "animate-spin" : ""}`} />
            {running ? "Running..." : "Run now"}
          </Button>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Critical drift</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-display font-bold text-destructive">{critical.length}</p></CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Minor drift</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-display font-bold text-accent">{drift.length}</p></CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Healthy</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-display font-bold text-primary">{ok}</p></CardContent>
            </Card>
          </motion.div>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm font-display tracking-wider">Recent runs</CardTitle></CardHeader>
          <CardContent>
            {loading ? <p className="text-xs text-muted-foreground">Loading…</p> : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {runs.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30 text-xs">
                    <div className="flex items-center gap-3">
                      {r.status === "ok" ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
                      <code className="text-muted-foreground">{r.user_id.slice(0, 8)}…</code>
                      <span>{new Date(r.run_at).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums">wallet {Number(r.wallet_balance).toFixed(2)}</span>
                      <span className="tabular-nums">ledger {Number(r.ledger_balance).toFixed(2)}</span>
                      <Badge variant={r.status === "ok" ? "secondary" : "destructive"} className="tabular-nums">
                        Δ {Number(r.drift).toFixed(2)}
                      </Badge>
                    </div>
                  </div>
                ))}
                {runs.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No runs yet — click "Run now" to start.</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      
    </div>
  );
};

export default AdminReconciliationPage;
