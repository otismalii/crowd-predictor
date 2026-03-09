import { ReactNode } from "react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
}

const PullToRefresh = ({ onRefresh, children, className }: PullToRefreshProps) => {
  const { containerRef, pullDistance, isRefreshing } = usePullToRefresh({ onRefresh });

  return (
    <div ref={containerRef} className={className} style={{ overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      {/* Pull indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <motion.div
          className="flex items-center justify-center py-2"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: pullDistance > 0 ? pullDistance : 48, opacity: pullDistance > 20 || isRefreshing ? 1 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <motion.div
            animate={{ rotate: isRefreshing ? 360 : pullDistance * 3 }}
            transition={isRefreshing ? { repeat: Infinity, duration: 0.7, ease: "linear" } : { duration: 0 }}
          >
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? "text-primary" : pullDistance >= 80 ? "text-primary" : "text-muted-foreground"}`} />
          </motion.div>
          {isRefreshing && (
            <span className="ml-2 text-xs text-muted-foreground font-medium">Refreshing…</span>
          )}
        </motion.div>
      )}
      {children}
    </div>
  );
};

export default PullToRefresh;
