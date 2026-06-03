import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type AdminRole = "super_admin" | "admin" | "market_operator" | null;

const ORDER: AdminRole[] = ["super_admin", "admin", "market_operator"];

export const useAdminRole = () => {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AdminRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setRole(null); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (cancelled) return;
      const roles = (data || []).map((r: any) => r.role as AdminRole);
      const best = ORDER.find((o) => roles.includes(o)) ?? null;
      setRole(best);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  const can = (...allowed: NonNullable<AdminRole>[]) => !!role && allowed.includes(role);
  return { role, loading, can, isSuperAdmin: role === "super_admin", isAdmin: role === "admin" || role === "super_admin" };
};
