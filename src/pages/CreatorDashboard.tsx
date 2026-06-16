import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Coins, Trophy, TrendingUp, Save } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";

const tierBadge: Record<string, string> = {
  bronze: "bg-amber-700/20 text-amber-500 border-amber-700/30",
  silver: "bg-slate-400/20 text-slate-300 border-slate-400/30",
  gold: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  platinum: "bg-cyan-400/20 text-cyan-300 border-cyan-400/30",
};

const CreatorDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bio, setBio] = useState("");
  const [method, setMethod] = useState("");
  const [destination, setDestination] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: p } = await supabase
        .from("creator_profiles" as any).select("*").eq("user_id", user.id).maybeSingle();
      if (!p) {
        // bootstrap
        const { data: created } = await supabase
          .from("creator_profiles" as any).insert({ user_id: user.id } as any).select("*").single();
        setProfile(created);
      } else {
        setProfile(p);
        setBio((p as any).bio ?? "");
        setMethod((p as any).payout_method ?? "mpesa");
        setDestination((p as any).payout_destination ?? "");
      }
      const { data: ps } = await supabase
        .from("creator_payouts" as any).select("*").eq("creator_id", user.id)
        .order("created_at", { ascending: false }).limit(50);
      setPayouts((ps as any) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("creator_profiles" as any)
      .update({ bio, payout_method: method, payout_destination: destination } as any)
      .eq("user_id", user.id);
    if (error) toast.error(error.message);
    else toast.success("Profile updated");
    setSaving(false);
  };

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (loading || !profile) return (
    <div className="min-h-screen bg-background"><Navbar /><div className="container py-20 text-center text-muted-foreground">Loading creator dashboard…</div></div>
  );

  const pending = payouts.filter((p) => p.status === "pending").reduce((s, p) => s + Number(p.amount_kes), 0);
  const approved = payouts.filter((p) => p.status === "approved").reduce((s, p) => s + Number(p.amount_kes), 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8 max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-wider">Creator Studio</h1>
            <p className="text-sm text-muted-foreground mt-1">Track market attribution, payouts and premium subscribers.</p>
          </div>
          <Badge className={`uppercase ${tierBadge[profile.tier]}`} variant="outline">
            <Trophy className="h-3 w-3 mr-1" />{profile.tier}
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4">
            <div className="text-[11px] text-muted-foreground">Markets published</div>
            <div className="text-2xl font-display font-bold tabular-nums mt-1">{profile.markets_published}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-[11px] text-muted-foreground">Attributed volume</div>
            <div className="text-2xl font-display font-bold tabular-nums mt-1">{Number(profile.total_volume_attributed).toLocaleString()}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-[11px] text-muted-foreground">Pending payouts</div>
            <div className="text-2xl font-display font-bold tabular-nums mt-1 text-accent">{pending.toLocaleString()}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-[11px] text-muted-foreground">Lifetime paid</div>
            <div className="text-2xl font-display font-bold tabular-nums mt-1 text-primary">{Number(profile.lifetime_payout_kes).toLocaleString()}</div>
          </CardContent></Card>
        </div>

        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-primary" />
              <h2 className="font-display font-bold">Payout settings</h2>
            </div>
            <div>
              <Label>Bio</Label>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell subscribers what you cover" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Method</Label>
                <Input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="mpesa" />
              </div>
              <div>
                <Label>Destination</Label>
                <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="2547XXXXXXXX" />
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Current rate: <span className="text-primary font-semibold">{profile.payout_rate_bps / 100}%</span> of attributed market volume. Admin can adjust per tier.
            </div>
            <Button onClick={save} disabled={saving} className="gap-2"><Save className="h-4 w-4" /> Save</Button>
          </CardContent>
        </Card>

        <div>
          <h2 className="font-display text-xl font-bold tracking-wider mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Recent payouts
          </h2>
          {payouts.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
              No payouts yet. Submit market ideas in the Oracle queue to start earning.
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {payouts.map((p) => (
                <Card key={p.id}><CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-display font-bold tabular-nums">{Number(p.amount_kes).toLocaleString()} KES</div>
                    <div className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()} · market {p.market_id?.slice(0, 8) ?? "—"}</div>
                  </div>
                  <Badge variant={p.status === "paid" ? "default" : p.status === "rejected" ? "destructive" : "secondary"}>
                    {p.status}
                  </Badge>
                </CardContent></Card>
              ))}
            </div>
          )}
        </div>

        <div className="text-center text-xs text-muted-foreground pt-4">
          <Link to={`/profile/${user.id}`} className="underline">View your public profile →</Link>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CreatorDashboard;
