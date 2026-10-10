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
import PopIt from "./pages/casino/PopIt";
import OfflineIndicator from "@/components/OfflineIndicator";
import { BetSlipProvider } from "@/contexts/BetSlipContext";
import BetSlipDrawer from "@/components/sportsbook/BetSlipDrawer";

const MarketAliasRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/match/${id}`} replace />;
};


// Eager loads — critical path
import Sportsbook from "./pages/Sportsbook";
import Auth from "./pages/Auth";

// Lazy loads — public sportsbook
const MatchDetail = lazy(() => import("./pages/MatchDetail"));
const MyBets = lazy(() => import("./pages/MyBets"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Rules = lazy(() => import("./pages/Rules"));


// Lazy loads — auth
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));

// Lazy loads — player
const Profile = lazy(() => import("./pages/Profile"));
const Wallet = lazy(() => import("./pages/Wallet"));

// Lazy loads — admin
const AdminLayout = lazy(() => import("./components/admin/shell/AdminLayout"));
const AdminOverviewPage = lazy(() => import("./pages/admin/AdminOverviewPage"));
const AdminInboxPage = lazy(() => import("./pages/admin/AdminInboxPage"));
const AdminTodayPage = lazy(() => import("./pages/admin/AdminTodayPage"));
const AdminAnalyticsPage = lazy(() => import("./pages/admin/AdminAnalyticsPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminTreasuryPage = lazy(() => import("./pages/admin/AdminTreasuryPage"));
const AdminFraudPage = lazy(() => import("./pages/admin/AdminFraudPage"));
const AdminAuditPage = lazy(() => import("./pages/admin/AdminAuditPage"));
const AdminReconciliationPage = lazy(() => import("./pages/admin/AdminReconciliationPage"));
const AdminEventStreamPage = lazy(() => import("./pages/admin/AdminEventStreamPage"));
const AdminSourcesPage = lazy(() => import("./pages/admin/AdminSourcesPage"));
const AdminDisputesPage = lazy(() => import("./pages/admin/AdminDisputesPage"));
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage"));
const AdminSettlementsPage = lazy(() => import("./pages/admin/AdminSettlementsPage"));
const AdminIntelligenceInsightsPage = lazy(() => import("./pages/admin/AdminIntelligenceInsightsPage"));
const AdminRiskSignalsPage = lazy(() => import("./pages/admin/AdminRiskSignalsPage"));
const AdminPromotionsPage = lazy(() => import("./pages/admin/AdminPromotionsPage"));
const AdminAutomationPage = lazy(() => import("./pages/admin/AdminAutomationPage"));

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
  const isAuthPage =
    location.pathname === "/auth" ||
    location.pathname === "/reset-password" ||
    location.pathname.startsWith("/.lovable/");
  const isAdminPage = location.pathname.startsWith("/admin");

  return (
    <>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          {/* ========== PUBLIC SPORTSBOOK ========== */}
          <Route path="/" element={<AnimatedPage><Sportsbook /></AnimatedPage>} />
          <Route path="/sports" element={<AnimatedPage><Sportsbook /></AnimatedPage>} />
          <Route path="/sports/:competitionSlug" element={<AnimatedPage><Sportsbook /></AnimatedPage>} />
          <Route path="/match/:id" element={<AnimatedPage><MatchDetail /></AnimatedPage>} />
          <Route path="/crash" element={<AnimatedPage><PopIt /></AnimatedPage>} />
          <Route path="/casino" element={<Navigate to="/crash" replace />} />
          <Route path="/live" element={<Navigate to="/sports?live=1" replace />} />
          <Route path="/dashboard" element={<Navigate to="/my-bets" replace />} />
          <Route path="/activity" element={<Navigate to="/my-bets" replace />} />
          <Route path="/my-bets" element={<AnimatedPage><PlayerRoute><MyBets /></PlayerRoute></AnimatedPage>} />
          <Route path="/leaderboard" element={<AnimatedPage><Leaderboard /></AnimatedPage>} />
          <Route path="/rules" element={<AnimatedPage><Rules /></AnimatedPage>} />
          <Route path="/markets" element={<Navigate to="/sports" replace />} />
          <Route path="/markets/:id" element={<Navigate to="/sports" replace />} />
          <Route path="/portfolio" element={<Navigate to="/my-bets" replace />} />
          <Route path="/watchlist" element={<Navigate to="/sports" replace />} />
          <Route path="/creator" element={<Navigate to="/sports" replace />} />
          <Route path="/sources" element={<Navigate to="/rules" replace />} />


          {/* ========== AUTH ========== */}
          <Route path="/auth" element={<AnimatedPage><Auth /></AnimatedPage>} />
          <Route path="/reset-password" element={<AnimatedPage><ResetPassword /></AnimatedPage>} />
          <Route path="/.lovable/oauth/consent" element={<AnimatedPage><OAuthConsent /></AnimatedPage>} />

          {/* ========== PLAYER ========== */}
          <Route path="/profile/:id" element={<AnimatedPage><Profile /></AnimatedPage>} />
          <Route path="/wallet" element={<AnimatedPage><PlayerRoute><Wallet /></PlayerRoute></AnimatedPage>} />

          {/* ========== ADMIN (v4 LDX: 6 domains) ========== */}
          <Route path="/admin" element={<AdminRoute><Suspense fallback={<PageLoader />}><AdminLayout /></Suspense></AdminRoute>}>
            <Route index element={<Suspense fallback={<PageLoader />}><AdminOverviewPage /></Suspense>} />

            {/* Workspace */}
            <Route path="inbox" element={<Suspense fallback={<PageLoader />}><AdminInboxPage /></Suspense>} />
            <Route path="today" element={<Suspense fallback={<PageLoader />}><AdminTodayPage /></Suspense>} />

            {/* Operations */}
            <Route path="operations/events" element={<Suspense fallback={<PageLoader />}><AdminEventStreamPage /></Suspense>} />

            {/* Markets */}
            <Route path="markets/*" element={<Navigate to="/admin/finance/settlements" replace />} />
            <Route path="markets" element={<Navigate to="/admin/finance/settlements" replace />} />
            <Route path="markets/sources" element={<Suspense fallback={<PageLoader />}><AdminSourcesPage /></Suspense>} />

            {/* Finance */}
            <Route path="finance/treasury" element={<Suspense fallback={<PageLoader />}><AdminTreasuryPage /></Suspense>} />
            <Route path="finance/settlements" element={<Suspense fallback={<PageLoader />}><AdminSettlementsPage /></Suspense>} />
            <Route path="finance/reconciliation" element={<Suspense fallback={<PageLoader />}><AdminReconciliationPage /></Suspense>} />

            {/* Intelligence */}
            <Route path="intelligence/insights" element={<Suspense fallback={<PageLoader />}><AdminIntelligenceInsightsPage /></Suspense>} />
            <Route path="intelligence/sources" element={<Suspense fallback={<PageLoader />}><AdminSourcesPage /></Suspense>} />
            <Route path="intelligence/risk" element={<Suspense fallback={<PageLoader />}><AdminRiskSignalsPage /></Suspense>} />

            {/* Governance */}
            <Route path="governance/users" element={<Suspense fallback={<PageLoader />}><AdminUsersPage /></Suspense>} />
            <Route path="governance/promotions" element={<Suspense fallback={<PageLoader />}><AdminPromotionsPage /></Suspense>} />
            <Route path="governance/disputes" element={<Suspense fallback={<PageLoader />}><AdminDisputesPage /></Suspense>} />
            <Route path="governance/fraud" element={<Suspense fallback={<PageLoader />}><AdminFraudPage /></Suspense>} />

            {/* Audit */}
            <Route path="audit/logs" element={<Suspense fallback={<PageLoader />}><AdminAuditPage /></Suspense>} />
            <Route path="audit/system" element={<Suspense fallback={<PageLoader />}><AdminAnalyticsPage /></Suspense>} />
            <Route path="audit/automation" element={<Suspense fallback={<PageLoader />}><AdminAutomationPage /></Suspense>} />
            <Route path="audit/settings" element={<Suspense fallback={<PageLoader />}><AdminSettingsPage /></Suspense>} />
          </Route>

          {/* Legacy admin redirects (preserve old bookmarks) */}
          <Route path="/admin/treasury" element={<Navigate to="/admin/finance/treasury" replace />} />
          <Route path="/admin/reconciliation" element={<Navigate to="/admin/finance/reconciliation" replace />} />
          <Route path="/admin/fraud" element={<Navigate to="/admin/governance/fraud" replace />} />
          <Route path="/admin/risk/fraud" element={<Navigate to="/admin/governance/fraud" replace />} />
          <Route path="/admin/risk/disputes" element={<Navigate to="/admin/governance/disputes" replace />} />
          <Route path="/admin/risk/users" element={<Navigate to="/admin/governance/users" replace />} />
          <Route path="/admin/users" element={<Navigate to="/admin/governance/users" replace />} />
          <Route path="/admin/resolution" element={<Navigate to="/admin/finance/settlements" replace />} />
          <Route path="/admin/liquidity" element={<Navigate to="/admin/finance/treasury" replace />} />
          <Route path="/admin/audit" element={<Navigate to="/admin/audit/logs" replace />} />
          <Route path="/admin/system/audit" element={<Navigate to="/admin/audit/logs" replace />} />
          <Route path="/admin/analytics" element={<Navigate to="/admin/audit/system" replace />} />
          <Route path="/admin/system/analytics" element={<Navigate to="/admin/audit/system" replace />} />
          <Route path="/admin/system/settings" element={<Navigate to="/admin/audit/settings" replace />} />
          <Route path="/admin/events" element={<Navigate to="/admin/operations/events" replace />} />


          {/* ========== LEGACY REDIRECTS (kept for inbound links / shares) ========== */}
          <Route path="/trending" element={<Navigate to="/sports" replace />} />
          <Route path="/closing-soon" element={<Navigate to="/sports" replace />} />
          <Route path="/resolved" element={<Navigate to="/sports" replace />} />
          <Route path="/categories/:slug" element={<Navigate to="/sports" replace />} />
          <Route path="/faq" element={<Navigate to="/rules" replace />} />
          <Route path="/about" element={<Navigate to="/rules" replace />} />
          <Route path="/challenges" element={<Navigate to="/leaderboard" replace />} />

          <Route path="*" element={<AnimatedPage><NotFound /></AnimatedPage>} />
        </Routes>
      </AnimatePresence>
      {!isAuthPage && !isAdminPage && <BetSlipDrawer />}
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
                <BetSlipProvider>
                  <OfflineIndicator />
                  <AnimatedRoutes />
                </BetSlipProvider>
              </GuestProvider>
            </AuthProvider>

          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;