import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/layout/Navbar";
import MobileNav from "@/components/layout/MobileNav";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

type Round = { id: string; round_no: number; status: string; betting_ends_at: string; started_at: string | null; crash_point?: number | null; hash?: string };
type State = { round: Round; feed: any[]; history: number[]; my_bet: any; server_time: string };

const GROWTH = 0.06;

const PopIt = () => {
  const { user } = useAuth();
  const [state, setState] = useState<State | null>(null);
  const [mult, setMult] = useState(1);
  const [stake, setStake] = useState("50");
  const [auto, setAuto] = useState("");
  const [busy, setBusy] = useState(false);
  const offset = useRef(0);

  const call = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("crash-game", { body });
    if (error) {
      let msg = error.message;
      try { msg = (await (error as any).context.json()).error ?? msg; } catch {}
      throw new Error(msg);
    }
    return data;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const d = (await call({ action: "state" })) as State;
      offset.current = new Date(d.server_time).getTime() - Date.now();
      setState(d);
    } catch {}
  }, [call]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 1500);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const r = state?.round;
      if (r?.status === "running" && r.started_at) {
        const s = (Date.now() + offset.current - new Date(r.started_at).getTime()) / 1000;
        setMult(Math.max(1, Math.exp(GROWTH * Math.max(0, s))));
      } else if (r?.crash_point) setMult(Number(r.crash_point));
      else setMult(1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state?.round]);

  const r = state?.round;
  const bet = state?.my_bet;
  const secsLeft = r?.status === "betting" ? Math.max(0, Math.ceil((new Date(r.betting_ends_at).getTime() - Date.now() - offset.current) / 1000)) : 0;
  const popped = r && ["crashed", "settled"].includes(r.status);

  const place = async () => {
    const s = Number(stake);
    if (!Number.isFinite(s) || s < 10) return toast({ title: "Minimum stake is KES 10", variant: "destructive" });
    setBusy(true);
    try {
      await call({ action: "place_bet", stake: s, auto_cashout: auto ? Number(auto) : null });
      toast({ title: `KES ${s} in for round #${r?.round_no}` });
      refresh();
    } catch (e: any) { toast({ title: "Bet not placed", description: e.message, variant: "destructive" }); }
    setBusy(false);
  };

  const cashout = async () => {
    setBusy(true);
    try {
      const d: any = await call({ action: "cashout", bet_id: bet.id });
      toast({ title: `Cashed out at ${Number(d.multiplier ?? mult).toFixed(2)}x`, description: d.payout ? `KES ${Number(d.payout).toLocaleString()} added to your wallet` : undefined });
      refresh();
    } catch (e: any) { toast({ title: "Cash-out failed", description: e.message, variant: "destructive" }); }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <SEOHead title="Pop It" path="/crash" />
      <Navbar />
      <main className="container max-w-3xl py-4 space-y-4">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {(state?.history ?? []).slice(-16).reverse().map((h, i) => (
            <span key={i} className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold tabular-nums ${h >= 2 ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{h.toFixed(2)}x</span>
          ))}
        </div>

        <section className="relative overflow-hidden rounded-2xl border border-border/50 bg-card aspect-[16/10] flex flex-col items-center justify-center">
          <div className={`absolute inset-0 transition-opacity ${r?.status === "running" ? "opacity-100" : "opacity-0"}`} style={{ background: "radial-gradient(circle at 50% 60%, hsl(var(--primary) / 0.18), transparent 60%)" }} />
          <div className="relative text-xs uppercase tracking-[0.3em] text-muted-foreground">
            {r ? `Round #${r.round_no}` : "Connecting"}
          </div>
          <div className={`relative font-display text-6xl md:text-8xl font-black tabular-nums ${popped ? "text-destructive" : "text-primary"}`}>
            {mult.toFixed(2)}x
          </div>
          <div className="relative mt-2 text-sm font-semibold">
            {r?.status === "betting" && `Bets close in ${secsLeft}s`}
            {r?.status === "running" && "Flying — cash out before it pops"}
            {popped && "Popped!"}
          </div>
        </section>

        <section className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
          {!user ? (
            <Button asChild className="w-full h-12"><Link to="/auth">Sign in to play</Link></Button>
          ) : bet && bet.status === "active" && r?.status === "running" ? (
            <Button onClick={cashout} disabled={busy} className="w-full h-14 text-lg font-black">
              Cash out KES {(Number(bet.stake) * mult).toFixed(0)}
            </Button>
          ) : bet ? (
            <div className="text-center text-sm">
              Your KES {Number(bet.stake).toLocaleString()} bet: <span className="font-bold capitalize">{bet.status}</span>
              {bet.payout ? ` · won KES ${Number(bet.payout).toLocaleString()}` : ""}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-muted-foreground">Stake (KES)
                  <Input inputMode="numeric" value={stake} onChange={(e) => setStake(e.target.value)} className="mt-1" />
                </label>
                <label className="text-xs text-muted-foreground">Auto cash-out (x, optional)
                  <Input inputMode="decimal" placeholder="2.00" value={auto} onChange={(e) => setAuto(e.target.value)} className="mt-1" />
                </label>
              </div>
              <div className="flex gap-2">
                {[20, 50, 100, 500].map((v) => (
                  <Button key={v} variant="secondary" size="sm" className="flex-1" onClick={() => setStake(String(v))}>{v}</Button>
                ))}
              </div>
              <Button onClick={place} disabled={busy || r?.status !== "betting"} className="w-full h-12 font-bold">
                {r?.status === "betting" ? `Bet KES ${stake || 0}` : "Wait for next round"}
              </Button>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-border/50 bg-card p-4">
          <h2 className="text-sm font-bold mb-2">This round</h2>
          {(state?.feed ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No bets yet.</p>
          ) : (
            <ul className="divide-y divide-border/40 text-sm">
              {state!.feed.map((f: any) => (
                <li key={f.bet_id} className="flex justify-between py-1.5">
                  <span>{f.username ?? "Player"}</span>
                  <span className="tabular-nums">KES {Number(f.stake).toLocaleString()}{f.cashout_multiplier ? ` · ${Number(f.cashout_multiplier).toFixed(2)}x` : ""}</span>
                </li>
              ))}
            </ul>
          )}
          {r?.hash && <p className="mt-3 break-all text-[10px] text-muted-foreground">Fairness hash: {r.hash}</p>}
        </section>
        <p className="text-center text-[11px] text-muted-foreground">18+ only. Play responsibly.</p>
      </main>
      <MobileNav />
    </div>
  );
};

export default PopIt;
