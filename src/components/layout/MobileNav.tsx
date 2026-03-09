import { Link, useLocation } from "react-router-dom";
import { Home, Swords, Trophy, Wallet, PieChart } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

const tabs = [
  { to: "/", label: "Markets", icon: Home },
  { to: "/portfolio", label: "Portfolio", icon: PieChart },
  { to: "/challenges", label: "Bets", icon: Swords },
  { to: "/leaderboard", label: "Ranks", icon: Trophy },
  { to: "/wallet", label: "Wallet", icon: Wallet },
];

const MobileNav = () => {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/95 backdrop-blur-xl md:hidden safe-area-bottom">
      <div className="flex items-center justify-around px-1 py-1">
        {tabs.map((tab) => {
          const isActive = tab.to === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(tab.to);

          return (
            <Link
              key={tab.to}
              to={!user && tab.to !== "/" && tab.to !== "/leaderboard" ? "/auth" : tab.to}
              className="relative flex flex-col items-center justify-center min-w-0 flex-1 py-2 px-1 group"
            >
              {isActive && (
                <motion.div
                  layoutId="mobile-nav-indicator"
                  className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <motion.div
                whileTap={{ scale: 0.85 }}
                className={`flex items-center justify-center h-8 w-8 rounded-xl transition-colors ${
                  isActive ? "bg-primary/10" : "group-active:bg-muted/50"
                }`}
              >
                <tab.icon className={`h-[18px] w-[18px] transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`} />
              </motion.div>
              <span className={`text-[10px] font-medium mt-0.5 transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;
