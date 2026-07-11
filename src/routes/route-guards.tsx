import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/layout/Navbar";
import { Skeleton } from "@/components/ui/skeleton";

export type Role = "admin" | "moderator" | "user" | "verified_user" | "risk_flagged" | "market_operator" | "super_admin";

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
 * Granular role guard. Pass a list of roles — user needs ANY of them.
 * Backwards compatible: AdminRoute = RequireRole admin OR super_admin.
 */
export const RequireRole = ({ roles, children }: { roles: Role[]; children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setAllowed(false); return; }
    supabase.rpc("has_any_role", { _user_id: user.id, _roles: roles })
      .then(({ data }) => setAllowed(data === true));
  }, [user, authLoading, roles.join(",")]);

  if (authLoading || allowed === null) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-20 flex flex-col items-center gap-4">
          <Skeleton className="h-8 w-48" />
        </div>
      </div>
    );
  }
  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export const AdminRoute = ({ children }: { children: React.ReactNode }) => (
  <RequireRole roles={["admin", "super_admin"]}>{children}</RequireRole>
);

export const SuperAdminRoute = ({ children }: { children: React.ReactNode }) => (
  <RequireRole roles={["super_admin"]}>{children}</RequireRole>
);

export const OperatorRoute = ({ children }: { children: React.ReactNode }) => (
  <RequireRole roles={["market_operator", "super_admin", "admin"]}>{children}</RequireRole>
);
