import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, Trophy, User, Zap, Menu, X } from "lucide-react";
import { useState } from "react";

const Navbar = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/90 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" />
          <span className="font-display text-xl font-bold tracking-wider text-primary neon-text">
            PAGAZABETZ
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 md:flex">
          {user ? (
            <>
              <Link to="/feed" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                Feed
              </Link>
              <Link to="/leaderboard" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                <Trophy className="inline-block mr-1 h-4 w-4" />Leaderboard
              </Link>
              <Link to={`/profile/${user.id}`} className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                <User className="inline-block mr-1 h-4 w-4" />Profile
              </Link>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button onClick={() => navigate("/auth")} className="neon-glow">
              Get Started
            </Button>
          )}
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-border/50 bg-background p-4 md:hidden">
          {user ? (
            <div className="flex flex-col gap-3">
              <Link to="/feed" className="text-sm text-muted-foreground hover:text-primary" onClick={() => setMobileOpen(false)}>Feed</Link>
              <Link to="/leaderboard" className="text-sm text-muted-foreground hover:text-primary" onClick={() => setMobileOpen(false)}>Leaderboard</Link>
              <Link to={`/profile/${user.id}`} className="text-sm text-muted-foreground hover:text-primary" onClick={() => setMobileOpen(false)}>Profile</Link>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>Sign Out</Button>
            </div>
          ) : (
            <Button onClick={() => { navigate("/auth"); setMobileOpen(false); }} className="w-full neon-glow">Get Started</Button>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
