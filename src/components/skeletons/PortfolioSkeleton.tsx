import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

const PortfolioSkeleton = () => (
  <div className="space-y-6">
    {/* Summary cards */}
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.06, duration: 0.4 }}
          className="rounded-xl border border-border/30 bg-card/50 p-3.5"
        >
          <div className="flex items-center gap-1.5 mb-2">
            <Skeleton className="h-3.5 w-3.5 rounded" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-6 w-24" />
        </motion.div>
      ))}
    </div>
    {/* Position rows */}
    {Array.from({ length: 4 }).map((_, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 + i * 0.06, duration: 0.4 }}
        className="rounded-xl border border-border/30 bg-card/50 p-4"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="text-right space-y-1.5">
            <Skeleton className="h-5 w-16 ml-auto" />
            <Skeleton className="h-3 w-12 ml-auto" />
          </div>
        </div>
      </motion.div>
    ))}
  </div>
);

export default PortfolioSkeleton;
