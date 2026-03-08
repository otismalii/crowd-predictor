import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Trophy, User, Zap, Menu, X, Home, Shield } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Magnet from "@/components/reactbits/Magnet";
import GradientText from "@/components/reactbits/GradientText";

const navLinks = [
  { to: "/", label: "Feed", icon: Home },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
];

const Navbar = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      setIsAdmin(data === true);
    });
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const isActive = (path: string) => location.pathname === path;
  const allLinks = isAdmin ? [...navLinks, { to: "/admin", label: "Admin", icon: Shield }] : navLinks;

  return (
    <nav
      className={`sticky top-0 z-50 border-b transition-all duration-300 ${
        scrolled
          ? "border-border/50 bg-background/90 backdrop-blur-xl shadow-[0_1px_10px_hsl(var(--primary)/0.05)]"
          : "border-border/30 bg-background/60 backdrop-blur-md"
      }`}
    >
      <div className="container flex h-16 items-center justify-between">
        <Magnet padding={40} magnetStrength={4}>
          <Link to="/" className="flex items-center gap-2 group">
            <motion.div
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.4 }}
            >
              <Zap className="h-6 w-6 text-primary" />
            </motion.div>
            <GradientText
              className="font-display text-xl font-bold tracking-wider"
              animationSpeed={4}
              colors={["hsl(120, 100%, 55%)", "hsl(50, 100%, 50%)", "hsl(142, 72%, 38%)", "hsl(120, 100%, 55%)"]}
            >
              PAGAZABETZ
            </GradientText>
          </Link>
        </Magnet>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 md:flex">
          {allLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`relative flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors rounded-lg ${
                isActive(link.to)
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
              {isActive(link.to) && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full"
                  style={{ boxShadow: "0 0 8px hsl(var(--primary) / 0.5)" }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </Link>
          ))}

          <ThemeToggle />
          <div className="h-6 w-px bg-border" />

          {user ? (
            <div className="flex items-center gap-1 ml-2">
              <Link
                to={`/profile/${user.id}`}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  location.pathname.startsWith("/profile")
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <User className="h-4 w-4" />
                Profile
              </Link>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-destructive">
                  <LogOut className="h-4 w-4" />
                </Button>
              </motion.div>
            </div>
          ) : (
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button onClick={() => navigate("/auth")} size="sm" className="ml-2 neon-glow">
                Sign In
              </Button>
            </motion.div>
          )}
        </div>

        {/* Mobile toggle */}
        <motion.button
          className="md:hidden text-foreground p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          whileTap={{ scale: 0.9 }}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </motion.button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden border-t border-border/50 bg-background/95 backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col gap-1 p-4">
              {allLinks.map((link, i) => (
                <motion.div
                  key={link.to}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    to={link.to}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive(link.to) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                </motion.div>
              ))}
              {user ? (
                <>
                  <Link
                    to={`/profile/${user.id}`}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted/50"
                  >
                    <User className="h-4 w-4" />Profile
                  </Link>
                  <button
                    onClick={() => { handleSignOut(); setMobileOpen(false); }}
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" />Sign Out
                  </button>
                </>
              ) : (
                <Button onClick={() => { navigate("/auth"); setMobileOpen(false); }} className="mt-2 neon-glow">
                  Sign In
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
