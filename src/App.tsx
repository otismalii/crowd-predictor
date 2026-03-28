import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { GuestProvider } from "@/contexts/GuestContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { HelmetProvider } from "react-helmet-async";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import MobileNav from "@/components/layout/MobileNav";
import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";
import PageLoader from "@/components/PageLoader";

// Eager loads
import Feed from "./pages/Feed";
import Auth from "./pages/Auth";

// Lazy loads for non-critical pages
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Profile = lazy(() => import("./pages/Profile"));
const Admin = lazy(() => import("./pages/Admin"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Challenges = lazy(() => import("./pages/Challenges"));
const Wallet = lazy(() => import("./pages/Wallet"));
const MarketDetail = lazy(() => import("./pages/MarketDetail"));
const Markets = lazy(() => import("./pages/Markets"));
const CategoryPage = lazy(() => import("./pages/CategoryPage"));
const Trending = lazy(() => import("./pages/Trending"));
const ClosingSoon = lazy(() => import("./pages/ClosingSoon"));
const Resolved = lazy(() => import("./pages/Resolved"));
const Rules = lazy(() => import("./pages/Rules"));
const FAQ = lazy(() => import("./pages/FAQ"));
const About = lazy(() => import("./pages/About"));
const Sources = lazy(() => import("./pages/Sources"));

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
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
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
          {/* Core */}
          <Route path="/" element={<AnimatedPage><Feed /></AnimatedPage>} />
          <Route path="/auth" element={<AnimatedPage><Auth /></AnimatedPage>} />
          <Route path="/reset-password" element={<AnimatedPage><ResetPassword /></AnimatedPage>} />
          
          {/* Markets */}
          <Route path="/markets" element={<AnimatedPage><Markets /></AnimatedPage>} />
          <Route path="/market/:id" element={<AnimatedPage><MarketDetail /></AnimatedPage>} />
          <Route path="/categories/:slug" element={<AnimatedPage><CategoryPage /></AnimatedPage>} />
          <Route path="/trending" element={<AnimatedPage><Trending /></AnimatedPage>} />
          <Route path="/closing-soon" element={<AnimatedPage><ClosingSoon /></AnimatedPage>} />
          <Route path="/resolved" element={<AnimatedPage><Resolved /></AnimatedPage>} />
          
          {/* Community */}
          <Route path="/leaderboard" element={<AnimatedPage><Leaderboard /></AnimatedPage>} />
          <Route path="/profile/:id" element={<AnimatedPage><Profile /></AnimatedPage>} />
          <Route path="/challenges" element={<AnimatedPage><Challenges /></AnimatedPage>} />
          
          {/* User */}
          <Route path="/wallet" element={<AnimatedPage><Wallet /></AnimatedPage>} />
          <Route path="/portfolio" element={<Navigate to="/wallet" replace />} />
          
          {/* Info */}
          <Route path="/rules" element={<AnimatedPage><Rules /></AnimatedPage>} />
          <Route path="/faq" element={<AnimatedPage><FAQ /></AnimatedPage>} />
          <Route path="/about" element={<AnimatedPage><About /></AnimatedPage>} />
          <Route path="/sources" element={<AnimatedPage><Sources /></AnimatedPage>} />
          
          {/* Admin */}
          <Route path="/admin" element={<AnimatedPage><ProtectedRoute><Admin /></ProtectedRoute></AnimatedPage>} />
          
          <Route path="*" element={<AnimatedPage><NotFound /></AnimatedPage>} />
        </Routes>
      </AnimatePresence>
      {!isAuthPage && <MobileNav />}
    </>
  );
};

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <GuestProvider>
                <AnimatedRoutes />
              </GuestProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
