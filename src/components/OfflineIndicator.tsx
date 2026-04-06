import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff } from "lucide-react";

/**
 * Shows a banner when the user goes offline.
 */
const OfflineIndicator = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[100] bg-accent text-accent-foreground text-center py-2 text-xs font-medium flex items-center justify-center gap-2"
        >
          <WifiOff className="h-3.5 w-3.5" />
          You're offline — some features may be unavailable
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineIndicator;
