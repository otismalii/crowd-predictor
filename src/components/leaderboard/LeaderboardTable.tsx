import { Link } from "react-router-dom";
import { Trophy, Medal, Star, TrendingUp, Target } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AnimatedCounter from "@/components/reactbits/AnimatedCounter";
import { motion } from "framer-motion";

interface Profile {
  id: string;
  username: string | null;
  reputation_score: number;
  accuracy_rate: number;
  avatar_url: string | null;
  followers_count: number;
}

interface LeaderboardTableProps {
  profiles: Profile[];
  tab: "reputation" | "accuracy";
  lastRowRef?: (node: HTMLDivElement | null) => void;
}

const getRankDisplay = (i: number) => {
  if (i === 0) return (
    <motion.div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center" animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}>
      <Trophy className="h-5 w-5 text-accent" />
    </motion.div>
  );
  if (i === 1) return (
    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
      <Medal className="h-5 w-5 text-muted-foreground" />
    </div>
  );
  if (i === 2) return (
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

const LeaderboardTable = ({ profiles, tab, lastRowRef }: LeaderboardTableProps) => {
  if (profiles.length === 0) {
    return <div className="p-12 text-center text-muted-foreground">No users yet.</div>;
  }

  return (
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
              <span className="text-xs text-muted-foreground">{p.followers_count} followers</span>
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
  );
};

export default LeaderboardTable;
