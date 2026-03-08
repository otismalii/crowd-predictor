import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Users, RefreshCw, Brain, Trash2, Search, Activity, Database, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";

const Admin = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [syncingMatches, setSyncingMatches] = useState(false);
  const [generatingInsight, setGeneratingInsight] = useState<string | null>(null);
  const [searchUsers, setSearchUsers] = useState("");
  const [stats, setStats] = useState({ users: 0, predictions: 0, matches: 0 });

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
    const [profilesRes, predsRes, matchesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("predictions").select("*, profiles(username), matches(home_team, away_team, league)").order("created_at", { ascending: false }).limit(100),
      supabase.from("matches").select("*").order("kickoff", { ascending: false }).limit(100),
    ]);
    if (profilesRes.data) setProfiles(profilesRes.data);
    if (predsRes.data) setPredictions(predsRes.data);
    if (matchesRes.data) setMatches(matchesRes.data);
    setStats({
      users: profilesRes.data?.length || 0,
      predictions: predsRes.data?.length || 0,
      matches: matchesRes.data?.length || 0,
    });
  };

  const handleSyncMatches = async () => {
    setSyncingMatches(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-matches");
      if (error) throw error;
      toast({ title: "✅ Matches synced!", description: `Synced ${data?.synced || 0} of ${data?.total || 0} fixtures.` });
      fetchAll();
    } catch (e: any) {
      toast({ title: "Sync failed", description: e.message || "Check API key", variant: "destructive" });
    }
    setSyncingMatches(false);
  };

  const handleGenerateInsight = async (matchId: string) => {
    setGeneratingInsight(matchId);
    try {
      const { data, error } = await supabase.functions.invoke("generate-insights", {
        body: { match_id: matchId },
      });
      if (error) throw error;
      toast({ title: "🧠 AI Insight generated!", description: data?.insight?.slice(0, 100) + "..." });
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    }
    setGeneratingInsight(null);
  };

  const handleDeletePrediction = async (id: string) => {
    // Admin deletes via service role — but from client we can only delete our own.
    // For now, mark it or toast info.
    toast({ title: "Note", description: "Use Supabase dashboard to moderate predictions directly." });
  };

  if (isAdmin === null) return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-20 flex flex-col items-center gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );

  if (!isAdmin) return <Navigate to="/" replace />;

  const filteredProfiles = searchUsers
    ? profiles.filter((p) =>
        (p.username || "").toLowerCase().includes(searchUsers.toLowerCase()) ||
        (p.email || "").toLowerCase().includes(searchUsers.toLowerCase())
      )
    : profiles;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8">
        <div className="mb-8 flex items-center gap-3">
          <Shield className="h-8 w-8 text-accent" />
          <h1 className="font-display text-3xl font-bold tracking-wider">
            Admin <span className="text-primary">Dashboard</span>
          </h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
          {[
            { label: "Users", value: stats.users, icon: Users, color: "text-primary" },
            { label: "Predictions", value: stats.predictions, icon: Activity, color: "text-accent" },
            { label: "Matches", value: stats.matches, icon: Database, color: "text-primary" },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="glass-card">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className={`p-3 rounded-lg bg-muted ${stat.color}`}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-display font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Tabs defaultValue="api" className="space-y-6">
          <TabsList className="bg-muted/50 border border-border/50">
            <TabsTrigger value="api" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Zap className="mr-1.5 h-4 w-4" /> API & AI
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Users className="mr-1.5 h-4 w-4" /> Users
            </TabsTrigger>
            <TabsTrigger value="matches" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Database className="mr-1.5 h-4 w-4" /> Matches
            </TabsTrigger>
            <TabsTrigger value="predictions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Activity className="mr-1.5 h-4 w-4" /> Predictions
            </TabsTrigger>
          </TabsList>

          {/* API & AI Tab */}
          <TabsContent value="api" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="font-display text-lg flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-primary" /> Sync Matches
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Fetch today's upcoming fixtures from API-Football and sync to the database.
                  </p>
                  <Button onClick={handleSyncMatches} disabled={syncingMatches} className="w-full neon-glow">
                    {syncingMatches ? (
                      <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Syncing...</>
                    ) : (
                      <><RefreshCw className="mr-2 h-4 w-4" /> Sync Now</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="font-display text-lg flex items-center gap-2">
                    <Brain className="h-5 w-5 text-accent" /> Generate AI Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Select a match below to generate AI analysis using community predictions.
                  </p>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {matches.filter(m => m.status === "upcoming").slice(0, 10).map((m) => (
                      <div key={m.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{m.home_team} vs {m.away_team}</p>
                          <p className="text-xs text-muted-foreground">{m.league}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-2 border-accent/50 text-accent hover:bg-accent/10"
                          onClick={() => handleGenerateInsight(m.id)}
                          disabled={generatingInsight === m.id}
                        >
                          {generatingInsight === m.id ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Brain className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    ))}
                    {matches.filter(m => m.status === "upcoming").length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No upcoming matches. Sync first!</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="font-display text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" /> Users ({filteredProfiles.length})
                  </span>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={searchUsers}
                      onChange={(e) => setSearchUsers(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border/50">
                  {filteredProfiles.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-3 hover:bg-muted/20 px-2 rounded-lg transition-colors">
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-foreground">@{p.username || "anon"}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{p.email}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">{p.subscription_plan}</span>
                        <span className="text-xs text-muted-foreground">🎯 {p.accuracy_rate}%</span>
                        <span className="text-xs text-muted-foreground">⭐ {p.reputation_score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Matches Tab */}
          <TabsContent value="matches">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <Database className="h-5 w-5" /> Matches ({matches.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border/50">
                  {matches.map((m) => (
                    <div key={m.id} className="flex items-center justify-between py-3 px-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{m.home_team} vs {m.away_team}</p>
                        <p className="text-xs text-muted-foreground">{m.league} • {new Date(m.kickoff).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          m.status === "live" ? "bg-primary/20 text-primary animate-pulse-neon" :
                          m.status === "finished" ? "bg-muted text-muted-foreground" :
                          "bg-accent/20 text-accent"
                        }`}>
                          {m.status}
                        </span>
                        {m.status === "finished" && (
                          <span className="text-sm font-bold text-primary">{m.home_score}-{m.away_score}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Predictions Tab */}
          <TabsContent value="predictions">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5" /> Recent Predictions ({predictions.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border/50">
                  {predictions.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-3 px-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-primary">@{p.profiles?.username || "anon"}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            p.status === "correct" ? "bg-primary/20 text-primary" :
                            p.status === "incorrect" ? "bg-destructive/20 text-destructive" :
                            "bg-muted text-muted-foreground"
                          }`}>{p.status}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {p.matches?.home_team} {p.predicted_home_score}-{p.predicted_away_score} {p.matches?.away_team} • {p.matches?.league}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <Footer />
    </div>
  );
};

export default Admin;
