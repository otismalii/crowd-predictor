import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import GradientText from "@/components/reactbits/GradientText";
import logoImg from "@/assets/logo.png";

const Footer = () => (
  <footer className="border-t border-border/50 bg-card/30 py-10">
    <div className="container flex flex-col items-center gap-6 text-center">
      <motion.div
        className="flex items-center gap-2.5"
        whileHover={{ scale: 1.05 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <img src={logoImg} alt="PagazaBetz" className="h-7 w-7 object-contain" />
        <GradientText
          className="font-display text-lg font-bold tracking-wider"
          animationSpeed={8}
        >
          PAGAZABETZ
        </GradientText>
      </motion.div>

      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground transition-colors">Markets</Link>
        <Link to="/leaderboard" className="hover:text-foreground transition-colors">Leaderboard</Link>
        <Link to="/challenges" className="hover:text-foreground transition-colors">Challenges</Link>
        <Link to="/wallet" className="hover:text-foreground transition-colors">Wallet</Link>
      </div>

      <div className="flex items-center gap-4 text-[11px] text-muted-foreground/60">
        <span>Built by <span className="text-accent font-semibold">LionByte Studios</span></span>
        <span className="h-3 w-px bg-border/50" />
        <span>&copy; {new Date().getFullYear()} PagazaBetz</span>
      </div>
    </div>
  </footer>
);

export default Footer;
