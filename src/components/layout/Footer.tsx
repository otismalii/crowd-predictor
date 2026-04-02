import { Link } from "react-router-dom";
import logoImg from "@/assets/logo.png";

const footerLinks = [
  { label: "Markets", to: "/markets" },
  { label: "Leaderboard", to: "/leaderboard" },
  { label: "Dashboard", to: "/dashboard" },
];

const infoLinks = [
  { label: "Rules", to: "/rules" },
  { label: "Sources", to: "/sources" },
];

const Footer = () => (
  <footer className="border-t border-border/50 bg-card/30 py-10">
    <div className="container">
      <div className="grid gap-8 sm:grid-cols-3 mb-8">
        {/* Brand */}
        <div>
          <div className="flex items-center gap-2.5 mb-3">
            <img src={logoImg} alt="Pagaza" className="h-7 w-7 object-contain" />
            <span className="font-display text-lg font-bold tracking-wider text-primary">PAGAZA</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Kenya's prediction market platform. Forecast real-world outcomes with source-backed resolution.
          </p>
        </div>

        {/* Markets */}
        <div>
          <h4 className="font-display text-xs font-bold tracking-wider text-foreground mb-3">NAVIGATE</h4>
          <div className="flex flex-col gap-1.5">
            {footerLinks.map(l => (
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
