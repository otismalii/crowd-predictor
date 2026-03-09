import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import GradientText from "@/components/reactbits/GradientText";
import Aurora from "@/components/reactbits/Aurora";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const NotFound = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="relative flex items-center justify-center min-h-[70vh] px-4 overflow-hidden">
        <Aurora />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative text-center max-w-sm space-y-6"
        >
          <motion.h1
            className="font-display text-8xl font-bold"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            <GradientText>404</GradientText>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-2"
          >
            <p className="text-lg font-display font-bold text-foreground">Page not found</p>
            <p className="text-sm text-muted-foreground">
              The page <code className="text-xs px-1.5 py-0.5 rounded bg-muted">{location.pathname}</code> doesn't exist.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center justify-center gap-3"
          >
            <Link to="/">
              <Button className="neon-glow gap-1.5">
                <Home className="h-4 w-4" /> Markets
              </Button>
            </Link>
            <Link to="/leaderboard">
              <Button variant="outline" className="gap-1.5">
                <Search className="h-4 w-4" /> Leaderboard
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </div>
      <Footer />
    </div>
  );
};

export default NotFound;
