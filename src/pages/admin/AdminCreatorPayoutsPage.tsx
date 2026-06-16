import { useEffect, useState } from "react";
import { Coins, Check, X, Send, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader, AdminPageBody, AdminEmptyState } from "@/components/admin/primitives";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Payout = {
  id: string;
  creator_id: string;
  market_id: string | null;
  amount_kes: number;
  basis_volume: number;
  rate_bps: number;
  status: "pending" | "approved" | "paid" | "rejected";
  created_at: string;
  notes: string | null;
};

const statusVariant: Record<Payout["status"], any> = {
  pending: "secondary",
  approved: "default",
  paid: "default",
  rejected: "destructive",
};

const AdminCreatorPayoutsPage = () => {
  const [rows, setRows] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("creator_payouts" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const act = async (id: string, action: "approve" | "pay" | "reject") => {
    setBusy(id);
    const reason = action === "reject" ? window.prompt("Reason for rejection?") ?? "rejected" : undefined;
    const { error } = await supabase.functions.invoke("creator-payouts", {
      body: { action, payout_id: id, reason },
    });
    if (error) toast.error(error.message);
    else toast.success(`Payout ${action}d`);
    await load();
    setBusy(null);
  };

  return (
    <>
      <AdminPageHeader
        icon={Coins}
        title="Creator Payouts"
        subtitle="Approve and disburse rewards to market creators from the creator_rewards treasury bucket"
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        }
      />
      <AdminPageBody>
        {loading ? null : rows.length === 0 ? (
          <AdminEmptyState icon={Coins} title="No payouts yet" description="Payouts are attributed automatically when a creator's market settles." />
        ) : (
          <div className="grid gap-3">
            {rows.map((p) => (
              <Card key={p.id} className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="font-medium tabular-nums">
                    {Number(p.amount_kes).toLocaleString()} KES
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({p.rate_bps / 100}% of {Number(p.basis_volume).toLocaleString()})
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
                    creator {p.creator_id.slice(0, 8)} · market {p.market_id?.slice(0, 8) ?? "—"}
                  </div>
                  {p.notes && <div className="text-xs mt-1">{p.notes}</div>}
                </div>
                <Badge variant={statusVariant[p.status]}>{p.status}</Badge>
                <div className="flex gap-2 shrink-0">
                  {p.status === "pending" && (
                    <>
                      <Button size="sm" onClick={() => act(p.id, "approve")} disabled={busy === p.id}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => act(p.id, "reject")} disabled={busy === p.id}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {p.status === "approved" && (
                    <Button size="sm" onClick={() => act(p.id, "pay")} disabled={busy === p.id} className="gap-1">
                      <Send className="h-4 w-4" /> Pay
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </AdminPageBody>
    </>
  );
};

export default AdminCreatorPayoutsPage;
