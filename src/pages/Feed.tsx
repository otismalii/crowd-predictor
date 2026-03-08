import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ThumbsUp, ThumbsDown, LogIn, Zap, Trophy, TrendingUp, Filter, Sparkles } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import MatchCard from "@/components/MatchCard";
import TeamBadge from "@/components/TeamBadge";
import { prefetchTeamBadges } from "@/hooks/useTeamBadge";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import GradientText from "@/components/reactbits/GradientText";
import SplitText from "@/components/reactbits/SplitText";
import Aurora from "@/components/reactbits/Aurora";
import AnimatedCounter from "@/components/reactbits/AnimatedCounter";
import ShimmerButton from "@/components/reactbits/ShimmerButton";

interface Match {
  id: string;
  league: string;
  home_team: string;
  away_team: string;
  kickoff: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
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
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [insights, setInsights] = useState<Record<string, string>>({});
  const [leagueFilter, setLeagueFilter] = useState("");
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [feedFilter, setFeedFilter] = useState<"all" | "following">("all");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"matches" | "predictions">("matches");

  useEffect(() => {
    Promise.all([fetchMatches(), fetchPredictions(), fetchInsights(), fetchFollowing()]).then(() => setLoading(false));

    const channel = supabase
      .channel("feed-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "predictions" }, () => {
        fetchPredictions();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "matches" }, (payload) => {
        setMatches((prev) =>
          prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } as Match : m))
        );
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "matches" }, () => {
        fetchMatches();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (matches.length > 0) {
      const teamNames = [...new Set(matches.flatMap((m) => [m.home_team, m.away_team]))];
      prefetchTeamBadges(teamNames.slice(0, 30));
    }
  }, [matches]);

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

  const fetchInsights = async () => {
    const { data } = await supabase
      .from("ai_insights")
      .select("match_id, ai_summary")
      .order("created_at", { ascending: false });
    if (data) {
      const map: Record<string, string> = {};
      for (const i of data) {
        if (!map[i.match_id]) map[i.match_id] = i.ai_summary;
      }
      setInsights(map);
    }
  };

  const handleVote = async (predictionId: string, voteType: "up" | "down") => {
    if (!user) {
      toast({ title: "Sign in to vote", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("votes").upsert(
      { user_id: user.id, prediction_id: predictionId, vote_type: voteType },
      { onConflict: "user_id,prediction_id" }
    );
    if (error) toast({ title: "Vote failed", description: error.message, variant: "destructive" });
    else toast({ title: voteType === "up" ? "👍 Upvoted" : "👎 Downvoted" });
  };

  const leagues = useMemo(() => [...new Set(matches.map((m) => m.league))], [matches]);
  const filteredMatches = leagueFilter ? matches.filter((m) => m.league === leagueFilter) : matches;
  const liveMatches = matches.filter((m) => m.status === "live");

  const groupedMatches = useMemo(() => {
    const groups: Record<string, Match[]> = {};
    for (const m of filteredMatches) {
      const day = format(new Date(m.kickoff), "yyyy-MM-dd");
      if (!groups[day]) groups[day] = [];
      groups[day].push(m);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredMatches]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero with Aurora background */}
      <div className="relative border-b border-border/30 overflow-hidden">
        <Aurora />
        <div className="relative container py-10 sm:py-14">
          <div className="flex items-center justify-between flex-wrap gap-6">
            <div>
              <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-wider">
                <SplitText text="MATCH " className="text-foreground" splitType="chars" delay={0.04} />
                <GradientText className="font-display text-4xl sm:text-5xl font-bold tracking-wider">
                  CENTER
                </GradientText>
              </h1>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-4 mt-3"
              >
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <AnimatedCounter value={matches.length} fontSize={14} className="font-bold text-primary" /> 
                  <span>matches</span>
                </div>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AnimatedCounter value={leagues.length} fontSize={14} className="font-bold text-accent" />
                  <span>leagues</span>
                </div>
                {liveMatches.length > 0 && (
                  <>
                    <div className="h-4 w-px bg-border" />
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                      </span>
                      <span className="text-primary font-semibold">{liveMatches.length} LIVE</span>
                    </div>
                  </>
                )}
              </motion.div>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="flex gap-3"
            >
              {!user && (
                <ShimmerButton onClick={() => navigate("/auth")}>
                  <LogIn className="h-4 w-4" /> Sign In
                </ShimmerButton>
              )}
              <Button
                onClick={() => navigate("/leaderboard")}
                variant="ghost"
                className="text-accent hover:text-accent font-display tracking-wider"
              >
                <Trophy className="mr-2 h-4 w-4" /> Leaderboard
              </Button>
            </motion.div>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 mt-8 p-1 bg-muted/50 rounded-xl w-fit backdrop-blur-sm border border-border/30">
            {[
              { key: "matches" as const, label: "⚽ Matches", icon: null },
              { key: "predictions" as const, label: "Community Feed", icon: TrendingUp },
            ].map(({ key, label, icon: Icon }) => (
              <motion.button
                key={key}
                onClick={() => setTab(key)}
                className={`relative px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  tab === key ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                whileHover={{ scale: tab === key ? 1 : 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {tab === key && (
                  <motion.div
                    layoutId="feed-tab-bg"
                    className="absolute inset-0 bg-primary rounded-lg neon-glow"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  {Icon && <Icon className="h-4 w-4" />}
                  {label}
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      <div className="container py-6">
        <AnimatePresence mode="wait">
          {tab === "matches" ? (
            <motion.div
              key="matches"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* League filters */}
              {leagues.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none"
                >
                  <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <motion.button
                    onClick={() => setLeagueFilter("")}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                      !leagueFilter ? "border-primary text-primary bg-primary/10 neon-glow" : "border-border text-muted-foreground hover:border-muted-foreground"
                    }`}
                  >
                    All ({matches.length})
                  </motion.button>
                  {leagues.map((l) => (
                    <motion.button
                      key={l}
                      onClick={() => setLeagueFilter(l === leagueFilter ? "" : l)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                        leagueFilter === l ? "border-primary text-primary bg-primary/10 neon-glow" : "border-border text-muted-foreground hover:border-muted-foreground"
                      }`}
                    >
                      {l}
                    </motion.button>
                  ))}
                </motion.div>
              )}

              {/* Match groups by date */}
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-28 w-full rounded-xl" />
                  ))}
                </div>
              ) : groupedMatches.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <Card className="glass-card p-12 text-center">
                    <Zap className="mx-auto mb-4 h-12 w-12 text-primary/30" />
                    <p className="text-lg font-display text-muted-foreground">No matches found</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {leagueFilter ? "Try removing the league filter." : "Matches will appear after the next auto-sync."}
                    </p>
                  </Card>
                </motion.div>
              ) : (
                groupedMatches.map(([day, dayMatches], groupIndex) => (
                  <motion.div
                    key={day}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: groupIndex * 0.08 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <h2 className="font-display text-sm font-bold text-muted-foreground uppercase tracking-widest">
                        {format(new Date(day), "EEEE, MMMM d")}
                      </h2>
                      <div className="flex-1 h-px bg-gradient-to-r from-border/50 to-transparent" />
                      <Badge variant="secondary" className="text-xs">{dayMatches.length} matches</Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                      {dayMatches.map((m, i) => (
                        <motion.div
                          key={m.id}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: groupIndex * 0.08 + i * 0.04 }}
                        >
                          <MatchCard
                            match={m}
                            userId={user?.id || null}
                            insightPreview={insights[m.id] || null}
                            onNavigateAuth={() => navigate("/auth")}
                            onPredictionSubmitted={fetchPredictions}
                          />
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          ) : (
            /* Predictions feed */
            <motion.div
              key="predictions"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="max-w-2xl mx-auto space-y-4"
            >
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full rounded-xl" />
                ))
              ) : predictions.length === 0 ? (
                <Card className="glass-card p-12 text-center">
                  <Zap className="mx-auto mb-4 h-12 w-12 text-primary/30" />
                  <p className="text-lg font-display text-muted-foreground">No predictions yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Be the first — pick a match above and make your call!</p>
                </Card>
              ) : (
                <AnimatePresence mode="popLayout">
                  {predictions.map((p, i) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 20, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <Card className="glass-card hover:border-primary/20 transition-all group">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <Link to={`/profile/${p.user_id}`} className="text-sm font-semibold text-primary hover:underline">
                                  @{p.profiles?.username || "anon"}
                                </Link>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(p.created_at), "MMM d, HH:mm")}
                                </span>
                              </div>
                              {p.matches && (
                                <Link to={`/match/${p.match_id}`} className="group/match block">
                                  <p className="text-xs text-accent font-semibold mb-1">{p.matches.league}</p>
                                  <div className="flex items-center gap-2">
                                    <TeamBadge teamName={p.matches.home_team} size="sm" />
                                    <span className="font-display text-base font-bold group-hover/match:text-primary transition-colors">
                                      {p.matches.home_team} <span className="text-primary">{p.predicted_home_score}</span>
                                      <span className="text-muted-foreground mx-1">-</span>
                                      <span className="text-primary">{p.predicted_away_score}</span> {p.matches.away_team}
                                    </span>
                                    <TeamBadge teamName={p.matches.away_team} size="sm" />
                                  </div>
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
                              <motion.button
                                onClick={() => handleVote(p.id, "up")}
                                whileHover={{ scale: 1.2 }}
                                whileTap={{ scale: 0.85 }}
                                className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                              >
                                <ThumbsUp className="h-4 w-4" />
                              </motion.button>
                              <motion.button
                                onClick={() => handleVote(p.id, "down")}
                                whileHover={{ scale: 1.2 }}
                                whileTap={{ scale: 0.85 }}
                                className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                              >
                                <ThumbsDown className="h-4 w-4" />
                              </motion.button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <Footer />
    </div>
  );
};

export default Feed;
