import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import TeamBadge from "@/components/TeamBadge";
import { Calendar, ChevronDown, ChevronUp, Send, Clock, Brain } from "lucide-react";
import { format, isPast, isFuture, isToday } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

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

interface MatchCardProps {
  match: Match;
  userId: string | null;
  insightPreview?: string | null;
  onNavigateAuth: () => void;
  onPredictionSubmitted: () => void;
}

const MatchCard = ({ match, userId, onNavigateAuth, onPredictionSubmitted }: MatchCardProps) => {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [confidence, setConfidence] = useState([3]);
  const [analysis, setAnalysis] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const kickoffDate = new Date(match.kickoff);
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const isUpcoming = match.status === "upcoming";
  const matchDay = isToday(kickoffDate) ? "Today" : format(kickoffDate, "EEE, MMM d");
  const matchTime = format(kickoffDate, "HH:mm");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      onNavigateAuth();
      return;
    }
    setSubmitting(true);

    const { error } = await supabase.from("predictions").insert({
      user_id: userId,
      match_id: match.id,
      predicted_home_score: homeScore,
      predicted_away_score: awayScore,
      confidence: confidence[0],
      analysis: analysis || null,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "🎯 Prediction submitted!" });
      setExpanded(false);
      setAnalysis("");
      setHomeScore(0);
      setAwayScore(0);
      setConfidence([3]);
      onPredictionSubmitted();
    }
    setSubmitting(false);
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={`glass-card overflow-hidden transition-all duration-300 ${
        isLive ? "border-primary/40 shadow-[0_0_20px_hsl(120_100%_55%/0.15)]" : 
        "hover:border-primary/20"
      }`}>
        <CardContent className="p-0">
          {/* League header */}
          <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border/30">
            <span className="text-xs font-semibold text-accent uppercase tracking-wider">{match.league}</span>
            <div className="flex items-center gap-1.5">
              {isLive && (
                <span className="flex items-center gap-1 text-xs font-bold text-primary animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" /> LIVE
                </span>
              )}
              {isFinished && <span className="text-xs text-muted-foreground font-medium">FT</span>}
              {isUpcoming && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> {matchDay} · {matchTime}
                </span>
              )}
            </div>
          </div>

          {/* Match body */}
          <Link to={`/match/${match.id}`} className="block">
            <div className="px-4 py-5 flex items-center gap-4">
              {/* Home team */}
              <div className="flex-1 flex items-center gap-3 justify-end">
                <span className="font-display text-sm sm:text-base font-bold text-right truncate">{match.home_team}</span>
                <TeamBadge teamName={match.home_team} size="md" />
              </div>

              {/* Score / VS */}
              <div className="flex-shrink-0 w-20 text-center">
                {isFinished || isLive ? (
                  <div className="font-display text-2xl font-bold tracking-wider">
                    <span className="text-primary">{match.home_score ?? "-"}</span>
                    <span className="text-muted-foreground mx-1">:</span>
                    <span className="text-primary">{match.away_score ?? "-"}</span>
                  </div>
                ) : (
                  <span className="font-display text-lg text-muted-foreground font-bold">VS</span>
                )}
              </div>

              {/* Away team */}
              <div className="flex-1 flex items-center gap-3">
                <TeamBadge teamName={match.away_team} size="md" />
                <span className="font-display text-sm sm:text-base font-bold truncate">{match.away_team}</span>
              </div>
            </div>
          </Link>

          {/* Predict button */}
          {isUpcoming && (
            <div className="px-4 pb-3">
              <button
                onClick={() => {
                  if (!userId) { onNavigateAuth(); return; }
                  setExpanded(!expanded);
                }}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 transition-all"
              >
                {expanded ? <><ChevronUp className="h-3.5 w-3.5" /> Close</> : <><Send className="h-3.5 w-3.5" /> Predict</>}
              </button>
            </div>
          )}

          {/* Prediction form */}
          <AnimatePresence>
            {expanded && isUpcoming && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{match.home_team}</label>
                      <Input
                        type="number"
                        min={0}
                        max={20}
                        value={homeScore}
                        onChange={(e) => setHomeScore(parseInt(e.target.value) || 0)}
                        className="h-9 text-center font-display text-lg font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{match.away_team}</label>
                      <Input
                        type="number"
                        min={0}
                        max={20}
                        value={awayScore}
                        onChange={(e) => setAwayScore(parseInt(e.target.value) || 0)}
                        className="h-9 text-center font-display text-lg font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      Confidence: <span className="text-primary font-bold">{confidence[0]}/5</span>
                    </label>
                    <Slider value={confidence} onValueChange={setConfidence} min={1} max={5} step={1} />
                  </div>

                  <Textarea
                    value={analysis}
                    onChange={(e) => setAnalysis(e.target.value)}
                    placeholder="Quick analysis (optional)..."
                    rows={2}
                    className="text-sm resize-none"
                  />

                  <Button type="submit" className="w-full neon-glow h-9 text-sm" disabled={submitting}>
                    {submitting ? "Submitting..." : "⚡ Submit Prediction"}
                  </Button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default MatchCard;
