import { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AdminPageHeader, AdminPageBody, AdminEmptyState } from "@/components/admin/primitives";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const AdminPromotionsPage = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("role_promotions" as any).select("*").order("created_at", { ascending: false }).limit(200);
    setRows((data as any[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const decide = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase
      .from("role_promotions" as any)
      .update({ status, approved_by: user?.id, decided_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: `Promotion ${status}` });
    load();
  };

  return (
    <>
      <AdminPageHeader icon={ListChecks} title="Roles & Promotions" subtitle="ACP-only approval queue for user role changes" />
      <AdminPageBody>
        {loading ? null : rows.length === 0 ? (
          <AdminEmptyState icon={ListChecks} title="No promotion requests" description="Requests appear here when users or Oracle propose role changes." />
        ) : (
          <div className="grid gap-3">
            {rows.map((r) => (
              <Card key={r.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.user_id}</div>
                  <div className="text-xs text-muted-foreground">{r.from_role || "—"} → {r.to_role}</div>
                  {r.reason && <div className="text-sm mt-1">{r.reason}</div>}
                </div>
                <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge>
                {r.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="default" onClick={() => decide(r.id, "approved")}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => decide(r.id, "rejected")}>Reject</Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </AdminPageBody>
    </>
  );
};

export default AdminPromotionsPage;
