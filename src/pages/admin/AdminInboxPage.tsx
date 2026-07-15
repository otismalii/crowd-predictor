import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader, AdminPageBody } from "@/components/admin/primitives";
import AdminWhyBanner from "@/components/admin/AdminWhyBanner";
import { Inbox, Sparkles, Gavel, ListChecks, ChevronRight } from "lucide-react";

interface Bucket {
  label: string;
  icon: any;
  count: number | null;
  to: string;
  hint: string;
}

const AdminInboxPage = () => {
  const [b, setB] = useState<Bucket[]>([
    { label: "Creation Queue", icon: Inbox, count: null, to: "/admin/markets/queue", hint: "Markets pending review" },
    { label: "Oracle Suggestions", icon: Sparkles, count: null, to: "/admin/markets/oracle-suggestions", hint: "LOGIK proposals awaiting a human" },
    { label: "Disputes", icon: Gavel, count: null, to: "/admin/governance/disputes", hint: "Open user disputes" },
    { label: "Promotions", icon: ListChecks, count: null, to: "/admin/governance/promotions", hint: "Role requests to review" },
  ]);

  useEffect(() => {
    (async () => {
      const [sug, oracle, disp, prom] = await Promise.all([
        (supabase as any).from("market_suggestions").select("id", { count: "exact", head: true }).in("status", ["pending", "submitted", "draft"]),
        (supabase as any).from("market_audit_log").select("id", { count: "exact", head: true }).eq("action", "oracle_suggestion"),
        (supabase as any).from("market_disputes").select("id", { count: "exact", head: true }).eq("status", "open"),
        (supabase as any).from("role_promotions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      setB([
        { ...b[0], count: sug.count ?? 0 },
        { ...b[1], count: oracle.count ?? 0 },
        { ...b[2], count: disp.count ?? 0 },
        { ...b[3], count: prom.count ?? 0 },
      ]);
    })().catch(() => {/* silent */});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <AdminPageHeader icon={Inbox} title="Inbox" subtitle="Everything waiting on a human decision" />
      <AdminPageBody>
        <div className="space-y-4">
          <AdminWhyBanner
            happened="These queues contain items proposed by users, oracles or the system."
            canDo="Open each queue and approve, reject or edit with a reason attached."
            next="Approved items publish or promote immediately; rejections are logged to the audit trail."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {b.map((x) => (
              <Link key={x.label} to={x.to} className="group rounded-xl border border-border/40 bg-card/40 p-4 hover:border-primary/40 transition">
                <div className="flex items-center gap-2">
                  <x.icon className="h-4 w-4 text-primary" />
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">{x.label}</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/50 ml-auto group-hover:text-primary transition" />
                </div>
                <div className="mt-2 text-3xl font-display font-bold tabular-nums">
                  {x.count ?? "—"}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">{x.hint}</div>
              </Link>
            ))}
          </div>
        </div>
      </AdminPageBody>
    </>
  );
};

export default AdminInboxPage;
