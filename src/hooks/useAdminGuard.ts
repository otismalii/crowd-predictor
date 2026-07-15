import { useAdminRole } from "@/hooks/useAdminRole";

/**
 * @deprecated Use `useAdminRole()` directly — richer role info and a `can(...roles)` helper.
 * Thin shim kept for backward compatibility.
 */
export function useAdminGuard() {
  const { isAdmin, loading } = useAdminRole();
  return { isAdmin, loading };
}
