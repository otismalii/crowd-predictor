import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import AdminOverview from "@/components/admin/AdminOverview";
import MarketBuilder from "@/components/admin/MarketBuilder";
import { Navigate, Link } from "react-router-dom";
import { Shield, BarChart3, Users, Layers, ScrollText, Database, Inbox, Scale, Zap, RefreshCw, Image, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

const adminLinks = [
  { to: "/admin/markets", label: "Markets", icon: BarChart3 },
  { to: "/admin/markets/new", label: "New Market", icon: Database },
  { to: "/admin/resolution", label: "Resolution", icon: Scale },
  { to: "/admin/bots", label: "Bots", icon: Zap },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/uploads", label: "Uploads", icon: Image },
  { to: "/admin/collaborations", label: "Collabs", icon: Handshake },
];

const AdminOverviewPage = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ users: 0, predictions: 0, matches: 0, liveMatches: 0, pendingPredictions: 0, correctRate: 0 });

  useEffect(() => {
    if (!user) return;
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      setIsAdmin(data === true);
    });
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchStats();
  }, [isAdmin]);

  const fetchStats = async () => {
    setLoading(true);
    const [profilesRes, predsRes, matchesRes] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("predictions").select("status").limit(500),
      supabase.from("matches").select("status").limit(500),
    ]);

    const preds = predsRes.data || [];
    const mtchs = matchesRes.data || [];
    const correctCount = preds.filter((p: any) => p.status === "correct").length;
    const resolvedCount = preds.filter((p: any) => p.status !== "pending").length;

    setStats({
      users: profilesRes.count || 0,
      predictions: preds.length,
      matches: mtchs.length,
      liveMatches: mtchs.filter((m: any) => m.status === "live").length,
      pendingPredictions: preds.filter((p: any) => p.status === "pending").length,
      correctRate: resolvedCount > 0 ? Math.round((correctCount / resolvedCount) * 100) : 0,
    });
    setLoading(false);
  };

  if (isAdmin === null) return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-20 flex flex-col items-center gap-4">
        <Skeleton className="h-8 w-48" />
      </div>
    </div>
  );

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Admin" path="/admin" />
      <Navbar />

      <div className="border-b border-border/30">
        <div className="container py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-3xl font-bold tracking-wider">
                  Admin <span className="text-primary">Control Room</span>
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">System overview & quick actions</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-6">
        <AdminOverview stats={stats} />

        {/* Quick nav */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {adminLinks.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to}>
              <motion.div
                whileHover={{ y: -2 }}
                className="flex items-center gap-3 p-4 rounded-xl border border-border/30 bg-card/50 hover:bg-card hover:border-primary/20 transition-all cursor-pointer"
              >
                <Icon className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">{label}</span>
              </motion.div>
            </Link>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AdminOverviewPage;
