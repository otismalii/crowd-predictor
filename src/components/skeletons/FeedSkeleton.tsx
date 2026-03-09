import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

const MarketCardSkeleton = ({ index }: { index: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.06, duration: 0.4 }}
    className="rounded-xl border border-border/30 bg-card/50 overflow-hidden"
  >
    {/* Header */}
    <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border/30">
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-3.5 w-20" />
      </div>
      <Skeleton className="h-5 w-14 rounded-full" />
    </div>
    {/* Title */}
    <div className="px-4 py-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2 mt-1.5" />
    </div>
    {/* Outcome bars */}
    <div className="px-4 pb-4 space-y-2">
      <Skeleton className="h-9 w-full rounded-lg" />
      <Skeleton className="h-9 w-full rounded-lg" />
      <Skeleton className="h-9 w-4/5 rounded-lg" />
    </div>
  </motion.div>
);

const FeedSkeleton = () => (
  <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 max-w-4xl mx-auto">
    {Array.from({ length: 6 }).map((_, i) => (
      <MarketCardSkeleton key={i} index={i} />
    ))}
  </div>
);

export default FeedSkeleton;
