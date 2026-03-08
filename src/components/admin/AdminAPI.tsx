import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Brain, Zap, Globe, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Match {
  id: string;
  home_team: string;
  away_team: string;
  league: string;
  status: string;
}

interface AdminAPIProps {
  matches: Match[];
  onRefresh: () => void;
}

const AdminAPI = ({ matches, onRefresh }: AdminAPIProps) => {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-matches");
      if (error) throw error;
      toast({ title: "✅ Matches synced!", description: `Synced ${data?.synced || 0} of ${data?.total || 0} fixtures.` });
      setLastSync(new Date().toLocaleTimeString());
      onRefresh();
    } catch (e: any) {
      toast({ title: "Sync failed", description: e.message || "Check API key in Supabase secrets", variant: "destructive" });
    }
    setSyncing(false);
  };

  const handleInsight = async (matchId: string) => {
    setGenerating(matchId);
    try {
      const { data, error } = await supabase.functions.invoke("generate-insights", { body: { match_id: matchId } });
      if (error) throw error;
      toast({ title: "🧠 AI Insight generated!", description: (data?.insight || "").slice(0, 120) + "..." });
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    }
    setGenerating(null);
  };

  const upcoming = matches.filter((m) => m.status === "upcoming");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" /> Sync Matches
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Fetch today's fixtures from API-Football and upsert into database. Requires <code className="text-primary text-xs">API_FOOTBALL_KEY</code> secret.
          </p>
          {lastSync && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> Last synced at {lastSync}
            </div>
          )}
          <Button onClick={handleSync} disabled={syncing} className="w-full neon-glow">
            {syncing ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Syncing...</> : <><Zap className="mr-2 h-4 w-4" /> Sync Now</>}
          </Button>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Brain className="h-5 w-5 text-accent" /> AI Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Generate AI analysis for upcoming matches using community prediction data.
          </p>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {upcoming.slice(0, 15).map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3 hover:bg-muted/70 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{m.home_team} vs {m.away_team}</p>
                  <p className="text-xs text-muted-foreground">{m.league}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-2 border-accent/50 text-accent hover:bg-accent/10"
                  onClick={() => handleInsight(m.id)}
                  disabled={generating === m.id}
                >
                  {generating === m.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
                </Button>
              </div>
            ))}
            {upcoming.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No upcoming matches. Sync or add one first!</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAPI;
