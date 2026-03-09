import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Instagram, Mail } from "lucide-react";
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

      {/* Social Media Links */}
      <div className="flex items-center gap-3">
        <a
          href="https://instagram.com/lionbyteke"
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-lg bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-primary transition-colors"
          aria-label="Follow us on Instagram"
        >
          <Instagram className="h-4 w-4" />
        </a>
        <a
          href="https://twitter.com/lionbyteke"
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-lg bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-primary transition-colors"
          aria-label="Follow us on Twitter"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </a>
        <a
          href="mailto:support@pagazabetz.com"
          className="p-2 rounded-lg bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-primary transition-colors"
          aria-label="Contact us"
        >
          <Mail className="h-4 w-4" />
        </a>
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
