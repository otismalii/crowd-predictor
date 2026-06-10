import { Link, useLocation } from "react-router-dom";
import { Home, BarChart3, Wallet, Briefcase, User } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

const MobileNav = () => {
  const location = useLocation();
  const { user } = useAuth();

  const tabs = [
    { to: "/", label: "Home", icon: Home },
    { to: "/markets", label: "Markets", icon: BarChart3 },
    { to: "/portfolio", label: "Portfolio", icon: Briefcase },
    { to: "/wallet", label: "Wallet", icon: Wallet },
    { to: user ? `/profile/${user.id}` : "/auth", label: user ? "Profile" : "Sign in", icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/95 backdrop-blur-xl md:hidden safe-area-bottom">
      <div className="flex items-center justify-around px-1 py-1">
        {tabs.map((tab) => {
          const base = tab.to.split("?")[0];
          const isActive = base === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(base.split("/").slice(0, 2).join("/"));

          return (
            <Link
              key={tab.label}
              to={tab.to}
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
