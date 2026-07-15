import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Coins, Trophy, TrendingUp, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";

const tierBadge: Record<string, string> = {
  bronze: "bg-amber-700/20 text-amber-500 border-amber-700/30",
  silver: "bg-slate-400/20 text-slate-300 border-slate-400/30",
  gold: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  platinum: "bg-cyan-400/20 text-cyan-300 border-cyan-400/30",
};

/**
 * Creator ("industry") panel embedded in the unified profile at /profile/:id?tab=creator.
 * Owner sees full studio; visitors see a read-only summary.
 */
export default function ProfileCreatorTab({ userId, isOwn }: { userId: string; isOwn: boolean }) {
  const [profile, setProfile] = useState<any>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bio, setBio] = useState("");
  const [method, setMethod] = useState("mpesa");
  const [destination, setDestination] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: p } = await (supabase as any).from("creator_profiles").select("*").eq("user_id", userId).maybeSingle();
      let row = p;
      if (!row && isOwn) {
        const { data: created } = await (supabase as any).from("creator_profiles").insert({ user_id: userId }).select("*").single();
        row = created;
      }
      setProfile(row);
      if (row) {
        setBio(row.bio ?? "");
        setMethod(row.payout_method ?? "mpesa");
        setDestination(row.payout_destination ?? "");
      }
      if (row) {
        const { data: ps } = await (supabase as any).from("creator_payouts").select("*").eq("creator_id", userId).order("created_at", { ascending: false }).limit(20);
        setPayouts(ps ?? []);
      }
      setLoading(false);
    })();
  }, [userId, isOwn]);

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase as any).from("creator_profiles")
      .update({ bio, payout_method: method, payout_destination: destination })
      .eq("user_id", userId);
    if (error) toast.error(error.message); else toast.success("Creator profile updated");
    setSaving(false);
  };

  if (loading) return <div className="text-center text-sm text-muted-foreground py-10">Loading creator profile…</div>;

  if (!profile) {
    return (
      <Card><CardContent className="p-8 text-center space-y-3">
        <Sparkles className="mx-auto h-8 w-8 text-primary/40" />
        <p className="text-sm text-muted-foreground">This user isn't a market creator yet.</p>
      </CardContent></Card>
    );
  }

  const pending = payouts.filter((p) => p.status === "pending").reduce((s, p) => s + Number(p.amount_kes), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold tracking-wider">CREATOR STUDIO</h2>
        <Badge className={`uppercase ${tierBadge[profile.tier] ?? ""}`} variant="outline">
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

      {isOwn && (
        <Card><CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-primary" />
            <h3 className="font-display font-bold">Payout settings</h3>
          </div>
          <div>
            <Label>Bio</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell subscribers what you cover" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Method</Label><Input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="mpesa" /></div>
            <div><Label>Destination</Label><Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="2547XXXXXXXX" /></div>
          </div>
          <div className="text-xs text-muted-foreground">
            Current rate: <span className="text-primary font-semibold">{profile.payout_rate_bps / 100}%</span> of attributed volume. Admins adjust per tier.
          </div>
          <Button onClick={save} disabled={saving} className="gap-2"><Save className="h-4 w-4" /> Save</Button>
        </CardContent></Card>
      )}

      <div>
        <h3 className="font-display text-sm font-bold tracking-wider mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" /> Recent payouts
        </h3>
        {payouts.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No payouts yet.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {payouts.map((p) => (
              <Card key={p.id}><CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-display font-bold tabular-nums">{Number(p.amount_kes).toLocaleString()} KES</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString()} ·{" "}
                    {p.market_id ? <Link to={`/markets/${p.market_id}`} className="underline">market {p.market_id.slice(0, 8)}</Link> : "—"}
                  </div>
                </div>
                <Badge variant={p.status === "paid" ? "default" : p.status === "rejected" ? "destructive" : "secondary"}>
                  {p.status}
                </Badge>
              </CardContent></Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
