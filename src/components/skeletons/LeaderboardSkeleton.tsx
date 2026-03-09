import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

const LeaderboardSkeleton = () => (
  <div className="divide-y divide-border/50">
    {Array.from({ length: 8 }).map((_, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: i * 0.05, duration: 0.4 }}
        className="flex items-center gap-4 p-4"
      >
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-5 w-12" />
      </motion.div>
    ))}
  </div>
);

export default LeaderboardSkeleton;
