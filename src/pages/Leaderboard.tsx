import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Medal, Star, TrendingUp, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
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
        <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center">
          <Trophy className="h-4 w-4 text-accent" />
        </div>
      );
    if (i === 1)
      return (
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
          <Medal className="h-4 w-4 text-muted-foreground" />
        </div>
      );
    if (i === 2)
      return (
        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
          <Star className="h-4 w-4 text-primary" />
        </div>
      );
    return (
      <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center">
        <span className="text-xs font-bold text-muted-foreground">{i + 1}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8 max-w-2xl">
        <h1 className="mb-2 font-display text-3xl font-bold tracking-wider">
          <Trophy className="inline-block mr-2 h-8 w-8 text-accent" />
          Leader<span className="text-primary">board</span>
        </h1>
        <p className="text-muted-foreground mb-6 text-sm">Top predictors ranked by performance</p>

        <div className="mb-6 flex gap-2">
          {[
            { key: "reputation" as const, label: "Reputation", icon: TrendingUp },
            { key: "accuracy" as const, label: "Accuracy", icon: Target },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === key
                  ? "bg-primary text-primary-foreground neon-glow"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <Card className="glass-card">
          <CardContent className="p-0">
            {loading ? (
              <div className="divide-y divide-border/50">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-8 w-8 rounded-full" />
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
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <Link
                      to={`/profile/${p.id}`}
                      className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/30"
                    >
                      {getRankDisplay(i)}
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={p.avatar_url || undefined} />
                        <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                          {(p.username || "?")[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-foreground text-sm truncate block">
                          @{p.username || "anon"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {p.followers_count} followers
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-sm font-bold text-primary">
                          {tab === "reputation" ? p.reputation_score : `${p.accuracy_rate}%`}
                        </span>
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
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default Leaderboard;
