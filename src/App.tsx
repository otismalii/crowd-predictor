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
import InstallBanner from "@/components/InstallBanner";
import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense, forwardRef } from "react";
import { Navigate, useParams } from "react-router-dom";
import PageLoader from "@/components/PageLoader";
import { PlayerRoute, AdminRoute } from "@/routes/route-guards";
import OfflineIndicator from "@/components/OfflineIndicator";

const MarketAliasRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/markets/${id}`} replace />;
};

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
const Watchlist = lazy(() => import("./pages/Watchlist"));

// Lazy loads — admin
const AdminLayout = lazy(() => import("./components/admin/shell/AdminLayout"));
const AdminOverviewPage = lazy(() => import("./pages/admin/AdminOverviewPage"));
const AdminMarketsPage = lazy(() => import("./pages/admin/AdminMarketsPage"));
const AdminMarketsNewPage = lazy(() => import("./pages/admin/AdminMarketsNewPage"));
const AdminResolutionPage = lazy(() => import("./pages/admin/AdminResolutionPage"));
const AdminAnalyticsPage = lazy(() => import("./pages/admin/AdminAnalyticsPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminTreasuryPage = lazy(() => import("./pages/admin/AdminTreasuryPage"));
const AdminFraudPage = lazy(() => import("./pages/admin/AdminFraudPage"));
const AdminAuditPage = lazy(() => import("./pages/admin/AdminAuditPage"));
const AdminReconciliationPage = lazy(() => import("./pages/admin/AdminReconciliationPage"));
const AdminEventStreamPage = lazy(() => import("./pages/admin/AdminEventStreamPage"));
const AdminLiquidityPage = lazy(() => import("./pages/admin/AdminLiquidityPage"));
const AdminSourcesPage = lazy(() => import("./pages/admin/AdminSourcesPage"));
const AdminDisputesPage = lazy(() => import("./pages/admin/AdminDisputesPage"));
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage"));

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

const AnimatedPage = forwardRef<HTMLDivElement, { children: React.ReactNode }>(({ children }, ref) => (
  <motion.div
    ref={ref}
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
));
AnimatedPage.displayName = "AnimatedPage";

const AnimatedRoutes = () => {
  const location = useLocation();
  const isAuthPage = location.pathname === "/auth" || location.pathname === "/reset-password";
  const isAdminPage = location.pathname.startsWith("/admin");

  return (
    <>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          {/* ========== PUBLIC ========== */}
          <Route path="/" element={<AnimatedPage><Feed /></AnimatedPage>} />
          <Route path="/markets" element={<AnimatedPage><Markets /></AnimatedPage>} />
          <Route path="/markets/:id" element={<AnimatedPage><MarketDetail /></AnimatedPage>} />
          <Route path="/market/:id" element={<MarketAliasRedirect />} />
          <Route path="/leaderboard" element={<AnimatedPage><Leaderboard /></AnimatedPage>} />
          <Route path="/rules" element={<AnimatedPage><Rules /></AnimatedPage>} />
          <Route path="/sources" element={<AnimatedPage><Sources /></AnimatedPage>} />

          {/* ========== AUTH ========== */}
          <Route path="/auth" element={<AnimatedPage><Auth /></AnimatedPage>} />
          <Route path="/reset-password" element={<AnimatedPage><ResetPassword /></AnimatedPage>} />

          {/* ========== PLAYER ========== */}
          <Route path="/dashboard" element={<AnimatedPage><PlayerRoute><PlayerDashboard /></PlayerRoute></AnimatedPage>} />
          <Route path="/portfolio" element={<AnimatedPage><PlayerRoute><Portfolio /></PlayerRoute></AnimatedPage>} />
          <Route path="/activity" element={<AnimatedPage><PlayerRoute><PlayerActivity /></PlayerRoute></AnimatedPage>} />
          <Route path="/profile/:id" element={<AnimatedPage><Profile /></AnimatedPage>} />
          <Route path="/wallet" element={<AnimatedPage><PlayerRoute><Wallet /></PlayerRoute></AnimatedPage>} />
          <Route path="/watchlist" element={<AnimatedPage><PlayerRoute><Watchlist /></PlayerRoute></AnimatedPage>} />

          {/* ========== ADMIN (guarded by AdminRoute, shared shell via Outlet) ========== */}
          <Route path="/admin" element={<AdminRoute><Suspense fallback={<PageLoader />}><AdminLayout /></Suspense></AdminRoute>}>
            <Route index element={<Suspense fallback={<PageLoader />}><AdminOverviewPage /></Suspense>} />
            <Route path="operations/events" element={<Suspense fallback={<PageLoader />}><AdminEventStreamPage /></Suspense>} />
            <Route path="markets" element={<Suspense fallback={<PageLoader />}><AdminMarketsPage /></Suspense>} />
            <Route path="markets/new" element={<Suspense fallback={<PageLoader />}><AdminMarketsNewPage /></Suspense>} />
            <Route path="markets/resolution" element={<Suspense fallback={<PageLoader />}><AdminResolutionPage /></Suspense>} />
            <Route path="markets/liquidity" element={<Suspense fallback={<PageLoader />}><AdminLiquidityPage /></Suspense>} />
            <Route path="markets/sources" element={<Suspense fallback={<PageLoader />}><AdminSourcesPage /></Suspense>} />
            <Route path="finance/treasury" element={<Suspense fallback={<PageLoader />}><AdminTreasuryPage /></Suspense>} />
            <Route path="finance/reconciliation" element={<Suspense fallback={<PageLoader />}><AdminReconciliationPage /></Suspense>} />
            <Route path="risk/fraud" element={<Suspense fallback={<PageLoader />}><AdminFraudPage /></Suspense>} />
            <Route path="risk/disputes" element={<Suspense fallback={<PageLoader />}><AdminDisputesPage /></Suspense>} />
            <Route path="risk/users" element={<Suspense fallback={<PageLoader />}><AdminUsersPage /></Suspense>} />
            <Route path="system/audit" element={<Suspense fallback={<PageLoader />}><AdminAuditPage /></Suspense>} />
            <Route path="system/analytics" element={<Suspense fallback={<PageLoader />}><AdminAnalyticsPage /></Suspense>} />
            <Route path="system/settings" element={<Suspense fallback={<PageLoader />}><AdminSettingsPage /></Suspense>} />
          </Route>

          {/* Admin legacy redirects — preserve old bookmarks */}
          <Route path="/admin/treasury" element={<Navigate to="/admin/finance/treasury" replace />} />
          <Route path="/admin/reconciliation" element={<Navigate to="/admin/finance/reconciliation" replace />} />
          <Route path="/admin/fraud" element={<Navigate to="/admin/risk/fraud" replace />} />
          <Route path="/admin/users" element={<Navigate to="/admin/risk/users" replace />} />
          <Route path="/admin/resolution" element={<Navigate to="/admin/markets/resolution" replace />} />
          <Route path="/admin/liquidity" element={<Navigate to="/admin/markets/liquidity" replace />} />
          <Route path="/admin/audit" element={<Navigate to="/admin/system/audit" replace />} />
          <Route path="/admin/analytics" element={<Navigate to="/admin/system/analytics" replace />} />
          <Route path="/admin/events" element={<Navigate to="/admin/operations/events" replace />} />

          {/* ========== LEGACY REDIRECTS (kept for inbound links / shares) ========== */}
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
      {!isAuthPage && !isAdminPage && <MobileNav />}
      <InstallBanner />
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
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AuthProvider>
              <GuestProvider>
                <OfflineIndicator />
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