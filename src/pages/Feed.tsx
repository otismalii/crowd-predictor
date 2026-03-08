import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { ThumbsUp, ThumbsDown, Calendar, ArrowRight } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { format } from "date-fns";

interface Match {
  id: string;
  league: string;
  home_team: string;
  away_team: string;
  kickoff: string;
  status: string;
}

interface Prediction {
  id: string;
  user_id: string;
  match_id: string;
  predicted_home_score: number;
  predicted_away_score: number;
  confidence: number;
  analysis: string | null;
  status: string;
  created_at: string;
  profiles: { username: string | null; avatar_url: string | null } | null;
  matches: { home_team: string; away_team: string; league: string; kickoff: string } | null;
}

const Feed = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<string>("");
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [confidence, setConfidence] = useState([3]);
  const [analysis, setAnalysis] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [leagueFilter, setLeagueFilter] = useState("");

  useEffect(() => {
    fetchMatches();
    fetchPredictions();

    const channel = supabase
      .channel("predictions-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "predictions" }, () => {
        fetchPredictions();
        toast({ title: "New prediction!", description: "Someone just made a prediction." });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchMatches = async () => {
    const { data } = await supabase
      .from("matches")
      .select("*")
      .in("status", ["upcoming", "live"])
      .order("kickoff", { ascending: true });
    if (data) setMatches(data as Match[]);
  };

  const fetchPredictions = async () => {
    const { data } = await supabase
      .from("predictions")
      .select("*, profiles(username, avatar_url), matches(home_team, away_team, league, kickoff)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setPredictions(data as unknown as Prediction[]);
  };

  const handleSubmitPrediction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatch || !user) return;
    setSubmitting(true);

    const { error } = await supabase.from("predictions").insert({
      user_id: user.id,
      match_id: selectedMatch,
      predicted_home_score: homeScore,
      predicted_away_score: awayScore,
      confidence: confidence[0],
      analysis: analysis || null,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Prediction submitted!" });
      setAnalysis("");
      setHomeScore(0);
      setAwayScore(0);
      setConfidence([3]);
      setSelectedMatch("");
      fetchPredictions();
    }
    setSubmitting(false);
  };

  const handleVote = async (predictionId: string, voteType: "up" | "down") => {
    if (!user) return;
    const { error } = await supabase.from("votes").upsert(
      { user_id: user.id, prediction_id: predictionId, vote_type: voteType },
      { onConflict: "user_id,prediction_id" }
    );
    if (error) toast({ title: "Vote failed", description: error.message, variant: "destructive" });
  };

  const leagues = [...new Set(matches.map((m) => m.league))];
  const filteredMatches = leagueFilter ? matches.filter((m) => m.league === leagueFilter) : matches;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8">
        <h1 className="mb-8 font-display text-3xl font-bold tracking-wider">
          Prediction <span className="text-primary">Feed</span>
        </h1>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Prediction form */}
          <div className="lg:col-span-1">
            <Card className="glass-card sticky top-20">
              <CardHeader>
                <CardTitle className="font-display text-lg">Make a Prediction</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitPrediction} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Match</Label>
                    <select
                      value={selectedMatch}
                      onChange={(e) => setSelectedMatch(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      required
                    >
                      <option value="">Select a match</option>
                      {filteredMatches.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.home_team} vs {m.away_team} — {m.league}
                        </option>
                      ))}
                    </select>
                  </div>

                  {leagues.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setLeagueFilter("")}
                        className={`text-xs px-3 py-1 rounded-full border ${!leagueFilter ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
                        All
                      </button>
                      {leagues.map((l) => (
                        <button key={l} type="button" onClick={() => setLeagueFilter(l)}
                          className={`text-xs px-3 py-1 rounded-full border ${leagueFilter === l ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Home Score</Label>
                      <Input type="number" min={0} value={homeScore} onChange={(e) => setHomeScore(parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Away Score</Label>
                      <Input type="number" min={0} value={awayScore} onChange={(e) => setAwayScore(parseInt(e.target.value) || 0)} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Confidence: {confidence[0]}/5</Label>
                    <Slider value={confidence} onValueChange={setConfidence} min={1} max={5} step={1} />
                  </div>

                  <div className="space-y-2">
                    <Label>Analysis (optional)</Label>
                    <Textarea value={analysis} onChange={(e) => setAnalysis(e.target.value)} placeholder="Why do you think this?" rows={3} />
                  </div>

                  <Button type="submit" className="w-full neon-glow" disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit Prediction"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Predictions list */}
          <div className="lg:col-span-2 space-y-4">
            {predictions.length === 0 ? (
              <Card className="glass-card p-8 text-center">
                <p className="text-muted-foreground">No predictions yet. Be the first!</p>
              </Card>
            ) : (
              predictions.map((p) => (
                <Card key={p.id} className="glass-card transition-all hover:border-primary/30">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-semibold text-primary">
                            @{p.profiles?.username || "anon"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(p.created_at), "MMM d, HH:mm")}
                          </span>
                        </div>
                        {p.matches && (
                          <Link to={`/match/${p.match_id}`} className="group">
                            <p className="text-sm text-muted-foreground mb-1">{p.matches.league}</p>
                            <p className="font-display text-lg font-bold group-hover:text-primary transition-colors">
                              {p.matches.home_team} {p.predicted_home_score} - {p.predicted_away_score} {p.matches.away_team}
                            </p>
                          </Link>
                        )}
                        <div className="mt-2 flex items-center gap-3">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                            Confidence: {p.confidence}/5
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            p.status === "correct" ? "bg-primary/20 text-primary" :
                            p.status === "incorrect" ? "bg-destructive/20 text-destructive" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {p.status}
                          </span>
                        </div>
                        {p.analysis && <p className="mt-3 text-sm text-muted-foreground">{p.analysis}</p>}
                      </div>
                      <div className="flex flex-col items-center gap-1 ml-4">
                        <button onClick={() => handleVote(p.id, "up")} className="text-muted-foreground hover:text-primary transition-colors">
                          <ThumbsUp className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleVote(p.id, "down")} className="text-muted-foreground hover:text-destructive transition-colors">
                          <ThumbsDown className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Feed;
