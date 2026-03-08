import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/layout/Navbar";
import { Navigate } from "react-router-dom";

const Admin = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [profiles, setProfiles] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      setIsAdmin(data === true);
    });
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(100).then(({ data }) => {
      if (data) setProfiles(data);
    });
  }, [isAdmin]);

  if (isAdmin === null) return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-20 text-center text-muted-foreground">Checking access...</div>
    </div>
  );

  if (!isAdmin) return <Navigate to="/feed" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8">
        <h1 className="mb-8 font-display text-3xl font-bold tracking-wider">
          <Shield className="inline-block mr-2 h-8 w-8 text-accent" />
          Admin <span className="text-primary">Dashboard</span>
        </h1>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <Users className="h-5 w-5" /> Users ({profiles.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border/50">
              {profiles.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3">
                  <div>
                    <span className="font-semibold">@{p.username || "anon"}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{p.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">{p.subscription_plan}</span>
                    <span className="text-xs text-muted-foreground">Rep: {p.reputation_score}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Admin;
