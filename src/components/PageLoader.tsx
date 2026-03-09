import { motion } from "framer-motion";

const PageLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <motion.div className="flex flex-col items-center gap-4">
      <div className="relative">
        <motion.div
          className="h-10 w-10 rounded-full border-2 border-primary/30"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute inset-0 h-10 w-10 rounded-full border-2 border-transparent border-t-primary"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
        />
      </div>
      <motion.p
        className="text-xs text-muted-foreground font-display tracking-wider"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        Loading...
      </motion.p>
    </motion.div>
  </div>
);

export default PageLoader;
