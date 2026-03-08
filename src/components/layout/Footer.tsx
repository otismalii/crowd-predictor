import { Zap } from "lucide-react";

const Footer = () => (
  <footer className="border-t border-border/50 bg-background/50 py-8">
    <div className="container flex flex-col items-center gap-4 text-center">
      <div className="flex items-center gap-2">
        <Zap className="h-5 w-5 text-primary" />
        <span className="font-display text-lg font-bold tracking-wider text-primary">PAGAZABETZ</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Built by <span className="text-accent font-semibold">LionByte Studios</span>
      </p>
      <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} PagazaBetz. All rights reserved.</p>
    </div>
  </footer>
);

export default Footer;
