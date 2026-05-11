import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import AdminUsers from "@/components/admin/AdminUsers";
import { Users, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const AdminUsersPage = () => {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [adminIds, setAdminIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [profilesRes, rolesRes] = await Promise.all([
      (supabase as any).rpc("admin_list_profiles"),
      supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
    ]);
    setProfiles((profilesRes.data as any[]) || []);
    setAdminIds((rolesRes.data || []).map((r: any) => r.user_id));
    setLoading(false);
  };

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
