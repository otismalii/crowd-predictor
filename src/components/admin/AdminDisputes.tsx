import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Scale, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Eye, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

interface Dispute {
  id: string;
  market_id: string;
  user_id: string;
  reason: string;
  evidence: string | null;
  status: string;
  admin_response: string | null;
  created_at: string;
  market?: { title: string; status: string };
}

const AdminDisputes = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [responding, setResponding] = useState<string | null>(null);
  const [response, setResponse] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => { fetchDisputes(); }, []);

  const fetchDisputes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("market_disputes")
      .select("*, market:market_id(title, status)")
      .order("created_at", { ascending: false })
      .limit(100) as any;
    setDisputes(data || []);
    setLoading(false);
  };

  const handleAction = async (disputeId: string, action: "confirm" | "revise" | "reject") => {
    if (!response.trim() && action !== "confirm") {
      toast({ title: "Response required", variant: "destructive" });
      return;
    }
    setProcessing(true);
    const status = action === "confirm" ? "confirmed" : action === "revise" ? "revised" : "rejected";
    
    await supabase.from("market_disputes").update({
      status,
      admin_response: response || `Resolution ${status} by admin`,
      resolved_by: user?.id,
      resolved_at: new Date().toISOString(),
    }).eq("id", disputeId);

    // Log to audit
    const dispute = disputes.find(d => d.id === disputeId);
    if (dispute) {
      await supabase.from("market_audit_log").insert({
        market_id: dispute.market_id,
        action: `dispute_${status}`,
        details: { dispute_id: disputeId, response, action },
        performed_by: user!.id,
      });
    }

    toast({ title: `Dispute ${status}` });
    setResponding(null);
    setResponse("");
    setProcessing(false);
    fetchDisputes();
  };

  const filtered = filter === "all" ? disputes : disputes.filter(d => d.status === filter);

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="font-display text-lg flex items-center gap-2">
            <Scale className="h-5 w-5 text-accent" /> Disputes ({filtered.length})
          </span>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchDisputes}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading disputes...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No disputes found</p>
        ) : (
          <div className="space-y-3">
            {filtered.map(d => (
              <motion.div key={d.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border border-border/30 rounded-lg p-4 bg-card/50">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold">{(d as any).market?.title || "Unknown market"}</p>
                    <p className="text-[10px] text-muted-foreground">{format(new Date(d.created_at), "MMM d, yyyy HH:mm")}</p>
                  </div>
                  <Badge variant={d.status === "open" ? "default" : "secondary"} className="text-[10px]">
                    {d.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-2"><strong>Reason:</strong> {d.reason}</p>
                {d.evidence && <p className="text-xs text-muted-foreground mb-2"><strong>Evidence:</strong> {d.evidence}</p>}
                {d.admin_response && <p className="text-xs text-primary"><strong>Response:</strong> {d.admin_response}</p>}

                {d.status === "open" && (
                  <div className="mt-3">
                    {responding === d.id ? (
                      <div className="space-y-2">
                        <Textarea value={response} onChange={e => setResponse(e.target.value)} placeholder="Admin response..." rows={2} />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleAction(d.id, "confirm")} disabled={processing} className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Confirm
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleAction(d.id, "revise")} disabled={processing} className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" /> Revise
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleAction(d.id, "reject")} disabled={processing} className="text-xs">
                            <XCircle className="h-3 w-3 mr-1" /> Reject
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setResponding(null); setResponse(""); }} className="text-xs">Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setResponding(d.id)} className="text-xs">
                        <MessageCircle className="h-3 w-3 mr-1" /> Respond
                      </Button>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminDisputes;
