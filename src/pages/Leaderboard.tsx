import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Medal, Star } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

interface Profile {
  id: string;
  username: string | null;
  reputation_score: number;
  accuracy_rate: number;
  avatar_url: string | null;
}

const Leaderboard = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tab, setTab] = useState<"reputation" | "accuracy">("reputation");

  useEffect(() => {
    const col = tab === "reputation" ? "reputation_score" : "accuracy_rate";
    supabase
      .from("profiles")
      .select("id, username, reputation_score, accuracy_rate, avatar_url")
      .order(col, { ascending: false })
      .limit(50)
      .then(({ data }) => { if (data) setProfiles(data as Profile[]); });
  }, [tab]);

  const getRankIcon = (i: number) => {
    if (i === 0) return <Trophy className="h-5 w-5 text-accent" />;
    if (i === 1) return <Medal className="h-5 w-5 text-muted-foreground" />;
    if (i === 2) return <Star className="h-5 w-5 text-primary" />;
    return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{i + 1}</span>;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8">
        <h1 className="mb-8 font-display text-3xl font-bold tracking-wider">
          <Trophy className="inline-block mr-2 h-8 w-8 text-accent" />
          Leader<span className="text-primary">board</span>
        </h1>

        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setTab("reputation")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "reputation" ? "bg-primary text-primary-foreground neon-glow" : "bg-muted text-muted-foreground"
            }`}
          >
            Reputation
          </button>
          <button
            onClick={() => setTab("accuracy")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "accuracy" ? "bg-primary text-primary-foreground neon-glow" : "bg-muted text-muted-foreground"
            }`}
          >
            Accuracy
          </button>
        </div>

        <Card className="glass-card">
          <CardContent className="p-0">
            {profiles.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No users yet.</div>
            ) : (
              <div className="divide-y divide-border/50">
                {profiles.map((p, i) => (
                  <Link
                    key={p.id}
                    to={`/profile/${p.id}`}
                    className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="w-8 flex justify-center">{getRankIcon(i)}</div>
                    <div className="flex-1">
                      <span className="font-semibold text-foreground">@{p.username || "anon"}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-primary">
                        {tab === "reputation" ? p.reputation_score : `${p.accuracy_rate}%`}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default Leaderboard;
