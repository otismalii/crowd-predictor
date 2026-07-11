import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SEOHead from "@/components/SEOHead";
import AdminDisputes from "@/components/admin/AdminDisputes";
import AdminSourceRegistry from "@/components/admin/AdminSourceRegistry";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Scale, Clock, BarChart3, AlertTriangle, ShieldCheck, Gavel, Undo2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { callAdminAction } from "@/hooks/useMarketsAdmin";

interface ResolutionQueueItem {
  id: string;
  title: string;
  closes_at: string | null;
  status: string;
  total_volume: number;
  source_count: number;
  avg_confidence: number;
}

const AdminResolutionPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [queue, setQueue] = useState<ResolutionQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [overrideMarket, setOverrideMarket] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [resolvingFor, setResolvingFor] = useState<string | null>(null);
  const [resolveOutcomes, setResolveOutcomes] = useState<Record<string, { id: string; label: string }[]>>({});
  const [winningOutcomeId, setWinningOutcomeId] = useState<string>("");
  const [resolveReason, setResolveReason] = useState("");

  useEffect(() => { fetchQueue(); }, []);

  const fetchQueue = async () => {
    setLoading(true);
    const { data: markets } = await supabase
      .from("markets")
      .select("id, title, closes_at, status, total_volume")
      .eq("status", "closed")
      .order("closes_at", { ascending: true })
      .limit(50) as any;

    if (markets) {
      const enriched = await Promise.all(
        markets.map(async (m: any) => {
          const { data: sources } = await supabase
            .from("market_sources")
            .select("confidence")
            .eq("market_id", m.id);
          
          const sourceCount = sources?.length || 0;
          const avgConfidence = sourceCount > 0
            ? Math.round(sources!.reduce((s: number, src: any) => s + (src.confidence || 0), 0) / sourceCount)
            : 0;

          return { ...m, source_count: sourceCount, avg_confidence: avgConfidence };
        })
      );
      setQueue(enriched);
    }
    setLoading(false);
  };

  const handleAdminOverride = async (marketId: string) => {
    if (!overrideReason.trim() || !user) {
      toast({ title: "Reason required", variant: "destructive" });
      return;
    }
    setProcessing(true);

    await supabase.from("market_audit_log").insert({
      market_id: marketId,
      action: "admin_override",
      performed_by: user.id,
      details: { reason: overrideReason, timestamp: new Date().toISOString() },
    });

    toast({ title: "🦅 Override logged", description: "Resolution override recorded in audit trail" });
    setOverrideMarket(null);
    setOverrideReason("");
    setProcessing(false);
  };

  const openResolve = async (marketId: string) => {
    setResolvingFor(marketId);
    setWinningOutcomeId("");
    setResolveReason("");
    if (!resolveOutcomes[marketId]) {
      const { data } = await supabase.from("market_outcomes").select("id,label").eq("market_id", marketId).order("sort_order");
      setResolveOutcomes((prev) => ({ ...prev, [marketId]: (data as any) ?? [] }));
    }
  };

  const submitResolve = async (marketId: string) => {
    if (!winningOutcomeId || !resolveReason.trim()) {
      toast({ title: "Winning outcome and reason required", variant: "destructive" });
      return;
    }
    setProcessing(true);
    try {
      await callAdminAction({ action: "resolve", marketId, winningOutcomeId, reason: resolveReason });
      toast({ title: "🦅 Market resolved", description: "Settlement enqueued" });
      setResolvingFor(null); setWinningOutcomeId(""); setResolveReason("");
      fetchQueue();
    } catch (e: any) {
      toast({ title: "Resolve failed", description: e.message, variant: "destructive" });
    }
    setProcessing(false);
  };

  const submitRefund = async (marketId: string) => {
    const reason = prompt("Refund reason (required, audited):");
    if (!reason?.trim()) return;
    setProcessing(true);
    try {
      await callAdminAction({ action: "refund", marketId, reason });
      toast({ title: "Refund enqueued" });
      fetchQueue();
    } catch (e: any) {
      toast({ title: "Refund failed", description: e.message, variant: "destructive" });
    }
    setProcessing(false);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <SEOHead title="Admin - Resolution" path="/admin/resolution" />
      
      <div className="border-b border-border/30">
        <div className="container py-6">
          <h1 className="font-display text-2xl font-bold tracking-wider">
            <Scale className="inline h-6 w-6 text-primary mr-2" />Resolution <span className="text-primary">Console</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Source verification, dispute management & settlement</p>
        </div>
      </div>
      <div className="container py-6 space-y-8">
        {/* Resolution Queue */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-accent" /> Resolution Queue ({queue.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Loading queue...</p>
            ) : queue.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Scale className="mx-auto mb-2 h-8 w-8 opacity-20" />
                <p className="text-sm">No markets awaiting resolution</p>
              </div>
            ) : (
              <div className="space-y-3">
                {queue.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border border-border/30 rounded-lg p-4 bg-card/50 hover:bg-card transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{item.title}</p>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <BarChart3 className="h-3 w-3" /> {Math.round(item.total_volume).toLocaleString()} KES
                          </span>
                          {item.closes_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Closed {formatDistanceToNow(new Date(item.closes_at), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="outline" className="text-[10px]">
                          {item.source_count} source{item.source_count !== 1 ? "s" : ""}
                        </Badge>
                        <div className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          item.avg_confidence >= 80 ? "bg-primary/20 text-primary" :
                          item.avg_confidence >= 50 ? "bg-accent/20 text-accent" :
                          "bg-destructive/20 text-destructive"
                        }`}>
                          {item.avg_confidence}% conf
                        </div>
                      </div>
                    </div>

                    {item.source_count === 0 && (
                      <div className="flex items-center gap-1.5 text-[11px] text-destructive bg-destructive/5 rounded-md px-2 py-1 mt-2">
                        <AlertTriangle className="h-3 w-3" /> No evidence sources — resolution blocked
                      </div>
                    )}

                    {overrideMarket === item.id ? (
                      <div className="mt-3 space-y-2">
                        <Textarea
                          value={overrideReason}
                          onChange={e => setOverrideReason(e.target.value)}
                          placeholder="Mandatory: Explain the override reason..."
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleAdminOverride(item.id)} disabled={processing} className="text-xs gap-1">
                            <ShieldCheck className="h-3 w-3" /> Confirm Override
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setOverrideMarket(null); setOverrideReason(""); }} className="text-xs">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs gap-1"
                          onClick={() => setOverrideMarket(item.id)}
                        >
                          <ShieldCheck className="h-3 w-3" /> Admin Override
                        </Button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <AdminDisputes />
        <AdminSourceRegistry />
      </div>
      
    </div>
  );
};

export default AdminResolutionPage;