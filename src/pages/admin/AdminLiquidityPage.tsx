import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Market {
  id: string; title: string; status: string;
  liquidity_param: number; treasury_subsidy: number; total_volume: number;
}

const AdminLiquidityPage = () => {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("markets")
      .select("id, title, status, liquidity_param, treasury_subsidy, total_volume")
      .in("status", ["open", "closed"])
      .order("total_volume", { ascending: false })
      .limit(100)
      .then(({ data }) => { setMarkets(data as Market[] || []); setLoading(false); });
  }, []);

  const totalSubsidy = markets.reduce((s, m) => s + Number(m.treasury_subsidy || 0), 0);
  const totalVolume = markets.reduce((s, m) => s + Number(m.total_volume || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <Helmet><title>Liquidity · Pagaza Admin</title></Helmet>
      
      <main className="container py-8 pb-24 space-y-6">
        <header>
          <h1 className="font-display text-2xl font-bold tracking-wider">Liquidity Overview</h1>
          <p className="text-xs text-muted-foreground mt-1">Per-market b parameter and treasury subsidies</p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Treasury subsidies</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-display font-bold tabular-nums">{totalSubsidy.toLocaleString()} KES</p></CardContent>
          </Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Live trading volume</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-display font-bold tabular-nums text-primary">{totalVolume.toLocaleString()} KES</p></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm font-display tracking-wider">Markets</CardTitle></CardHeader>
          <CardContent>
            {loading ? <p className="text-xs text-muted-foreground">Loading…</p> : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {markets.map(m => (
                  <div key={m.id} className="p-3 rounded-lg bg-muted/30 border border-border/30 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold truncate">{m.title}</span>
                      <Badge variant={m.status === "open" ? "default" : "secondary"} className="text-[10px]">{m.status}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground tabular-nums">
                      <span>b = {Number(m.liquidity_param).toFixed(0)}</span>
                      <span>subsidy {Number(m.treasury_subsidy).toFixed(0)} KES</span>
                      <span className="text-primary">vol {Number(m.total_volume).toFixed(0)} KES</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      
    </div>
  );
};

export default AdminLiquidityPage;
