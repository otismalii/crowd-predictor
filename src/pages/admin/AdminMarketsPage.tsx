import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/SEOHead";
import AdminMatches from "@/components/admin/AdminMatches";
import MarketBuilder from "@/components/admin/MarketBuilder";
import { Button } from "@/components/ui/button";
import { RefreshCw, Database } from "lucide-react";

const AdminMarketsPage = () => {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase.from("matches").select("*").order("kickoff", { ascending: false }).limit(200);
    setMatches(data || []);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Admin - Markets" path="/admin/markets" />
      
      <div className="border-b border-border/30">
        <div className="container py-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-wider"><Database className="inline h-6 w-6 text-primary mr-2" />Market <span className="text-primary">Management</span></h1>
            <p className="text-xs text-muted-foreground mt-0.5">Create, edit, and manage markets</p>
          </div>
          <div className="flex items-center gap-2">
            <MarketBuilder onCreated={fetchData} />
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>
      </div>
      <div className="container py-6">
        <AdminMatches matches={matches} onRefresh={fetchData} />
      </div>
      
    </div>
  );
};

export default AdminMarketsPage;
