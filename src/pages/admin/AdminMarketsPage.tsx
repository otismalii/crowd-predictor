import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import AdminMatches from "@/components/admin/AdminMatches";
import MarketBuilder from "@/components/admin/MarketBuilder";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RefreshCw, Database } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const AdminMarketsPage = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      setIsAdmin(data === true);
    });
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchData();
  }, [isAdmin]);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase.from("matches").select("*").order("kickoff", { ascending: false }).limit(200);
    setMatches(data || []);
    setLoading(false);
  };

  if (isAdmin === null) return <div className="min-h-screen bg-background"><Navbar /><div className="container py-20"><Skeleton className="h-8 w-48" /></div></div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Admin - Markets" path="/admin/markets" />
      <Navbar />
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
      <Footer />
    </div>
  );
};

export default AdminMarketsPage;
