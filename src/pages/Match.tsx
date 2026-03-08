import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Brain } from "lucide-react";
import { format } from "date-fns";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const Match = () => {
  const { id } = useParams<{ id: string }>();
  const [match, setMatch] = useState<any>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [insight, setInsight] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    supabase.from("matches").select("*").eq("id", id).single().then(({ data }) => setMatch(data));
    supabase.from("predictions").select("*, profiles(username)").eq("match_id", id).order("created_at", { ascending: false }).then(({ data }) => setPredictions(data || []));
    supabase.from("ai_insights").select("*").eq("match_id", id).order("created_at", { ascending: false }).limit(1).single().then(({ data }) => setInsight(data));
  }, [id]);

  if (!match) return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-20 text-center text-muted-foreground">Loading match...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8">
        <Card className="glass-card mb-8">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-accent font-semibold mb-2">{match.league}</p>
            <h1 className="font-display text-4xl font-bold tracking-wider">
              {match.home_team} <span className="text-primary">vs</span> {match.away_team}
            </h1>
            <div className="mt-4 flex items-center justify-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">{format(new Date(match.kickoff), "EEEE, MMM d, yyyy — HH:mm")}</span>
            </div>
            {match.status === "finished" && (
              <p className="mt-4 font-display text-3xl font-bold text-primary">
                {match.home_score} - {match.away_score}
              </p>
            )}
            <span className={`mt-4 inline-block text-xs px-3 py-1 rounded-full ${
              match.status === "live" ? "bg-primary/20 text-primary animate-pulse-neon" :
              match.status === "finished" ? "bg-muted text-muted-foreground" :
              "bg-accent/20 text-accent"
            }`}>
              {match.status.toUpperCase()}
            </span>
          </CardContent>
        </Card>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* AI Insight */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Brain className="h-5 w-5 text-accent" /> AI Insight
              </CardTitle>
            </CardHeader>
            <CardContent>
              {insight ? (
                <div className="space-y-3">
                  <p className="text-sm leading-relaxed text-foreground">{insight.ai_summary}</p>
                  {insight.community_prediction && (
                    <p className="text-xs text-muted-foreground">Community: {insight.community_prediction}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No AI insight available yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Community Predictions */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="font-display text-lg">Community Predictions ({predictions.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-96 overflow-y-auto">
              {predictions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No predictions yet.</p>
              ) : (
                predictions.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                    <div>
                      <span className="text-sm font-semibold text-primary">@{p.profiles?.username || "anon"}</span>
                      <p className="text-sm">
                        {match.home_team} {p.predicted_home_score} - {p.predicted_away_score} {match.away_team}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {p.confidence}/5
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Match;
