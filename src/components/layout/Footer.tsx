import { Zap } from "lucide-react";
import { motion } from "framer-motion";
import GradientText from "@/components/reactbits/GradientText";

const Footer = () => (
  <footer className="border-t border-border/50 bg-background/50 py-10">
    <div className="container flex flex-col items-center gap-5 text-center">
      <motion.div
        className="flex items-center gap-2"
        whileHover={{ scale: 1.05 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <Zap className="h-5 w-5 text-primary" />
        <GradientText
          className="font-display text-lg font-bold tracking-wider"
          animationSpeed={8}
        >
          PAGAZABETZ
        </GradientText>
      </motion.div>
      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <span>Built by <span className="text-accent font-semibold">LionByte Studios</span></span>
        <span className="h-3 w-px bg-border" />
        <span>© {new Date().getFullYear()}</span>
      </div>
    </div>
  </footer>
);

export default Footer;
