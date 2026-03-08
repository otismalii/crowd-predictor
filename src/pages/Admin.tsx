import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Shield, Users, Activity, Database, Zap, RefreshCw, LayoutDashboard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import AdminOverview from "@/components/admin/AdminOverview";
import AdminMatches from "@/components/admin/AdminMatches";
import AdminUsers from "@/components/admin/AdminUsers";
import AdminPredictions from "@/components/admin/AdminPredictions";
import AdminAPI from "@/components/admin/AdminAPI";

const Admin = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [adminIds, setAdminIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    users: 0, predictions: 0, matches: 0, liveMatches: 0, pendingPredictions: 0, correctRate: 0,
  });

  useEffect(() => {
    if (!user) return;
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      setIsAdmin(data === true);
    });
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchAll();
  }, [isAdmin]);

  const fetchAll = async () => {
    setLoading(true);
    const [profilesRes, predsRes, matchesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("predictions").select("*, profiles(username), matches(home_team, away_team, league)").order("created_at", { ascending: false }).limit(200),
      supabase.from("matches").select("*").order("kickoff", { ascending: false }).limit(200),
      supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
    ]);

    const profs = profilesRes.data || [];
    const preds = predsRes.data || [];
    const mtchs = matchesRes.data || [];
    const roles = rolesRes.data || [];

    setProfiles(profs);
    setPredictions(preds);
    setMatches(mtchs);
    setAdminIds(roles.map((r: any) => r.user_id));

    const correctCount = preds.filter((p: any) => p.status === "correct").length;
    const resolvedCount = preds.filter((p: any) => p.status !== "pending").length;

    setStats({
      users: profs.length,
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
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-64 w-full max-w-2xl" />
      </div>
    </div>
  );

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Shield className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold tracking-wider">
                Admin <span className="text-primary">Dashboard</span>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">Manage matches, users, predictions & APIs</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </motion.div>

        {/* Overview Stats */}
        <AdminOverview stats={stats} />

        {/* Tabs */}
        <Tabs defaultValue="matches" className="space-y-6">
          <TabsList className="bg-muted/50 border border-border/50 w-full sm:w-auto">
            <TabsTrigger value="matches" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
              <Database className="h-4 w-4" /> Matches
            </TabsTrigger>
            <TabsTrigger value="predictions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
              <Activity className="h-4 w-4" /> Predictions
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
              <Users className="h-4 w-4" /> Users
            </TabsTrigger>
            <TabsTrigger value="api" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
              <Zap className="h-4 w-4" /> API & AI
            </TabsTrigger>
          </TabsList>

          <TabsContent value="matches">
            <AdminMatches matches={matches} onRefresh={fetchAll} />
          </TabsContent>

          <TabsContent value="predictions">
            <AdminPredictions predictions={predictions} onRefresh={fetchAll} />
          </TabsContent>

          <TabsContent value="users">
            <AdminUsers profiles={profiles} adminIds={adminIds} onRefresh={fetchAll} />
          </TabsContent>

          <TabsContent value="api">
            <AdminAPI matches={matches} onRefresh={fetchAll} />
          </TabsContent>
        </Tabs>
      </div>
      <Footer />
    </div>
  );
};

export default Admin;
