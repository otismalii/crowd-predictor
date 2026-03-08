import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Brain, Zap, Globe, Clock, Timer, CheckCircle2 } from "lucide-react";
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
      toast({ title: "✅ Matches synced!", description: `Synced ${data?.synced || 0} matches, generated ${data?.insights_generated || 0} AI insights.` });
      setLastSync(new Date().toLocaleTimeString());
      onRefresh();
    } catch (e: any) {
      toast({ title: "Sync failed", description: e.message, variant: "destructive" });
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

  const handleGenerateAll = async () => {
    const up = matches.filter((m) => m.status === "upcoming");
    if (up.length === 0) {
      toast({ title: "No matches", description: "No upcoming matches to generate insights for." });
      return;
    }
    for (const m of up.slice(0, 5)) {
      await handleInsight(m.id);
    }
  };

  const upcoming = matches.filter((m) => m.status === "upcoming");
  const leagues = [...new Set(matches.map((m) => m.league))];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" /> Match Sync
            <Badge variant="outline" className="ml-auto text-xs gap-1 border-emerald-500/50 text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Auto
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
              <Timer className="h-4 w-4" /> Automated Sync Active
            </div>
            <p className="text-xs text-muted-foreground">
              Auto-syncs every <strong>30 min</strong> via TheSportsDB — covers <strong>{leagues.length || "11+"} leagues</strong> including Premier League, La Liga, Serie A, Bundesliga, Champions League & more. No API key required.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {leagues.slice(0, 8).map((l) => (
              <Badge key={l} variant="secondary" className="text-xs">{l}</Badge>
            ))}
            {leagues.length > 8 && <Badge variant="secondary" className="text-xs">+{leagues.length - 8} more</Badge>}
          </div>

          {lastSync && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> Last manual sync at {lastSync}
            </div>
          )}

          <Button onClick={handleSync} disabled={syncing} className="w-full neon-glow">
            {syncing ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Syncing...</> : <><Zap className="mr-2 h-4 w-4" /> Manual Sync</>}
          </Button>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Brain className="h-5 w-5 text-accent" /> AI Insights
            <span className="ml-auto text-xs font-normal text-muted-foreground">{upcoming.length} upcoming</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Generate Gemini-powered match analysis using community prediction data.
          </p>

          {upcoming.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleGenerateAll} className="w-full border-accent/50 text-accent hover:bg-accent/10 gap-2">
              <Brain className="h-4 w-4" /> Generate All (up to 5)
            </Button>
          )}

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
              <p className="text-sm text-muted-foreground text-center py-6">No upcoming matches. Wait for auto-sync or trigger manually!</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAPI;
