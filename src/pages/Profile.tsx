import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Target, TrendingUp, Users, Calendar, Zap, Pencil } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import GradientText from "@/components/reactbits/GradientText";
import AnimatedCounter from "@/components/reactbits/AnimatedCounter";
import SplitText from "@/components/reactbits/SplitText";
import Aurora from "@/components/reactbits/Aurora";
import TeamBadge from "@/components/TeamBadge";
import FollowButton from "@/components/FollowButton";
import StreakBadge from "@/components/StreakBadge";
import ProfileEdit from "@/components/ProfileEdit";
import AchievementBadges from "@/components/AchievementBadges";
import CreateBetDialog from "@/components/CreateBetDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const Profile = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const isOwnProfile = user?.id === id;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setEditing(false);
    Promise.all([
      supabase.from("profiles").select("*").eq("id", id).single(),
      supabase.from("predictions").select("*, matches(home_team, away_team, league)").eq("user_id", id).order("created_at", { ascending: false }).limit(20),
    ]).then(([profileRes, predRes]) => {
      if (profileRes.data) setProfile(profileRes.data);
      setPredictions(predRes.data || []);
      setLoading(false);
    });
  }, [id]);

  const refreshProfile = () => {
    if (!id) return;
    supabase.from("profiles").select("*").eq("id", id).single().then(({ data }) => {
      if (data) setProfile(data);
    });
  };

  if (loading) return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8 max-w-2xl space-y-6">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );

  if (!profile) return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-20 text-center text-muted-foreground">Profile not found.</div>
    </div>
  );

  const stats = [
    { icon: Target, label: "Accuracy", value: profile.accuracy_rate, suffix: "%", color: "text-primary" },
    { icon: TrendingUp, label: "Reputation", value: profile.reputation_score, suffix: "", color: "text-accent" },
    { icon: Users, label: "Followers", value: profile.followers_count, suffix: "", color: "text-primary" },
  ];

  const correctCount = predictions.filter(p => p.status === "correct").length;
  const totalPredictions = predictions.length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container py-8 max-w-2xl">
        <AnimatePresence mode="wait">
          {editing ? (
            <ProfileEdit
              key="edit"
              profile={profile}
              onClose={() => setEditing(false)}
              onSaved={(updated) => {
                setProfile(updated);
                setEditing(false);
              }}
            />
          ) : (
            <motion.div
              key="view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <SpotlightCard className="mb-8 overflow-hidden" spotlightColor="rgba(120, 255, 120, 0.1)">
                {/* Banner */}
                <div className="relative h-28 overflow-hidden">
                  <Aurora className="opacity-50" />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-card" />
                </div>

                <CardContent className="relative -mt-12 flex flex-col items-center pb-8 text-center">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  >
                    <Avatar className="h-24 w-24 ring-4 ring-card shadow-xl">
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback className="text-2xl bg-primary/10 text-primary font-display font-bold">
                        {(profile.username || "?")[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </motion.div>

                  <h1 className="mt-4 font-display text-3xl font-bold tracking-wider">
                    <GradientText animationSpeed={6}>
                      @{profile.username || "anon"}
                    </GradientText>
                  </h1>

                  {profile.bio && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.25 }}
                      className="text-sm text-muted-foreground mt-2 max-w-xs"
                    >
                      {profile.bio}
                    </motion.p>
                  )}

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center gap-3 mt-3"
                  >
                    <span className="text-xs px-4 py-1.5 rounded-full bg-accent/10 text-accent font-semibold border border-accent/20">
                      {profile.subscription_plan} plan
                    </span>
                    <StreakBadge currentStreak={profile.current_streak} bestStreak={profile.best_streak} compact />
                    <AchievementBadges userId={id!} compact />
                  </motion.div>

                  {/* Actions */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 }}
                    className="mt-4 flex items-center gap-2"
                  >
                    {isOwnProfile ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditing(true)}
                        className="border-primary/30 text-primary"
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Profile
                      </Button>
                    ) : (
                      <>
                        <FollowButton targetUserId={id!} onFollowChange={refreshProfile} />
                        <CreateBetDialog opponentId={id!} />
                      </>
                    )}
                  </motion.div>

                  {/* Streak display */}
                  {(profile.current_streak > 0 || profile.best_streak > 0) && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="mt-4"
                    >
                      <StreakBadge currentStreak={profile.current_streak} bestStreak={profile.best_streak} />
                    </motion.div>
                  )}

                  {/* Stats */}
                  <div className="mt-6 grid grid-cols-3 gap-6 w-full max-w-sm">
                    {stats.map((s, i) => (
                      <motion.div
                        key={s.label}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + i * 0.1 }}
                        className="text-center group"
                      >
                        <div className="mx-auto mb-2 h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                          <s.icon className={`h-5 w-5 ${s.color}`} />
                        </div>
                        <AnimatedCounter
                          value={s.value}
                          fontSize={22}
                          className={`font-display font-bold ${s.color}`}
                          suffix={s.suffix}
                          duration={1.2}
                        />
                        <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </SpotlightCard>

              {/* Achievement Badges */}
              <div className="mt-6">
                <AchievementBadges userId={id!} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Prediction history */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold tracking-wider">
              <SplitText text="RECENT PREDICTIONS" splitType="words" delay={0.1} />
            </h2>
            {totalPredictions > 0 && (
              <span className="text-xs text-muted-foreground">
                <span className="text-primary font-semibold">{correctCount}</span>/{totalPredictions} correct
              </span>
            )}
          </div>

          <div className="space-y-3">
            {predictions.length === 0 ? (
              <SpotlightCard className="p-10 text-center" spotlightColor="rgba(120, 255, 120, 0.08)">
                <Zap className="mx-auto mb-3 h-10 w-10 text-primary/20" />
                <p className="text-muted-foreground font-display">No predictions yet</p>
                <p className="text-xs text-muted-foreground mt-1">Predictions will appear here once made.</p>
              </SpotlightCard>
            ) : (
              predictions.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.04 }}
                >
                  <Link to={`/match/${p.match_id}`}>
                    <SpotlightCard
                      className="hover:border-primary/20 transition-all group cursor-pointer"
                      spotlightColor={
                        p.status === "correct" ? "rgba(120, 255, 120, 0.15)" :
                        p.status === "incorrect" ? "rgba(255, 80, 80, 0.1)" :
                        "rgba(120, 255, 120, 0.08)"
                      }
                    >
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-accent font-semibold uppercase tracking-wider">{p.matches?.league}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <TeamBadge teamName={p.matches?.home_team || ""} size="sm" />
                            <p className="text-sm font-display font-bold group-hover:text-primary transition-colors truncate">
                              {p.matches?.home_team}{" "}
                              <span className="text-primary">{p.predicted_home_score}</span>
                              <span className="text-muted-foreground mx-1">-</span>
                              <span className="text-primary">{p.predicted_away_score}</span>
                              {" "}{p.matches?.away_team}
                            </p>
                            <TeamBadge teamName={p.matches?.away_team || ""} size="sm" />
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <p className="text-[11px] text-muted-foreground">{format(new Date(p.created_at), "MMM d, yyyy")}</p>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                              🎯 {p.confidence}/5
                            </span>
                          </div>
                        </div>
                        <motion.span
                          whileHover={{ scale: 1.1 }}
                          className={`text-xs px-3 py-1 rounded-full font-semibold ${
                            p.status === "correct" ? "bg-primary/20 text-primary" :
                            p.status === "incorrect" ? "bg-destructive/20 text-destructive" :
                            "bg-muted text-muted-foreground"
                          }`}
                        >
                          {p.status}
                        </motion.span>
                      </CardContent>
                    </SpotlightCard>
                  </Link>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>
      <Footer />
    </div>
  );
};

export default Profile;
