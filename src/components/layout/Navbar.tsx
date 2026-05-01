import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useGuest } from "@/contexts/GuestContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Trophy, User, Menu, X, Home, Shield, Wallet, BarChart3 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import NotificationBell from "@/components/NotificationBell";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import WalletBalance from "@/components/WalletBalance";
import logoImg from "@/assets/logo.png";

const navLinks = [
  { to: "/", label: "Home", icon: Home },
  { to: "/markets", label: "Markets", icon: BarChart3 },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/dashboard", label: "Dashboard", icon: Wallet },
];

const Navbar = () => {
  const { user, signOut } = useAuth();
  const { isGuest } = useGuest();
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

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      className={`sticky top-0 z-50 border-b transition-all duration-300 ${
        scrolled
          ? "border-border/50 bg-background/90 backdrop-blur-xl shadow-sm"
          : "border-border/30 bg-background/60 backdrop-blur-md"
      }`}
    >
      <div className="container flex h-14 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <motion.img
            src={logoImg}
            alt="Pagaza"
            className="h-7 w-7 object-contain"
            whileHover={{ rotate: 10, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 300 }}
          />
          <span className="font-display text-lg font-bold tracking-wider text-foreground">
            PAGAZA
          </span>
        </Link>

        {/* Desktop nav — admin link removed from public surface */}
        <div className="hidden items-center gap-0.5 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors rounded-md ${
                isActive(link.to)
                  ? "text-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
              {isActive(link.to) && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </Link>
          ))}

          <div className="h-5 w-px bg-border mx-1" />
          {user && <WalletBalance />}
          {user && <NotificationBell />}
          <ThemeToggle />

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="ml-1 h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                  <User className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs">Account</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate(`/profile/${user.id}`)} className="cursor-pointer">
                  <User className="h-4 w-4 mr-2" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/wallet")} className="cursor-pointer">
                  <Wallet className="h-4 w-4 mr-2" /> Wallet
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/admin")} className="cursor-pointer text-primary">
                      <Shield className="h-4 w-4 mr-2" /> Control Room
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={() => navigate("/auth")} size="sm" className="ml-1 neon-glow h-8">
              Sign In
            </Button>
          )}
        </div>

        {/* Mobile toggle */}
        <div className="flex items-center gap-1 md:hidden">
          {user && <WalletBalance />}
          {user && <NotificationBell />}
          <button className="text-foreground p-2" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border/50 bg-background/95 backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col gap-1 p-3">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive(link.to) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              ))}
              {user ? (
                <>
                  <div className="my-1 h-px bg-border/50" />
                  <Link
                    to={`/profile/${user.id}`}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted/50"
                  >
                    <User className="h-4 w-4" />Profile
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-primary hover:bg-primary/10"
                    >
                      <Shield className="h-4 w-4" />Control Room
                    </Link>
                  )}
                  <button
                    onClick={() => { handleSignOut(); setMobileOpen(false); }}
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" />Sign Out
                  </button>
                </>
              ) : (
                <Button onClick={() => { navigate("/auth"); setMobileOpen(false); }} className="mt-1 neon-glow">
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
