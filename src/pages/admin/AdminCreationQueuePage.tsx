import { useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader, AdminPageBody, AdminEmptyState } from "@/components/admin/primitives";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const AdminCreationQueuePage = () => {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("markets")
        .select("id, title, status, category, created_at, created_by")
        .in("status", ["draft", "review"])
        .order("created_at", { ascending: false })
        .limit(100);
      setDrafts(data || []);
      setLoading(false);
    })();
  }, []);

  return (
    <>
      <AdminPageHeader icon={Inbox} title="Creation Queue" subtitle="Draft markets awaiting publication review" />
      <AdminPageBody>
        {loading ? null : drafts.length === 0 ? (
          <AdminEmptyState icon={Inbox} title="No drafts" description="Approved Oracle suggestions and creator drafts appear here." />
        ) : (
          <div className="grid gap-3">
            {drafts.map((m) => (
              <Card key={m.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{m.title}</div>
                  <div className="text-xs text-muted-foreground">{m.category} · {new Date(m.created_at).toLocaleString()}</div>
                </div>
                <Badge variant="secondary">{m.status}</Badge>
              </Card>
            ))}
          </div>
        )}
      </AdminPageBody>
    </>
  );
};

export default AdminCreationQueuePage;
