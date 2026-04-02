import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Route guard for player-layer routes.
 * Shows loading spinner while auth is resolving, then redirects unauthenticated users.
 */
export const PlayerRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

/**
 * Route guard for admin-layer routes.
 * Uses has_role RPC to check admin status.
 */
export { default as AdminRoute } from "@/components/layout/ProtectedRoute";
