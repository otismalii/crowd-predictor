import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollText, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface AuditEntry {
  id: string;
  market_id: string | null;
  action: string;
  details: any;
  performed_by: string;
  created_at: string;
}

const AdminAuditLog = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchEntries(); }, []);

  const fetchEntries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("market_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setEntries(data || []);
    setLoading(false);
  };

  const actionColor = (action: string) => {
    if (action.includes("created")) return "bg-primary/20 text-primary";
    if (action.includes("resolved")) return "bg-accent/20 text-accent";
    if (action.includes("dispute")) return "bg-destructive/20 text-destructive";
    return "bg-muted text-muted-foreground";
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="font-display text-lg flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" /> Audit Log ({entries.length})
          </span>
          <Button variant="outline" size="sm" onClick={fetchEntries}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No audit entries yet</p>
        ) : (
          <div className="divide-y divide-border/30 max-h-[500px] overflow-y-auto">
            {entries.map(e => (
              <div key={e.id} className="py-3 px-2 flex items-center gap-3">
                <Badge className={`text-[10px] ${actionColor(e.action)}`}>{e.action}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground truncate">
                    {JSON.stringify(e.details).slice(0, 100)}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {format(new Date(e.created_at), "MMM d HH:mm")}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminAuditLog;
