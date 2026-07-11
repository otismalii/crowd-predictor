import { useState } from "react";
import SEOHead from "@/components/SEOHead";
import MarketBuilder from "@/components/admin/MarketBuilder";
import MarketsTable from "@/components/admin/markets/MarketsTable";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RefreshCw, Database } from "lucide-react";
import { useMarketsAdmin, type LifecycleTab } from "@/hooks/useMarketsAdmin";

const TABS: { id: LifecycleTab; label: string }[] = [
  { id: "draft", label: "Draft" },
  { id: "scheduled", label: "Scheduled" },
  { id: "live", label: "Live" },
  { id: "closed", label: "Closed" },
  { id: "resolved", label: "Resolved" },
];

const AdminMarketsPage = () => {
  const [tab, setTab] = useState<LifecycleTab>("live");
  const { markets, counts, loading, refresh } = useMarketsAdmin(tab);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Admin - Markets" path="/admin/markets" />

      <div className="border-b border-border/30">
        <div className="container py-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-wider">
              <Database className="inline h-6 w-6 text-primary mr-2" />Market <span className="text-primary">Management</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Lifecycle: draft → scheduled → live → closed → resolved</p>
          </div>
          <div className="flex items-center gap-2">
            <MarketBuilder onCreated={refresh} />
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as LifecycleTab)}>
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="gap-1.5">
                {t.label} <span className="text-[10px] text-muted-foreground">({counts[t.id] ?? 0})</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {TABS.map((t) => (
            <TabsContent key={t.id} value={t.id} className="mt-4">
              <MarketsTable markets={markets} loading={loading} onChange={refresh} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
};

export default AdminMarketsPage;
