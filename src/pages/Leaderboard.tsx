import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CardContent } from "@/components/ui/card";
import { Trophy, Medal, Star, TrendingUp, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import GradientText from "@/components/reactbits/GradientText";
import AnimatedCounter from "@/components/reactbits/AnimatedCounter";
import SplitText from "@/components/reactbits/SplitText";
import { motion } from "framer-motion";

interface Profile {
  id: string;
  username: string | null;
  reputation_score: number;
  accuracy_rate: number;
  avatar_url: string | null;
  followers_count: number;
}

const Leaderboard = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"reputation" | "accuracy">("reputation");

  useEffect(() => {
    setLoading(true);
    const col = tab === "reputation" ? "reputation_score" : "accuracy_rate";
    supabase
      .from("profiles")
      .select("id, username, reputation_score, accuracy_rate, avatar_url, followers_count")
      .order(col, { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setProfiles(data as Profile[]);
        setLoading(false);
      });
  }, [tab]);

  const getRankDisplay = (i: number) => {
    if (i === 0)
      return (
        <motion.div
          className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Trophy className="h-5 w-5 text-accent" />
        </motion.div>
      );
    if (i === 1)
      return (
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <Medal className="h-5 w-5 text-muted-foreground" />
        </div>
      );
    if (i === 2)
      return (
        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
          <Star className="h-5 w-5 text-primary" />
        </div>
      );
    return (
      <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center">
        <span className="text-sm font-bold text-muted-foreground">{i + 1}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8 max-w-2xl">
        <h1 className="mb-2 font-display text-3xl sm:text-4xl font-bold tracking-wider">
          <Trophy className="inline-block mr-2 h-8 w-8 text-accent" />
          <SplitText text="LEADER" className="text-foreground" splitType="chars" delay={0.04} />
          <GradientText className="font-display text-3xl sm:text-4xl font-bold tracking-wider">
            BOARD
          </GradientText>
        </h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-muted-foreground mb-6 text-sm"
        >
          Top predictors ranked by performance
        </motion.p>

        <div className="mb-6 flex gap-1 p-1 bg-muted/50 rounded-xl w-fit backdrop-blur-sm border border-border/30">
          {[
            { key: "reputation" as const, label: "Reputation", icon: TrendingUp },
            { key: "accuracy" as const, label: "Accuracy", icon: Target },
          ].map(({ key, label, icon: Icon }) => (
            <motion.button
              key={key}
              onClick={() => setTab(key)}
              className={`relative flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                tab === key ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              whileTap={{ scale: 0.97 }}
            >
              {tab === key && (
                <motion.div
                  layoutId="lb-tab-bg"
                  className="absolute inset-0 bg-primary rounded-lg neon-glow"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </span>
            </motion.button>
          ))}
        </div>

        <SpotlightCard spotlightColor="rgba(120, 255, 120, 0.1)">
          <CardContent className="p-0">
            {loading ? (
              <div className="divide-y divide-border/50">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-5 w-12" />
                  </div>
                ))}
              </div>
            ) : profiles.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">No users yet.</div>
            ) : (
              <div className="divide-y divide-border/50">
                {profiles.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, ease: [0.25, 0.46, 0.45, 0.94] }}
                  >
                    <Link
                      to={`/profile/${p.id}`}
                      className="flex items-center gap-3 p-4 transition-all hover:bg-muted/30 group"
                    >
                      {getRankDisplay(i)}
                      <Avatar className="h-10 w-10 ring-2 ring-border/50 group-hover:ring-primary/30 transition-all">
                        <AvatarImage src={p.avatar_url || undefined} />
                        <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                          {(p.username || "?")[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-foreground text-sm truncate block group-hover:text-primary transition-colors">
                          @{p.username || "anon"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {p.followers_count} followers
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <AnimatedCounter
                          value={tab === "reputation" ? p.reputation_score : p.accuracy_rate}
                          fontSize={16}
                          className="font-bold text-primary"
                          suffix={tab === "accuracy" ? "%" : ""}
                          duration={1}
                        />
                        <span className="block text-[10px] text-muted-foreground">
                          {tab === "reputation" ? "pts" : "accuracy"}
                        </span>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </SpotlightCard>
      </div>
      <Footer />
    </div>
  );
};

export default Leaderboard;
