import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Landmark, Users as UsersIcon, TrendingUp, Droplet, Shield, Wrench } from "lucide-react";

const BUCKET_META: Record<string, { label: string; icon: any; color: string }> = {
  user_funds: { label: "User Funds", icon: UsersIcon, color: "text-primary" },
  platform_revenue: { label: "Platform Revenue", icon: TrendingUp, color: "text-accent" },
  liquidity_pool: { label: "Liquidity Pool", icon: Droplet, color: "text-foreground" },
  settlement_reserve: { label: "Settlement Reserve", icon: Shield, color: "text-foreground" },
  operational_reserve: { label: "Operational Reserve", icon: Wrench, color: "text-muted-foreground" },
};

type Row = { bucket: string; ledger_balance: number; cached_balance: number; drift: number };

export const TreasuryBuckets = () => {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("v_treasury_balances").select("*");
      if (data) setRows(data);
    })();
  }, []);

  if (rows.length === 0) return null;
  return (
    <section className="rounded-xl border border-border/40 bg-card/40">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-display font-bold tracking-wide uppercase text-muted-foreground">Treasury Buckets</h2>
        </div>
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4">
        {rows.map((r) => {
          const meta = BUCKET_META[r.bucket] || { label: r.bucket, icon: Landmark, color: "text-foreground" };
          const Icon = meta.icon;
          const drift = Math.abs(Number(r.drift) || 0);
          return (
            <Card key={r.bucket} className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{meta.label}</span>
              </div>
              <div className={`font-display text-lg font-bold tabular-nums ${meta.color}`}>
                {Number(r.ledger_balance || 0).toLocaleString()}
                <span className="text-xs font-normal text-muted-foreground ml-0.5"> KES</span>
              </div>
              {drift > 0.01 && (
                <div className="text-[10px] text-destructive mt-1">drift {drift.toLocaleString()}</div>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
};

export default TreasuryBuckets;
