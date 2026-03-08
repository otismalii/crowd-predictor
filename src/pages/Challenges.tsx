import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Swords, Check, X, Trophy, Clock, Percent } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import GradientText from "@/components/reactbits/GradientText";
import SplitText from "@/components/reactbits/SplitText";
import Aurora from "@/components/reactbits/Aurora";
import TeamBadge from "@/components/TeamBadge";
import CreateBetDialog from "@/components/CreateBetDialog";
import { Link } from "react-router-dom";

interface Bet {
  id: string;
  match_id: string;
  challenger_id: string;
  opponent_id: string;
  challenger_prediction_home: number;
  challenger_prediction_away: number;
  opponent_prediction_home: number | null;
  opponent_prediction_away: number | null;
  stake_amount: number;
  house_cut_percent: number;
  status: string;
  winner_id: string | null;
  created_at: string;
  resolved_at: string | null;
  matches?: { home_team: string; away_team: string; league: string; kickoff: string };
  challenger?: { username: string | null; avatar_url: string | null };
  opponent?: { username: string | null; avatar_url: string | null };
}

const Challenges = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "active" | "resolved">("pending");
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseHome, setResponseHome] = useState(0);
  const [responseAway, setResponseAway] = useState(0);

  useEffect(() => {
    if (!user) return;
    fetchBets();
  }, [user]);

  const fetchBets = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("p2p_bets")
      .select("*, matches(home_team, away_team, league, kickoff)")
      .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
      .order("created_at", { ascending: false }) as any;

    if (data) {
      // Fetch profiles for challengers and opponents
      const userIds = [...new Set(data.flatMap((b: any) => [b.challenger_id, b.opponent_id]))];
      const { data: profiles } = await supabase
        .from("profiles").select("id, username, avatar_url").in("id", userIds);
      
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      const enriched = data.map((b: any) => ({
        ...b,
        challenger: profileMap.get(b.challenger_id) || null,
        opponent: profileMap.get(b.opponent_id) || null,
      }));
      setBets(enriched);
    }
    setLoading(false);
  };

  const handleAccept = async (bet: Bet) => {
    if (!user) return;
    const { error } = await supabase
      .from("p2p_bets")
      .update({
        status: "accepted",
        opponent_prediction_home: responseHome,
        opponent_prediction_away: responseAway,
      } as any)
      .eq("id", bet.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Challenge accepted!" });
      await supabase.from("notifications").insert({
        user_id: bet.challenger_id,
        type: "bet_accepted",
        title: "⚔️ Challenge Accepted!",
        message: `Your bet on ${bet.matches?.home_team} vs ${bet.matches?.away_team} was accepted!`,
        link: "/challenges",
      });
      setRespondingId(null);
      fetchBets();
    }
  };

  const handleDecline = async (bet: Bet) => {
    const { error } = await supabase
      .from("p2p_bets")
      .update({ status: "declined" } as any)
      .eq("id", bet.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Challenge declined" });
      fetchBets();
    }
  };

  const pendingBets = bets.filter(b => b.status === "pending");
  const activeBets = bets.filter(b => b.status === "accepted");
  const resolvedBets = bets.filter(b => ["resolved", "declined", "cancelled"].includes(b.status));

  const currentBets = tab === "pending" ? pendingBets : tab === "active" ? activeBets : resolvedBets;

  const getStatusColor = (bet: Bet) => {
    if (bet.status === "resolved" && bet.winner_id === user?.id) return "rgba(120, 255, 120, 0.15)";
    if (bet.status === "resolved" && bet.winner_id && bet.winner_id !== user?.id) return "rgba(255, 80, 80, 0.1)";
    if (bet.status === "accepted") return "rgba(120, 255, 120, 0.1)";
    return "rgba(120, 255, 120, 0.05)";
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="relative border-b border-border/30 overflow-hidden">
        <Aurora />
        <div className="relative container py-10 sm:py-14">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-wider">
                <SplitText text="P2P " className="text-foreground" splitType="chars" delay={0.04} />
                <GradientText className="font-display text-4xl sm:text-5xl font-bold tracking-wider">
                  CHALLENGES
                </GradientText>
              </h1>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-sm text-muted-foreground mt-2 flex items-center gap-2"
              >
                <Swords className="h-4 w-4 text-accent" />
                Challenge friends, stake points, {10}% goes to the house
              </motion.p>
            </div>
            {user && <CreateBetDialog />}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-8 p-1 bg-muted/50 rounded-xl w-fit backdrop-blur-sm border border-border/30">
            {[
              { key: "pending" as const, label: `Pending (${pendingBets.length})` },
              { key: "active" as const, label: `Active (${activeBets.length})` },
              { key: "resolved" as const, label: `History (${resolvedBets.length})` },
            ].map(({ key, label }) => (
              <motion.button
                key={key}
                onClick={() => setTab(key)}
                className={`relative px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  tab === key ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                whileTap={{ scale: 0.98 }}
              >
                {tab === key && (
                  <motion.div
                    layoutId="challenge-tab-bg"
                    className="absolute inset-0 bg-primary rounded-lg neon-glow"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      <div className="container py-6 max-w-2xl">
        {!user ? (
          <SpotlightCard className="p-12 text-center" spotlightColor="rgba(120, 255, 120, 0.08)">
            <Swords className="mx-auto mb-3 h-10 w-10 text-accent/30" />
            <p className="text-muted-foreground font-display">Sign in to challenge others</p>
            <Link to="/auth">
              <Button className="mt-4 neon-glow">Sign In</Button>
            </Link>
          </SpotlightCard>
        ) : loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : currentBets.length === 0 ? (
          <SpotlightCard className="p-12 text-center" spotlightColor="rgba(120, 255, 120, 0.08)">
            <Swords className="mx-auto mb-3 h-10 w-10 text-accent/30" />
            <p className="text-muted-foreground font-display">
              {tab === "pending" ? "No pending challenges" : tab === "active" ? "No active bets" : "No history yet"}
            </p>
          </SpotlightCard>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-3"
            >
              {currentBets.map((bet, i) => {
                const isChallenger = bet.challenger_id === user.id;
                const otherUser = isChallenger ? bet.opponent : bet.challenger;
                const winnerPayout = Math.round(bet.stake_amount * 2 * (1 - bet.house_cut_percent / 100));

                return (
                  <motion.div
                    key={bet.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <SpotlightCard spotlightColor={getStatusColor(bet)} className="overflow-hidden">
                      <CardContent className="p-4 space-y-3">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-accent uppercase tracking-wider">
                              {bet.matches?.league}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {bet.stake_amount} pts · Winner: {winnerPayout} pts
                            </span>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            bet.status === "pending" ? "bg-accent/20 text-accent" :
                            bet.status === "accepted" ? "bg-primary/20 text-primary" :
                            bet.status === "resolved" && bet.winner_id === user.id ? "bg-primary/20 text-primary" :
                            bet.status === "resolved" ? "bg-destructive/20 text-destructive" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {bet.status === "resolved" && bet.winner_id === user.id ? "WON" :
                             bet.status === "resolved" && bet.winner_id ? "LOST" :
                             bet.status === "resolved" ? "DRAW" :
                             bet.status.toUpperCase()}
                          </span>
                        </div>

                        {/* Match */}
                        <div className="flex items-center justify-center gap-3">
                          <TeamBadge teamName={bet.matches?.home_team || ""} size="sm" />
                          <span className="font-display text-sm font-bold">
                            {bet.matches?.home_team} vs {bet.matches?.away_team}
                          </span>
                          <TeamBadge teamName={bet.matches?.away_team || ""} size="sm" />
                        </div>

                        {/* Predictions */}
                        <div className="grid grid-cols-2 gap-3 text-center">
                          <div className="rounded-lg bg-muted/30 p-2 border border-border/30">
                            <p className="text-[10px] text-muted-foreground">
                              {isChallenger ? "You" : `@${bet.challenger?.username || "anon"}`}
                            </p>
                            <p className="font-display font-bold text-primary">
                              {bet.challenger_prediction_home} - {bet.challenger_prediction_away}
                            </p>
                          </div>
                          <div className="rounded-lg bg-muted/30 p-2 border border-border/30">
                            <p className="text-[10px] text-muted-foreground">
                              {!isChallenger ? "You" : `@${bet.opponent?.username || "anon"}`}
                            </p>
                            <p className="font-display font-bold text-primary">
                              {bet.opponent_prediction_home !== null
                                ? `${bet.opponent_prediction_home} - ${bet.opponent_prediction_away}`
                                : "Waiting..."}
                            </p>
                          </div>
                        </div>

                        {/* Actions for pending bets received */}
                        {bet.status === "pending" && !isChallenger && (
                          <div className="space-y-2">
                            {respondingId === bet.id ? (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                className="space-y-2"
                              >
                                <label className="text-xs text-muted-foreground">Your prediction:</label>
                                <div className="grid grid-cols-2 gap-2">
                                  <Input
                                    type="number" min={0} max={20} value={responseHome}
                                    onChange={(e) => setResponseHome(parseInt(e.target.value) || 0)}
                                    className="h-8 text-center font-display font-bold"
                                  />
                                  <Input
                                    type="number" min={0} max={20} value={responseAway}
                                    onChange={(e) => setResponseAway(parseInt(e.target.value) || 0)}
                                    className="h-8 text-center font-display font-bold"
                                  />
                                </div>
                                <Button onClick={() => handleAccept(bet)} className="w-full neon-glow h-8 text-sm">
                                  <Check className="h-3.5 w-3.5 mr-1" /> Accept & Lock In
                                </Button>
                              </motion.div>
                            ) : (
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => setRespondingId(bet.id)}
                                  className="flex-1 neon-glow h-8 text-sm"
                                >
                                  <Check className="h-3.5 w-3.5 mr-1" /> Accept
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => handleDecline(bet)}
                                  className="flex-1 h-8 text-sm border-destructive/30 text-destructive hover:bg-destructive/10"
                                >
                                  <X className="h-3.5 w-3.5 mr-1" /> Decline
                                </Button>
                              </div>
                            )}
                          </div>
                        )}

                        {bet.status === "pending" && isChallenger && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" /> Waiting for @{bet.opponent?.username || "anon"} to respond
                          </div>
                        )}
                      </CardContent>
                    </SpotlightCard>
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Challenges;
