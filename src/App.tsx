import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { GuestProvider } from "@/contexts/GuestContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { HelmetProvider } from "react-helmet-async";
import ErrorBoundary from "@/components/ErrorBoundary";
import MobileNav from "@/components/layout/MobileNav";
import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";
import PageLoader from "@/components/PageLoader";

// Eager loads — critical path
import Feed from "./pages/Feed";
import Auth from "./pages/Auth";

// Lazy loads — public
const Markets = lazy(() => import("./pages/Markets"));
const MarketDetail = lazy(() => import("./pages/MarketDetail"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Rules = lazy(() => import("./pages/Rules"));
const Sources = lazy(() => import("./pages/Sources"));

// Lazy loads — auth
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

// Lazy loads — player
const PlayerDashboard = lazy(() => import("./pages/player/Dashboard"));
const PlayerActivity = lazy(() => import("./pages/player/Activity"));
const Profile = lazy(() => import("./pages/Profile"));
const Wallet = lazy(() => import("./pages/Wallet"));
const Portfolio = lazy(() => import("./pages/Portfolio"));

// Lazy loads — admin
const AdminOverviewPage = lazy(() => import("./pages/admin/AdminOverviewPage"));
const AdminMarketsPage = lazy(() => import("./pages/admin/AdminMarketsPage"));
const AdminMarketsNewPage = lazy(() => import("./pages/admin/AdminMarketsNewPage"));
const AdminResolutionPage = lazy(() => import("./pages/admin/AdminResolutionPage"));
const AdminBotsPage = lazy(() => import("./pages/admin/AdminBotsPage"));
const AdminAnalyticsPage = lazy(() => import("./pages/admin/AdminAnalyticsPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminUploadsPage = lazy(() => import("./pages/admin/AdminUploadsPage"));
const AdminCollaborationsPage = lazy(() => import("./pages/admin/AdminCollaborationsPage"));

// Lazy loads — misc
const NotFound = lazy(() => import("./pages/NotFound"));

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
          {/* ========== PUBLIC ========== */}
          <Route path="/" element={<AnimatedPage><Feed /></AnimatedPage>} />
          <Route path="/markets" element={<AnimatedPage><Markets /></AnimatedPage>} />
          <Route path="/markets/:id" element={<AnimatedPage><MarketDetail /></AnimatedPage>} />
          {/* Legacy route */}
          <Route path="/market/:id" element={<AnimatedPage><MarketDetail /></AnimatedPage>} />
          <Route path="/leaderboard" element={<AnimatedPage><Leaderboard /></AnimatedPage>} />
          <Route path="/rules" element={<AnimatedPage><Rules /></AnimatedPage>} />
          <Route path="/sources" element={<AnimatedPage><Sources /></AnimatedPage>} />

          {/* ========== AUTH ========== */}
          <Route path="/auth" element={<AnimatedPage><Auth /></AnimatedPage>} />
          <Route path="/reset-password" element={<AnimatedPage><ResetPassword /></AnimatedPage>} />

          {/* ========== PLAYER ========== */}
          <Route path="/dashboard" element={<AnimatedPage><PlayerDashboard /></AnimatedPage>} />
          <Route path="/portfolio" element={<AnimatedPage><Portfolio /></AnimatedPage>} />
          <Route path="/activity" element={<AnimatedPage><PlayerActivity /></AnimatedPage>} />
          <Route path="/profile/:id" element={<AnimatedPage><Profile /></AnimatedPage>} />
          <Route path="/wallet" element={<AnimatedPage><Wallet /></AnimatedPage>} />

          {/* ========== ADMIN ========== */}
          <Route path="/admin" element={<AnimatedPage><AdminOverviewPage /></AnimatedPage>} />
          <Route path="/admin/markets" element={<AnimatedPage><AdminMarketsPage /></AnimatedPage>} />
          <Route path="/admin/markets/new" element={<AnimatedPage><AdminMarketsNewPage /></AnimatedPage>} />
          <Route path="/admin/resolution" element={<AnimatedPage><AdminResolutionPage /></AnimatedPage>} />
          <Route path="/admin/bots" element={<AnimatedPage><AdminBotsPage /></AnimatedPage>} />
          <Route path="/admin/analytics" element={<AnimatedPage><AdminAnalyticsPage /></AnimatedPage>} />
          <Route path="/admin/users" element={<AnimatedPage><AdminUsersPage /></AnimatedPage>} />
          <Route path="/admin/uploads" element={<AnimatedPage><AdminUploadsPage /></AnimatedPage>} />
          <Route path="/admin/collaborations" element={<AnimatedPage><AdminCollaborationsPage /></AnimatedPage>} />

          {/* ========== REDIRECTS ========== */}
          <Route path="/trending" element={<Navigate to="/markets?sort=trending" replace />} />
          <Route path="/closing-soon" element={<Navigate to="/markets?sort=closing" replace />} />
          <Route path="/resolved" element={<Navigate to="/markets?filter=resolved" replace />} />
          <Route path="/categories/:slug" element={<Navigate to="/markets" replace />} />
          <Route path="/faq" element={<Navigate to="/rules" replace />} />
          <Route path="/about" element={<Navigate to="/rules" replace />} />
          <Route path="/challenges" element={<Navigate to="/leaderboard" replace />} />

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
