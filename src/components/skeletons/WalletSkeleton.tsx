import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

const WalletSkeleton = () => (
  <div className="space-y-4">
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl border border-border/30 bg-card/50 p-6 flex items-center gap-6"
    >
      <Skeleton className="h-14 w-14 rounded-2xl" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-9 w-32" />
      </div>
    </motion.div>
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <Skeleton className="h-40 w-full rounded-xl" />
    </motion.div>
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
    >
      <Skeleton className="h-20 w-full rounded-xl" />
    </motion.div>
  </div>
);

export default WalletSkeleton;
