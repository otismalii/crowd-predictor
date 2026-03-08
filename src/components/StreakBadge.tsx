import { Flame } from "lucide-react";
import { motion } from "framer-motion";

interface StreakBadgeProps {
  currentStreak: number;
  bestStreak: number;
  compact?: boolean;
}

const StreakBadge = ({ currentStreak, bestStreak, compact = false }: StreakBadgeProps) => {
  if (currentStreak === 0 && bestStreak === 0) return null;

  const getFlameColor = (streak: number) => {
    if (streak >= 10) return "text-accent";
    if (streak >= 5) return "text-primary";
    return "text-muted-foreground";
  };

  if (compact) {
    return currentStreak > 0 ? (
      <motion.span
        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-semibold border border-accent/20"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <Flame className="h-3 w-3" />
        {currentStreak}
      </motion.span>
    ) : null;
  }

  return (
    <div className="flex items-center gap-4">
      {currentStreak > 0 && (
        <motion.div
          className="flex items-center gap-1.5"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Flame className={`h-5 w-5 ${getFlameColor(currentStreak)}`} />
          </motion.div>
          <div>
            <p className="text-sm font-display font-bold text-accent">{currentStreak}</p>
            <p className="text-[10px] text-muted-foreground">streak</p>
          </div>
        </motion.div>
      )}
      {bestStreak > 0 && (
        <div className="flex items-center gap-1.5">
          <Flame className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-display font-bold text-muted-foreground">{bestStreak}</p>
            <p className="text-[10px] text-muted-foreground">best</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default StreakBadge;
