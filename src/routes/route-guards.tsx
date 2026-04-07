import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import Navbar from "@/components/layout/Navbar";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route guard for player-layer routes.
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
export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin, loading } = useAdminGuard();

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-20 flex flex-col items-center gap-4">
          <Skeleton className="h-8 w-48" />
        </div>
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};
