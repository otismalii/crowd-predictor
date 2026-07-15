import { useEffect, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import ProfileCreatorTab from "@/components/profile/ProfileCreatorTab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, TrendingUp, Users, Calendar, Zap, Pencil, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import GradientText from "@/components/reactbits/GradientText";
import AnimatedCounter from "@/components/reactbits/AnimatedCounter";
import SplitText from "@/components/reactbits/SplitText";
import Aurora from "@/components/reactbits/Aurora";
import FollowButton from "@/components/FollowButton";
import StreakBadge from "@/components/StreakBadge";
import ProfileEdit from "@/components/ProfileEdit";
import AchievementBadges from "@/components/AchievementBadges";
import ProfileSkeleton from "@/components/skeletons/ProfileSkeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const Profile = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "overview";
  const setTab = (v: string) => setSearchParams((prev) => { const p = new URLSearchParams(prev); p.set("tab", v); return p; }, { replace: true });
  const [profile, setProfile] = useState<any>(null);
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const isOwnProfile = user?.id === id;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setEditing(false);
    const profilePromise = isOwnProfile
      ? (supabase as any).rpc("get_own_profile").then((r: any) => ({ data: Array.isArray(r.data) ? r.data[0] : r.data }))
      : (supabase as any).from("public_profiles")
          .select("id, username, avatar_url, bio, reputation_score, accuracy_rate, current_streak, best_streak, followers_count, subscription_plan, created_at")
          .eq("id", id).single();
    Promise.all([
      profilePromise,
      supabase
        .from("trades")
        .select("id, side, shares, price_per_share, total_cost, created_at, market_id, markets(title), market_outcomes:outcome_id(label)")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]).then(([profileRes, tradeRes]) => {
      if (profileRes.data) setProfile(profileRes.data);
      setTrades((tradeRes.data as any[]) || []);
      setLoading(false);
    });
  }, [id, isOwnProfile]);

  const refreshProfile = () => {
    if (!id) return;
    const p = isOwnProfile
      ? (supabase as any).rpc("get_own_profile").then((r: any) => ({ data: Array.isArray(r.data) ? r.data[0] : r.data }))
      : (supabase as any).from("public_profiles")
          .select("id, username, avatar_url, bio, reputation_score, accuracy_rate, current_streak, best_streak, followers_count, subscription_plan, created_at")
          .eq("id", id).single();
    p.then(({ data }: any) => { if (data) setProfile(data); });
  };

  if (loading) return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8">
        <ProfileSkeleton />
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

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 }}
                    className="mt-4 flex items-center gap-2"
                  >
                    {isOwnProfile ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditing(true)}
                          className="border-primary/30 text-primary"
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Profile
                        </Button>
                        <Link to="/creator">
                          <Button variant="outline" size="sm" className="border-accent/30 text-accent">
                            Creator Studio
                          </Button>
                        </Link>
                      </>
                    ) : (
                      <FollowButton targetUserId={id!} onFollowChange={refreshProfile} />
                    )}
                  </motion.div>

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

              <div className="mt-6">
                <AchievementBadges userId={id!} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="creator">Creator</TabsTrigger>
          </TabsList>

          <TabsContent value="creator" className="mt-4">
            <ProfileCreatorTab userId={id!} isOwn={isOwnProfile} />
          </TabsContent>

          <TabsContent value="overview" className="mt-4">
        {/* Recent trades */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold tracking-wider">
              <SplitText text="RECENT TRADES" splitType="words" delay={0.1} />
            </h2>
            {trades.length > 0 && (
              <span className="text-xs text-muted-foreground">{trades.length} shown</span>
            )}
          </div>

          <div className="space-y-3">
            {trades.length === 0 ? (
              <SpotlightCard className="p-10 text-center" spotlightColor="rgba(120, 255, 120, 0.08)">
                <Zap className="mx-auto mb-3 h-10 w-10 text-primary/20" />
                <p className="text-muted-foreground font-display">No trades yet</p>
                <p className="text-xs text-muted-foreground mt-1">Trades will appear here once placed.</p>
              </SpotlightCard>
            ) : (
              trades.map((t, i) => {
                const isBuy = t.side === "buy";
                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.04 }}
                  >
                    <Link to={`/market/${t.market_id}`}>
                      <SpotlightCard
                        className="hover:border-primary/20 transition-all group cursor-pointer"
                        spotlightColor={isBuy ? "rgba(120, 255, 120, 0.12)" : "rgba(255, 120, 120, 0.1)"}
                      >
                        <CardContent className="flex items-center justify-between p-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {isBuy ? (
                                <ArrowUpRight className="h-3.5 w-3.5 text-primary shrink-0" />
                              ) : (
                                <ArrowDownLeft className="h-3.5 w-3.5 text-destructive shrink-0" />
                              )}
                              <p className="text-sm font-display font-bold group-hover:text-primary transition-colors truncate">
                                {t.markets?.title || "Market"}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              <span className={isBuy ? "text-primary" : "text-destructive"}>
                                {isBuy ? "BUY" : "SELL"}
                              </span>{" "}
                              {Number(t.shares).toFixed(0)} × {t.market_outcomes?.label || "—"}
                              {" @ "}
                              <span className="tabular-nums">{Number(t.price_per_share).toFixed(2)} KES</span>
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <p className="text-[11px] text-muted-foreground">
                                {format(new Date(t.created_at), "MMM d, yyyy")}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs px-3 py-1 rounded-full font-semibold bg-primary/10 text-primary tabular-nums">
                            {Number(t.total_cost).toFixed(0)} KES
                          </span>
                        </CardContent>
                      </SpotlightCard>
                    </Link>
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
      <Footer />
    </div>
  );
};

export default Profile;
