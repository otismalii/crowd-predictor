import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * @deprecated Creator Studio is now a tab on the unified profile at `/profile/:id?tab=creator`.
 * This route redirects there for backward compatibility.
 */
const CreatorDashboard = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  return <Navigate to={`/profile/${user.id}?tab=creator`} replace />;
};

export default CreatorDashboard;
