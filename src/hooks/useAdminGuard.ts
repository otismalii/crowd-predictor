import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook that checks admin role. Returns { isAdmin, loading }.
 * Centralizes the admin check used across all admin pages.
 */
export function useAdminGuard() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading && !user) setIsAdmin(false);
      return;
    }
    supabase
      .rpc("has_role", { _user_id: user.id, _role: "admin" })
      .then(({ data }) => setIsAdmin(data === true));
  }, [user, authLoading]);

  return { isAdmin, loading: authLoading || isAdmin === null };
}
