import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import MobileNav from "@/components/layout/MobileNav";
import { AnimatePresence, motion } from "framer-motion";
import Feed from "./pages/Feed";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Leaderboard from "./pages/Leaderboard";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import Challenges from "./pages/Challenges";
import Wallet from "./pages/Wallet";
import MarketDetail from "./pages/MarketDetail";
import Portfolio from "./pages/Portfolio";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const pageTransition = {
  duration: 0.2,
  ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
};

const AnimatedPage = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    variants={pageVariants}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={pageTransition}
  >
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  </motion.div>
);

const AnimatedRoutes = () => {
  const location = useLocation();
  const isAuthPage = location.pathname === "/auth" || location.pathname === "/reset-password";

  return (
    <>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<AnimatedPage><Feed /></AnimatedPage>} />
          <Route path="/auth" element={<AnimatedPage><Auth /></AnimatedPage>} />
          <Route path="/reset-password" element={<AnimatedPage><ResetPassword /></AnimatedPage>} />
          <Route path="/market/:id" element={<AnimatedPage><MarketDetail /></AnimatedPage>} />
          <Route path="/leaderboard" element={<AnimatedPage><Leaderboard /></AnimatedPage>} />
          <Route path="/profile/:id" element={<AnimatedPage><Profile /></AnimatedPage>} />
          <Route path="/challenges" element={<AnimatedPage><Challenges /></AnimatedPage>} />
          <Route path="/wallet" element={<AnimatedPage><Wallet /></AnimatedPage>} />
          <Route path="/portfolio" element={<AnimatedPage><Portfolio /></AnimatedPage>} />
          <Route path="/admin" element={<AnimatedPage><ProtectedRoute><Admin /></ProtectedRoute></AnimatedPage>} />
          <Route path="*" element={<AnimatedPage><NotFound /></AnimatedPage>} />
        </Routes>
      </AnimatePresence>
      {/* Mobile bottom nav - hidden on auth pages */}
      {!isAuthPage && <MobileNav />}
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AnimatedRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
