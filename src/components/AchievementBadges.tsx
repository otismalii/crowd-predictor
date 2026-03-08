import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Badge {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
}

interface UserBadge {
  badge_id: string;
  unlocked_at: string;
}

interface AchievementBadgesProps {
  userId: string;
  compact?: boolean;
}

const AchievementBadges = ({ userId, compact = false }: AchievementBadgesProps) => {
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("badges").select("*").order("category"),
      supabase.from("user_badges").select("badge_id, unlocked_at").eq("user_id", userId),
    ]).then(([badgesRes, userBadgesRes]) => {
      if (badgesRes.data) setAllBadges(badgesRes.data as Badge[]);
      if (userBadgesRes.data) setUserBadges(userBadgesRes.data as UserBadge[]);
    });
  }, [userId]);

  const unlockedIds = new Set(userBadges.map((ub) => ub.badge_id));
  const earned = allBadges.filter((b) => unlockedIds.has(b.id));
  const locked = allBadges.filter((b) => !unlockedIds.has(b.id));

  if (compact) {
    if (earned.length === 0) return null;
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {earned.slice(0, 5).map((badge) => (
          <Tooltip key={badge.id}>
            <TooltipTrigger asChild>
              <motion.span
                whileHover={{ scale: 1.2 }}
                className="text-lg cursor-default"
              >
                {badge.icon}
              </motion.span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-semibold">{badge.name}</p>
              <p className="text-xs text-muted-foreground">{badge.description}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        {earned.length > 5 && (
          <span className="text-xs text-muted-foreground font-medium">+{earned.length - 5}</span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-display text-sm font-bold text-muted-foreground uppercase tracking-widest">
        Achievements ({earned.length}/{allBadges.length})
      </h3>

      {/* Earned */}
      {earned.length > 0 && (
        <div className="grid grid-cols-5 sm:grid-cols-5 gap-3">
          {earned.map((badge, i) => (
            <Tooltip key={badge.id}>
              <TooltipTrigger asChild>
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05, type: "spring", stiffness: 300 }}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl bg-primary/5 border border-primary/20 cursor-default hover:bg-primary/10 transition-colors"
                >
                  <span className="text-2xl">{badge.icon}</span>
                  <span className="text-[10px] font-semibold text-primary text-center leading-tight">{badge.name}</span>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-semibold">{badge.name}</p>
                <p className="text-xs text-muted-foreground">{badge.description}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}

      {/* Locked */}
      {locked.length > 0 && (
        <div className="grid grid-cols-5 sm:grid-cols-5 gap-3">
          {locked.map((badge) => (
            <Tooltip key={badge.id}>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/30 border border-border/30 opacity-40 cursor-default">
                  <span className="text-2xl grayscale">{badge.icon}</span>
                  <span className="text-[10px] font-medium text-muted-foreground text-center leading-tight">{badge.name}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-semibold">{badge.name} 🔒</p>
                <p className="text-xs text-muted-foreground">{badge.description}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  );
};

export default AchievementBadges;
