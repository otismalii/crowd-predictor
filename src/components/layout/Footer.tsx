import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import GradientText from "@/components/reactbits/GradientText";
import logoImg from "@/assets/logo.png";

const footerLinks = [
  { label: "Markets", to: "/markets" },
  { label: "Trending", to: "/trending" },
  { label: "Leaderboard", to: "/leaderboard" },
  { label: "Resolved", to: "/resolved" },
];

const infoLinks = [
  { label: "About", to: "/about" },
  { label: "Rules", to: "/rules" },
  { label: "FAQ", to: "/faq" },
  { label: "Sources", to: "/sources" },
];

const categoryLinks = [
  { label: "Politics", to: "/categories/politics" },
  { label: "Economics", to: "/categories/economics" },
  { label: "Sports", to: "/categories/sports" },
  { label: "Local", to: "/categories/local" },
  { label: "International", to: "/categories/international" },
];

const Footer = () => (
  <footer className="border-t border-border/50 bg-card/30 py-10">
    <div className="container">
      <div className="grid gap-8 sm:grid-cols-4 mb-8">
        {/* Brand */}
        <div>
          <motion.div
            className="flex items-center gap-2.5 mb-3"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <img src={logoImg} alt="Pagaza" className="h-7 w-7 object-contain" />
            <GradientText className="font-display text-lg font-bold tracking-wider" animationSpeed={8}>
              PAGAZA
            </GradientText>
          </motion.div>
          <p className="text-xs text-muted-foreground">
            Kenya's prediction market platform. Forecast real-world outcomes with source-backed resolution.
          </p>
        </div>

        {/* Markets */}
        <div>
          <h4 className="font-display text-xs font-bold tracking-wider text-foreground mb-3">MARKETS</h4>
          <div className="flex flex-col gap-1.5">
            {footerLinks.map(l => (
              <Link key={l.to} to={l.to} className="text-xs text-muted-foreground hover:text-foreground transition-colors">{l.label}</Link>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div>
          <h4 className="font-display text-xs font-bold tracking-wider text-foreground mb-3">CATEGORIES</h4>
          <div className="flex flex-col gap-1.5">
            {categoryLinks.map(l => (
              <Link key={l.to} to={l.to} className="text-xs text-muted-foreground hover:text-foreground transition-colors">{l.label}</Link>
            ))}
          </div>
        </div>

        {/* Info */}
        <div>
          <h4 className="font-display text-xs font-bold tracking-wider text-foreground mb-3">PLATFORM</h4>
          <div className="flex flex-col gap-1.5">
            {infoLinks.map(l => (
              <Link key={l.to} to={l.to} className="text-xs text-muted-foreground hover:text-foreground transition-colors">{l.label}</Link>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-border/30 pt-6 flex items-center justify-between text-[11px] text-muted-foreground/60">
        <span>Built by <span className="text-accent font-semibold">LionByte Studios</span></span>
        <span>&copy; {new Date().getFullYear()} Pagaza</span>
      </div>
    </div>
  </footer>
);

export default Footer;
