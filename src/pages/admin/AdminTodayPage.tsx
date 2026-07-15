import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader, AdminPageBody } from "@/components/admin/primitives";
import AdminWhyBanner from "@/components/admin/AdminWhyBanner";
import { Sun, Clock, AlertTriangle, CreditCard, Wallet, ChevronRight } from "lucide-react";

interface Card {
  label: string;
  icon: any;
  value: number | string | null;
  to: string;
  tone: "primary" | "warning" | "danger";
}

const toneClass: Record<Card["tone"], string> = {
  primary: "text-primary",
  warning: "text-amber-400",
  danger: "text-destructive",
};

const AdminTodayPage = () => {
  const [cards, setCards] = useState<Card[]>([
    { label: "Closing < 24h", icon: Clock, value: null, to: "/admin/markets?sort=closing", tone: "primary" },
    { label: "Pending withdrawals", icon: Wallet, value: null, to: "/admin/finance/treasury", tone: "warning" },
    { label: "Failed payments", icon: CreditCard, value: null, to: "/admin/finance/reconciliation", tone: "danger" },
    { label: "Open risk signals", icon: AlertTriangle, value: null, to: "/admin/intelligence/risk", tone: "warning" },
  ]);

  useEffect(() => {
    (async () => {
      const in24h = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const [closing, withdraw, failed, risk] = await Promise.all([
        (supabase as any).from("markets").select("id", { count: "exact", head: true }).eq("status", "open").lte("closes_at", in24h),
        (supabase as any).from("withdrawal_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        (supabase as any).from("payment_failures").select("id", { count: "exact", head: true }).eq("resolved", false),
        (supabase as any).from("risk_signals").select("id", { count: "exact", head: true }).eq("status", "open"),
      ]);
      setCards((prev) => [
        { ...prev[0], value: closing.count ?? 0 },
        { ...prev[1], value: withdraw.count ?? 0 },
        { ...prev[2], value: failed.count ?? 0 },
        { ...prev[3], value: risk.count ?? 0 },
      ]);
    })().catch(() => { /* silent — tables may not exist yet */ });
  }, []);

  return (
    <>
      <AdminPageHeader icon={Sun} title="Today" subtitle="Operator start-of-day snapshot" />
      <AdminPageBody>
        <div className="space-y-4">
          <AdminWhyBanner
            happened="Time-sensitive items detected in the last 24 hours across markets, finance and risk."
            canDo="Click into each card to act — resolve, approve, retry or investigate."
            next="Actions are logged to audit and reduce these counts in near real-time."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {cards.map((c) => (
              <Link key={c.label} to={c.to} className="group rounded-xl border border-border/40 bg-card/40 p-4 hover:border-primary/40 transition">
                <div className="flex items-center gap-2">
                  <c.icon className={`h-4 w-4 ${toneClass[c.tone]}`} />
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/50 ml-auto group-hover:text-primary transition" />
                </div>
                <div className={`mt-2 text-3xl font-display font-bold tabular-nums ${toneClass[c.tone]}`}>
                  {c.value ?? "—"}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </AdminPageBody>
    </>
  );
};

export default AdminTodayPage;
