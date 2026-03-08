import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Trash2, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface Prediction {
  id: string;
  user_id: string;
  match_id: string;
  predicted_home_score: number;
  predicted_away_score: number;
  confidence: number;
  status: string;
  analysis: string | null;
  created_at: string;
  profiles: { username: string | null } | null;
  matches: { home_team: string; away_team: string; league: string } | null;
}

interface AdminPredictionsProps {
  predictions: Prediction[];
  onRefresh: () => void;
}

const AdminPredictions = ({ predictions, onRefresh }: AdminPredictionsProps) => {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = statusFilter === "all" ? predictions : predictions.filter((p) => p.status === statusFilter);

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase.from("predictions").update({ status: newStatus as any }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: `Prediction marked as ${newStatus}` }); onRefresh(); }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("predictions").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "🗑️ Prediction deleted" }); onRefresh(); }
  };

  const statusColor = (s: string) => {
    if (s === "correct") return "bg-primary/20 text-primary";
    if (s === "incorrect") return "bg-destructive/20 text-destructive";
    return "bg-muted text-muted-foreground";
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-display text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" /> Predictions ({filtered.length})
          </span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="correct">Correct</SelectItem>
              <SelectItem value="incorrect">Incorrect</SelectItem>
            </SelectContent>
          </Select>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border/50 max-h-[500px] overflow-y-auto">
          {filtered.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              className="flex items-center justify-between py-3 px-2 hover:bg-muted/20 rounded-lg transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-primary">@{p.profiles?.username || "anon"}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusColor(p.status)}`}>{p.status}</span>
                  <span className="text-xs text-muted-foreground">conf: {p.confidence}/5</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {p.matches?.home_team} {p.predicted_home_score}-{p.predicted_away_score} {p.matches?.away_team}
                  <span className="ml-1 opacity-60">• {p.matches?.league}</span>
                </p>
                {p.analysis && (
                  <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-1 italic">"{p.analysis}"</p>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {p.status === "pending" && (
                  <>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-primary hover:text-primary" onClick={() => handleStatusChange(p.id, "correct")}>
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleStatusChange(p.id, "incorrect")}>
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(p.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No predictions found.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminPredictions;
