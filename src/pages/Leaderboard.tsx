import { useEffect, useState, useCallback, useRef } from "react";
import SEOHead from "@/components/SEOHead";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CardContent } from "@/components/ui/card";
import { Trophy, Medal, Star, TrendingUp, Target, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import LeaderboardSkeleton from "@/components/skeletons/LeaderboardSkeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import GradientText from "@/components/reactbits/GradientText";
import AnimatedCounter from "@/components/reactbits/AnimatedCounter";
import SplitText from "@/components/reactbits/SplitText";
import { motion } from "framer-motion";

const PAGE_SIZE = 30;

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
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [tab, setTab] = useState<"reputation" | "accuracy">("reputation");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const totalFetched = useRef(0);

  useEffect(() => {
    totalFetched.current = 0;
    setProfiles([]);
    setHasMore(true);
    setLoading(true);
    fetchProfiles(0).then(() => setLoading(false));
  }, [tab]);

  const fetchProfiles = async (offset: number) => {
    const col = tab === "reputation" ? "reputation_score" : "accuracy_rate";
    const { data } = await supabase
      .from("profiles")
      .select("id, username, reputation_score, accuracy_rate, avatar_url, followers_count")
      .order(col, { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (!data) return;
    if (data.length < PAGE_SIZE) setHasMore(false);
    totalFetched.current = offset + data.length;

    if (offset === 0) {
      setProfiles(data as Profile[]);
    } else {
      setProfiles(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const unique = (data as Profile[]).filter(p => !existingIds.has(p.id));
        return [...prev, ...unique];
      });
    }
  };

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await fetchProfiles(totalFetched.current);
    setLoadingMore(false);
  }, [loadingMore, hasMore, tab]);

  const lastRowRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        loadMore();
      }
    }, { rootMargin: "200px" });
    if (node) observerRef.current.observe(node);
  }, [hasMore, loadingMore, loadMore]);

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
      <SEOHead title="Leaderboard | Pagaza" path="/leaderboard" />
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
              <LeaderboardSkeleton />
            ) : profiles.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">No users yet.</div>
            ) : (
              <div className="divide-y divide-border/50">
                {profiles.map((p, i) => (
                  <motion.div
                    key={p.id}
                    ref={i === profiles.length - 1 ? lastRowRef : undefined}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.5), ease: [0.25, 0.46, 0.45, 0.94] }}
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
                {loadingMore && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                )}
                {!hasMore && profiles.length > PAGE_SIZE && (
                  <p className="text-center text-xs text-muted-foreground py-4">All users loaded</p>
                )}
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