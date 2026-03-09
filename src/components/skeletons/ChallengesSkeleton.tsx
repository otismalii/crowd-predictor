import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

const ChallengesSkeleton = () => (
  <div className="space-y-3">
    {Array.from({ length: 4 }).map((_, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: i * 0.06, duration: 0.4 }}
        className="rounded-xl border border-border/30 bg-card/50 p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3.5 w-28" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex items-center justify-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
      </motion.div>
    ))}
  </div>
);

export default ChallengesSkeleton;
