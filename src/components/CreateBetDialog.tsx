import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Swords, Percent } from "lucide-react";
import { motion } from "framer-motion";
import TeamBadge from "@/components/TeamBadge";

interface Match {
  id: string;
  home_team: string;
  away_team: string;
  league: string;
  kickoff: string;
}

interface CreateBetDialogProps {
  match?: Match;
  opponentId?: string;
  trigger?: React.ReactNode;
}

const HOUSE_CUT = 10; // 10% house cut

const CreateBetDialog = ({ match: propMatch, opponentId: propOpponentId, trigger }: CreateBetDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState(propMatch?.id || "");
  const [opponents, setOpponents] = useState<{ id: string; username: string }[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState(propOpponentId || "");
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [stake, setStake] = useState([100]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!propMatch) {
      supabase.from("matches").select("id, home_team, away_team, league, kickoff")
        .eq("status", "upcoming").order("kickoff").limit(20)
        .then(({ data }) => { if (data) setMatches(data); });
    }
    if (!propOpponentId) {
      supabase.from("profiles").select("id, username")
        .neq("id", user?.id || "").limit(50)
        .then(({ data }) => { if (data) setOpponents(data as { id: string; username: string }[]); });
    }
  }, [open, user?.id, propMatch, propOpponentId]);

  const currentMatch = propMatch || matches.find(m => m.id === selectedMatchId);
  const winnerPayout = Math.round(stake[0] * 2 * (1 - HOUSE_CUT / 100));

  const handleSubmit = async () => {
    if (!user || !currentMatch || !selectedOpponent) return;
    setSubmitting(true);

    const { error } = await supabase.from("p2p_bets").insert({
      match_id: currentMatch.id,
      challenger_id: user.id,
      opponent_id: selectedOpponent,
      challenger_prediction_home: homeScore,
      challenger_prediction_away: awayScore,
      stake_amount: stake[0],
      house_cut_percent: HOUSE_CUT,
    } as any);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      // Send notification to opponent
      await supabase.from("notifications").insert({
        user_id: selectedOpponent,
        type: "bet_challenge",
        title: "⚔️ New Challenge!",
        message: `You've been challenged to a bet on ${currentMatch.home_team} vs ${currentMatch.away_team}!`,
        link: `/challenges`,
      });
      toast({ title: "⚔️ Challenge sent!" });
      setOpen(false);
      setHomeScore(0);
      setAwayScore(0);
      setStake([100]);
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="border-accent/30 text-accent hover:bg-accent/10">
            <Swords className="h-3.5 w-3.5 mr-1.5" /> Challenge
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-wider flex items-center gap-2">
            <Swords className="h-5 w-5 text-accent" /> P2P BET
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Match selector */}
          {!propMatch && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Match</label>
              <Select value={selectedMatchId} onValueChange={setSelectedMatchId}>
                <SelectTrigger><SelectValue placeholder="Select a match" /></SelectTrigger>
                <SelectContent>
                  {matches.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.home_team} vs {m.away_team}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {currentMatch && (
            <div className="flex items-center justify-center gap-3 py-2">
              <TeamBadge teamName={currentMatch.home_team} size="md" />
              <span className="font-display text-sm font-bold">{currentMatch.home_team}</span>
              <span className="text-muted-foreground text-xs">VS</span>
              <span className="font-display text-sm font-bold">{currentMatch.away_team}</span>
              <TeamBadge teamName={currentMatch.away_team} size="md" />
            </div>
          )}

          {/* Opponent selector */}
          {!propOpponentId && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Challenge</label>
              <Select value={selectedOpponent} onValueChange={setSelectedOpponent}>
                <SelectTrigger><SelectValue placeholder="Select opponent" /></SelectTrigger>
                <SelectContent>
                  {opponents.map(o => (
                    <SelectItem key={o.id} value={o.id}>@{o.username || "anon"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Your prediction */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Your Prediction</label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number" min={0} max={20} value={homeScore}
                onChange={(e) => setHomeScore(parseInt(e.target.value) || 0)}
                className="h-9 text-center font-display text-lg font-bold"
              />
              <Input
                type="number" min={0} max={20} value={awayScore}
                onChange={(e) => setAwayScore(parseInt(e.target.value) || 0)}
                className="h-9 text-center font-display text-lg font-bold"
              />
            </div>
          </div>

          {/* Stake */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">
              Stake: <span className="text-primary font-bold">{stake[0]} pts</span>
            </label>
            <Slider value={stake} onValueChange={setStake} min={10} max={1000} step={10} />
          </div>

          {/* Payout info */}
          <motion.div
            className="rounded-lg bg-accent/5 border border-accent/15 p-3 space-y-1"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Total pot</span>
              <span className="font-bold">{stake[0] * 2} pts</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Percent className="h-3 w-3" /> House cut ({HOUSE_CUT}%)
              </span>
              <span className="font-bold text-destructive">-{Math.round(stake[0] * 2 * HOUSE_CUT / 100)} pts</span>
            </div>
            <div className="flex items-center justify-between text-xs border-t border-border/30 pt-1">
              <span className="text-muted-foreground font-medium">Winner takes</span>
              <span className="font-bold text-primary">{winnerPayout} pts</span>
            </div>
          </motion.div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !currentMatch || !selectedOpponent}
            className="w-full neon-glow-accent bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {submitting ? "Sending..." : "⚔️ Send Challenge"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateBetDialog;
