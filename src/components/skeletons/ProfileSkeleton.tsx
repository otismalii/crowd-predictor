import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

const ProfileSkeleton = () => (
  <div className="max-w-2xl mx-auto space-y-6">
    {/* Profile card */}
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border/30 bg-card/50 overflow-hidden"
    >
      {/* Banner */}
      <Skeleton className="h-28 w-full rounded-none" />
      {/* Avatar + info */}
      <div className="flex flex-col items-center -mt-12 pb-8 px-6">
        <Skeleton className="h-24 w-24 rounded-full ring-4 ring-card" />
        <Skeleton className="h-7 w-40 mt-4" />
        <Skeleton className="h-4 w-56 mt-2" />
        <div className="flex gap-3 mt-3">
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 w-full max-w-sm mt-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.08 }}
              className="flex flex-col items-center gap-2"
            >
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-3 w-14" />
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>

    {/* Predictions */}
    <Skeleton className="h-6 w-48" />
    {Array.from({ length: 4 }).map((_, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 + i * 0.06 }}
      >
        <Skeleton className="h-20 w-full rounded-xl" />
      </motion.div>
    ))}
  </div>
);

export default ProfileSkeleton;
