import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { scanForFraudAlerts, type FraudAlert } from "@/services/fraudService";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldAlert, RefreshCw, AlertTriangle, AlertCircle,
  Ban, Clock, Eye, Flag, XCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

const severityConfig: Record<string, { color: string; icon: typeof AlertCircle; bg: string }> = {
  critical: { color: "text-destructive", icon: Ban, bg: "bg-destructive/10" },
  high: { color: "text-destructive", icon: AlertTriangle, bg: "bg-destructive/5" },
  medium: { color: "text-accent", icon: AlertCircle, bg: "bg-accent/5" },
  low: { color: "text-muted-foreground", icon: Eye, bg: "bg-muted/50" },
};

const typeLabels: Record<string, string> = {
  duplicate_mpesa: "Duplicate M-Pesa Receipt",
  rapid_submission: "Rapid Submission",
  suspicious_amount: "Suspicious Amount",
  same_phone_multi_user: "Same Phone, Multiple Users",
  failed_deposit_spam: "Failed Deposit Spam",
  manual_flag: "Manual Flag",
};

const AdminFraudPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => { runScan(); }, []);

  const runScan = async () => {
    setLoading(true);
    const { data } = await scanForFraudAlerts();
    setAlerts(data);
    setLoading(false);
  };

  const handleFlagUser = async (alert: FraudAlert) => {
    if (!user) return;
    setActionLoading(alert.id);
    await supabase.from("market_audit_log").insert({
      action: "user_flagged",
      performed_by: user.id,
      details: {
        flagged_user_id: alert.user_id,
        username: alert.username,
        reason: `Fraud alert: ${alert.description}`,
        alert_type: alert.type,
        severity: alert.severity,
      },
    });
    toast({ title: "🚩 User flagged", description: `@${alert.username || alert.user_id.slice(0, 8)} flagged in audit log` });
    setActionLoading(null);
  };

  const handleBlockTransaction = async (alert: FraudAlert) => {
    if (!user || !alert.metadata?.transaction_id) return;
    setActionLoading(alert.id);
    
    const txId = alert.metadata.transaction_id || (alert.metadata.transaction_ids?.[0]);
    if (txId) {
      await supabase.from("transactions").update({
        status: "failed",
        description: `[BLOCKED] Fraud: ${alert.description}`,
        updated_at: new Date().toISOString(),
      }).eq("id", txId);

      await supabase.from("market_audit_log").insert({
        action: "transaction_blocked",
        performed_by: user.id,
        details: {
          transaction_id: txId,
          reason: alert.description,
          alert_type: alert.type,
        },
      });

      toast({ title: "🚫 Transaction blocked" });
    }
    setActionLoading(null);
  };

  const filtered = filterSeverity === "all" ? alerts : alerts.filter(a => a.severity === filterSeverity);
  const criticalCount = alerts.filter(a => a.severity === "critical").length;
  const highCount = alerts.filter(a => a.severity === "high").length;

  return (
    <div className="min-h-screen bg-background pb-20">
      <SEOHead title="Admin - Fraud Detection" path="/admin/fraud" />
      
      <div className="border-b border-border/30">
        <div className="container py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-destructive/10">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-wider">Fraud <span className="text-destructive">Detection</span></h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automated anomaly scanning · {alerts.length} alert{alerts.length !== 1 ? "s" : ""} found
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={runScan} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Re-scan
          </Button>
        </div>
      </div>
      <div className="container py-6 space-y-6">
        <div className="flex flex-wrap gap-3">
          {criticalCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
              <Ban className="h-4 w-4 text-destructive" />
              <span className="text-xs font-bold text-destructive">{criticalCount} Critical</span>
            </div>
          )}
          {highCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/5 border border-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-xs font-bold text-destructive">{highCount} High</span>
            </div>
          )}
          {alerts.length === 0 && !loading && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
              <span className="text-xs font-bold text-primary">✅ No fraud alerts detected</span>
            </div>
          )}
        </div>
        <div className="flex gap-0.5 p-0.5 bg-muted/50 rounded-xl border border-border/30 w-fit">
          {["all", "critical", "high", "medium", "low"].map(sev => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize min-h-[44px] ${
                filterSeverity === sev ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {filterSeverity === sev && (
                <motion.div layoutId="fraud-filter" className="absolute inset-0 bg-primary rounded-lg" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
              )}
              <span className="relative z-10">{sev} {sev !== "all" && `(${alerts.filter(a => a.severity === sev).length})`}</span>
            </button>
          ))}
        </div>
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-muted-foreground/20" />
            <p className="text-muted-foreground font-display text-lg">No alerts match this filter</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((alert, i) => {
              const config = severityConfig[alert.severity] || severityConfig.low;
              const Icon = config.icon;
              return (
                <motion.div key={alert.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <div className={`rounded-xl border border-border/30 p-4 ${config.bg} transition-all hover:shadow-sm`}>
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${config.bg}`}>
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            alert.severity === "critical" ? "bg-destructive/20 text-destructive" :
                            alert.severity === "high" ? "bg-destructive/10 text-destructive" :
                            alert.severity === "medium" ? "bg-accent/20 text-accent" :
                            "bg-muted text-muted-foreground"
                          }`}>{alert.severity}</span>
                          <Badge variant="outline" className="text-[10px]">{typeLabels[alert.type] || alert.type}</Badge>
                        </div>
                        <p className="text-sm font-medium text-foreground">{alert.description}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                          <span>User: {alert.username || alert.user_id.slice(0, 8)}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        {/* Action buttons */}
                        <div className="flex items-center gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 gap-1"
                            disabled={actionLoading === alert.id}
                            onClick={() => handleFlagUser(alert)}
                          >
                            <Flag className="h-3 w-3" /> Flag User
                          </Button>
                          {(alert.metadata?.transaction_id || alert.metadata?.transaction_ids) && (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="text-xs h-7 gap-1"
                              disabled={actionLoading === alert.id}
                              onClick={() => handleBlockTransaction(alert)}
                            >
                              <XCircle className="h-3 w-3" /> Block Tx
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
      
    </div>
  );
};

export default AdminFraudPage;