import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Zap, Globe, Clock, Timer, CheckCircle2 } from "lucide-react";
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
  const [lastSync, setLastSync] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-matches");
      if (error) throw error;
      toast({ title: "Matches synced", description: `Synced ${data?.synced || 0} matches, created ${data?.markets_created || 0} markets.` });
      setLastSync(new Date().toLocaleTimeString());
      onRefresh();
    } catch (e: any) {
      toast({ title: "Sync failed", description: e.message, variant: "destructive" });
    }
    setSyncing(false);
  };

  const leagues = [...new Set(matches.map((m) => m.league))];

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" /> Match Sync
          <Badge variant="outline" className="ml-auto text-xs gap-1 border-primary/50 text-primary">
            <CheckCircle2 className="h-3 w-3" /> Auto
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Timer className="h-4 w-4" /> Automated Sync Active
          </div>
          <p className="text-xs text-muted-foreground">
            Auto-syncs every <strong>30 min</strong> via TheSportsDB — covers <strong>{leagues.length || "11+"} leagues</strong> including Premier League, La Liga, Serie A, Bundesliga, Champions League & more.
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
  );
};

export default AdminAPI;
