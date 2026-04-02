import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import AdminUsers from "@/components/admin/AdminUsers";
import { Navigate } from "react-router-dom";
import { Users, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const AdminUsersPage = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [adminIds, setAdminIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      setIsAdmin(data === true);
    });
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchData();
  }, [isAdmin]);

  const fetchData = async () => {
    setLoading(true);
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
    ]);
    setProfiles(profilesRes.data || []);
    setAdminIds((rolesRes.data || []).map((r: any) => r.user_id));
    setLoading(false);
  };

  if (isAdmin === null) return <div className="min-h-screen bg-background"><Navbar /><div className="container py-20"><Skeleton className="h-8 w-48" /></div></div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Admin - Users" path="/admin/users" />
      <Navbar />
      <div className="border-b border-border/30">
        <div className="container py-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-wider"><Users className="inline h-6 w-6 text-primary mr-2" />User <span className="text-primary">Management</span></h1>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>
      <div className="container py-6">
        <AdminUsers profiles={profiles} adminIds={adminIds} onRefresh={fetchData} />
      </div>
      <Footer />
    </div>
  );
};

export default AdminUsersPage;
