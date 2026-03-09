import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

const MarketDetailSkeleton = () => (
  <div className="space-y-6">
    {/* Header */}
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-b border-border/30 bg-card/30 px-4 py-6"
    >
      <div className="max-w-4xl mx-auto space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-4 w-6" />
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-3">
          <Skeleton className="h-7 w-24 rounded-lg" />
          <Skeleton className="h-7 w-20 rounded-lg" />
          <Skeleton className="h-7 w-28 rounded-lg" />
        </div>
      </div>
    </motion.div>

    <div className="max-w-4xl mx-auto grid gap-6 lg:grid-cols-5 px-4">
      {/* Main content */}
      <div className="lg:col-span-3 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.06 }}
          >
            <Skeleton className="h-14 w-full rounded-xl" />
          </motion.div>
        ))}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Skeleton className="h-48 w-full rounded-xl mt-4" />
        </motion.div>
      </div>
      {/* Sidebar */}
      <motion.div
        className="lg:col-span-2 space-y-4"
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </motion.div>
    </div>
  </div>
);

export default MarketDetailSkeleton;
