import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Inbox, CheckCircle2, XCircle, RefreshCw, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface Suggestion {
  id: string;
  title: string;
  category: string;
  description: string | null;
  suggested_outcomes: any;
  confidence_score: number;
  status: string;
  created_at: string;
  source_data: any;
}

const AdminIngestion = () => {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchSuggestions(); }, []);

  const fetchSuggestions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("market_suggestions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setSuggestions(data || []);
    setLoading(false);
  };

  const handleAction = async (id: string, action: "approved" | "rejected") => {
    await supabase.from("market_suggestions").update({ status: action }).eq("id", id);
    toast({ title: `Suggestion ${action}` });
    fetchSuggestions();
  };

  const pending = suggestions.filter(s => s.status === "pending");

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="font-display text-lg flex items-center gap-2">
            <Inbox className="h-5 w-5 text-accent" /> Market Suggestions ({pending.length} pending)
          </span>
          <Button variant="outline" size="sm" onClick={fetchSuggestions}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No suggestions yet. Configure sources and run ingestion.</p>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {suggestions.map(s => (
              <div key={s.id} className="border border-border/30 rounded-lg p-4 bg-card/50">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold">{s.title}</p>
                    <p className="text-[10px] text-muted-foreground">{s.category} • Confidence: {s.confidence_score}%</p>
                  </div>
                  <Badge variant={s.status === "pending" ? "default" : "secondary"} className="text-[10px]">{s.status}</Badge>
                </div>
                {s.description && <p className="text-xs text-muted-foreground mb-2">{s.description}</p>}
                {s.status === "pending" && (
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={() => handleAction(s.id, "approved")} className="text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleAction(s.id, "rejected")} className="text-xs">
                      <XCircle className="h-3 w-3 mr-1" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminIngestion;
