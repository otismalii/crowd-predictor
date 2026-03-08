import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ThumbsUp, ThumbsDown, LogIn, Zap } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

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

const PredictionSkeleton = () => (
  <Card className="glass-card">
    <CardContent className="p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-5 w-3/4" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </CardContent>
  </Card>
);

const Feed = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<string>("");
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [confidence, setConfidence] = useState([3]);
  const [analysis, setAnalysis] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [leagueFilter, setLeagueFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchMatches(), fetchPredictions()]).then(() => setLoading(false));

    const channel = supabase
      .channel("predictions-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "predictions" }, () => {
        fetchPredictions();
        toast({ title: "⚡ New prediction!", description: "Someone just dropped a prediction." });
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
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!selectedMatch) return;
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
      toast({ title: "🎯 Prediction submitted!" });
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
    if (!user) {
      toast({ title: "Sign in to vote", description: "Create an account to interact.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("votes").upsert(
      { user_id: user.id, prediction_id: predictionId, vote_type: voteType },
      { onConflict: "user_id,prediction_id" }
    );
    if (error) toast({ title: "Vote failed", description: error.message, variant: "destructive" });
    else toast({ title: voteType === "up" ? "👍 Upvoted" : "👎 Downvoted" });
  };

  const leagues = [...new Set(matches.map((m) => m.league))];
  const filteredMatches = leagueFilter ? matches.filter((m) => m.league === leagueFilter) : matches;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="font-display text-3xl font-bold tracking-wider">
            <Zap className="inline-block mr-2 h-7 w-7 text-primary" />
            Prediction <span className="text-primary">Feed</span>
          </h1>
          {!user && (
            <Button onClick={() => navigate("/auth")} variant="outline" className="border-primary/50 text-primary hover:bg-primary/10">
              <LogIn className="mr-2 h-4 w-4" /> Sign In to Predict
            </Button>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Prediction form */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <Card className="glass-card sticky top-20">
              <CardHeader>
                <CardTitle className="font-display text-lg">
                  {user ? "Make a Prediction" : "🔒 Sign In to Predict"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!user ? (
                  <div className="space-y-4 text-center py-4">
                    <p className="text-sm text-muted-foreground">Create an account to post predictions and vote.</p>
                    <Button onClick={() => navigate("/auth")} className="neon-glow w-full">
                      <LogIn className="mr-2 h-4 w-4" /> Get Started
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitPrediction} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Match</Label>
                      <select
                        value={selectedMatch}
                        onChange={(e) => setSelectedMatch(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                          className={`text-xs px-3 py-1 rounded-full border transition-all ${!leagueFilter ? "border-primary text-primary bg-primary/10 neon-glow" : "border-border text-muted-foreground hover:border-muted-foreground"}`}>
                          All
                        </button>
                        {leagues.map((l) => (
                          <button key={l} type="button" onClick={() => setLeagueFilter(l)}
                            className={`text-xs px-3 py-1 rounded-full border transition-all ${leagueFilter === l ? "border-primary text-primary bg-primary/10 neon-glow" : "border-border text-muted-foreground hover:border-muted-foreground"}`}>
                            {l}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Home</Label>
                        <Input type="number" min={0} value={homeScore} onChange={(e) => setHomeScore(parseInt(e.target.value) || 0)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Away</Label>
                        <Input type="number" min={0} value={awayScore} onChange={(e) => setAwayScore(parseInt(e.target.value) || 0)} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Confidence: <span className="text-primary font-bold">{confidence[0]}/5</span></Label>
                      <Slider value={confidence} onValueChange={setConfidence} min={1} max={5} step={1} />
                    </div>

                    <div className="space-y-2">
                      <Label>Analysis (optional)</Label>
                      <Textarea value={analysis} onChange={(e) => setAnalysis(e.target.value)} placeholder="Why do you think this?" rows={3} />
                    </div>

                    <Button type="submit" className="w-full neon-glow" disabled={submitting}>
                      {submitting ? "Submitting..." : "⚡ Submit Prediction"}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Predictions list */}
          <div className="lg:col-span-2 space-y-4 order-1 lg:order-2">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <PredictionSkeleton key={i} />)
            ) : predictions.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Card className="glass-card p-12 text-center">
                  <Zap className="mx-auto mb-4 h-12 w-12 text-primary/30" />
                  <p className="text-lg font-display text-muted-foreground">No predictions yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Be the first to make a prediction!</p>
                </Card>
              </motion.div>
            ) : (
              <AnimatePresence mode="popLayout">
                {predictions.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <Card className="glass-card transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_15px_hsl(120_100%_55%/0.1)]">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Link to={`/profile/${p.user_id}`} className="text-sm font-semibold text-primary hover:underline">
                                @{p.profiles?.username || "anon"}
                              </Link>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(p.created_at), "MMM d, HH:mm")}
                              </span>
                            </div>
                            {p.matches && (
                              <Link to={`/match/${p.match_id}`} className="group block">
                                <p className="text-xs text-accent font-semibold mb-1">{p.matches.league}</p>
                                <p className="font-display text-lg font-bold group-hover:text-primary transition-colors">
                                  {p.matches.home_team} <span className="text-primary">{p.predicted_home_score}</span> - <span className="text-primary">{p.predicted_away_score}</span> {p.matches.away_team}
                                </p>
                              </Link>
                            )}
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                🎯 {p.confidence}/5
                              </span>
                              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                                p.status === "correct" ? "bg-primary/20 text-primary" :
                                p.status === "incorrect" ? "bg-destructive/20 text-destructive" :
                                "bg-muted text-muted-foreground"
                              }`}>
                                {p.status}
                              </span>
                            </div>
                            {p.analysis && (
                              <p className="mt-3 text-sm text-muted-foreground leading-relaxed border-l-2 border-primary/20 pl-3">
                                {p.analysis}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-center gap-1.5 ml-4">
                            <button
                              onClick={() => handleVote(p.id, "up")}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                            >
                              <ThumbsUp className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleVote(p.id, "down")}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                            >
                              <ThumbsDown className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Feed;
