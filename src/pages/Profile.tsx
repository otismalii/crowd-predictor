import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Target, TrendingUp, Users } from "lucide-react";
import { format } from "date-fns";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const Profile = () => {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<any>(null);
  const [predictions, setPredictions] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    supabase.from("profiles").select("*").eq("id", id).single().then(({ data }) => setProfile(data));
    supabase.from("predictions").select("*, matches(home_team, away_team, league)").eq("user_id", id).order("created_at", { ascending: false }).limit(20).then(({ data }) => setPredictions(data || []));
  }, [id]);

  if (!profile) return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-20 text-center text-muted-foreground">Loading profile...</div>
    </div>
  );

  const stats = [
    { icon: Target, label: "Accuracy", value: `${profile.accuracy_rate}%` },
    { icon: TrendingUp, label: "Reputation", value: profile.reputation_score },
    { icon: Users, label: "Followers", value: profile.followers_count },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8">
        {/* Profile header */}
        <Card className="glass-card mb-8">
          <CardContent className="flex flex-col items-center p-8 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 border-2 border-primary">
              <User className="h-10 w-10 text-primary" />
            </div>
            <h1 className="font-display text-3xl font-bold tracking-wider">@{profile.username || "anon"}</h1>
            <p className="text-sm text-muted-foreground mt-1">{profile.email}</p>
            <span className="mt-2 text-xs px-3 py-1 rounded-full bg-accent/10 text-accent font-semibold">
              {profile.subscription_plan} plan
            </span>
            <div className="mt-6 grid grid-cols-3 gap-8">
              {stats.map((s) => (
                <div key={s.label} className="text-center">
                  <s.icon className="mx-auto mb-1 h-5 w-5 text-primary" />
                  <p className="font-display text-xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Prediction history */}
        <h2 className="mb-4 font-display text-xl font-bold tracking-wider">Recent Predictions</h2>
        <div className="space-y-3">
          {predictions.length === 0 ? (
            <Card className="glass-card p-6 text-center text-muted-foreground">No predictions yet.</Card>
          ) : (
            predictions.map((p) => (
              <Card key={p.id} className="glass-card">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{p.matches?.league}</p>
                    <p className="text-sm font-semibold">
                      {p.matches?.home_team} {p.predicted_home_score} - {p.predicted_away_score} {p.matches?.away_team}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{format(new Date(p.created_at), "MMM d, yyyy")}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    p.status === "correct" ? "bg-primary/20 text-primary" :
                    p.status === "incorrect" ? "bg-destructive/20 text-destructive" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {p.status}
                  </span>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Profile;
