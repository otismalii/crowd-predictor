import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminUsers from "@/components/admin/AdminUsers";
import { Users, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminPageHeader, AdminPageBody } from "@/components/admin/primitives";

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
    <>
      <AdminPageHeader
        icon={Users}
        title="User Management"
        subtitle="View profiles, assign roles, and manage account status"
        actions={
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        }
      />
      <AdminPageBody>
        <AdminUsers profiles={profiles} adminIds={adminIds} onRefresh={fetchData} />
      </AdminPageBody>
    </>
  );
}

export default AdminUsersPage;
