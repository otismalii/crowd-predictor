import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Ticket, Trash2, X, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useBetSlip } from "@/contexts/BetSlipContext";
import { useAuth } from "@/contexts/AuthContext";
import { placeBet, repriceSelections } from "@/services/sportsbookService";
import { formatKES } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

const QUICK_STAKES = [50, 100, 250, 500, 1000];
const MIN_STAKE = 20;

const BetSlipDrawer = () => {
  const {
    selections, stake, setStake, isOpen, open, close,
    removeSelection, replaceSelections, clear, combinedOdds, potentialPayout, slipType,
  } = useBetSlip();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [priceMoves, setPriceMoves] = useState<{ label: string; from: number; to: number }[]>([]);
  const [dropped, setDropped] = useState<string[]>([]);
  const lastSubmit = useRef(0);

  const count = selections.length;

  const submit = async () => {
    if (!user) {
      close();
      navigate("/auth");
      return;
    }
    // Duplicate-tap guard.
    if (Date.now() - lastSubmit.current < 5000) return;

    setSubmitting(true);

    // Re-read live prices first so the player accepts the real price, not a stale one.
    const priced = await repriceSelections(selections);

    if (priced.dropped.length > 0) {
      setDropped(priced.dropped.map((s) => `${s.selectionLabel} — ${s.matchLabel}`));
      setPriceMoves([]);
      replaceSelections(priced.updated);
      setSubmitting(false);
      return;
    }

    if (priced.changed.length > 0 && priceMoves.length === 0) {
      setDropped([]);
      setPriceMoves(
        priced.changed.map((c) => ({ label: c.selection.selectionLabel, from: c.from, to: c.to })),
      );
      replaceSelections(priced.updated);
      setSubmitting(false);
      return;
    }

    lastSubmit.current = Date.now();
    const { data, error } = await placeBet({
      selections: priced.updated,
      stake,
      idempotencyKey: `slip:${user.id}:${lastSubmit.current}:${priced.updated.map((s) => s.matchId).join(",")}`,
    });
    setSubmitting(false);

    if (error) {
      toast({ title: "Bet not placed", description: error, variant: "destructive" });
      return;
    }
    setPriceMoves([]);
    setDropped([]);
    toast({
      title: slipType === "acca" ? "Accumulator placed" : "Bet placed",
      description: `KES ${formatKES(stake)} to return KES ${formatKES(data?.potential_payout ?? potentialPayout)}`,
    });
    clear();
    close();
    navigate("/my-bets");
  };


  return (
    <>
      {/* Floating slip trigger */}
      <AnimatePresence>
        {count > 0 && !isOpen && (
          <motion.button
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            onClick={open}
            className="fixed bottom-20 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-primary/40 bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg md:bottom-6"
          >
            <Ticket className="h-4 w-4" />
            Bet slip
            <Badge variant="secondary" className="h-5 px-1.5 tabular-nums">{count}</Badge>
          </motion.button>
        )}
      </AnimatePresence>

      <Sheet open={isOpen} onOpenChange={(v) => (v ? open() : close())}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl md:max-w-md md:rounded-none" >
          <SheetHeader className="mb-3 flex-row items-center justify-between space-y-0">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Ticket className="h-4 w-4 text-primary" />
              {slipType === "acca" ? `${count}-fold accumulator` : "Bet slip"}
            </SheetTitle>
            {count > 0 && (
              <Button variant="ghost" size="sm" onClick={clear} className="h-8 text-muted-foreground">
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </SheetHeader>

          {count === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Your slip is empty. Tap any odds to add a selection.
            </p>
          ) : (
            <div className="space-y-3">
              <ul className="space-y-2">
                {selections.map((s) => (
                  <li
                    key={`${s.matchId}-${s.market}-${s.selection}-${s.line ?? ""}`}
                    className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{s.selectionLabel}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{s.marketLabel}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{s.matchLabel}</p>
                    </div>
                    <span className="font-display text-sm font-bold tabular-nums">{s.odds.toFixed(2)}</span>
                    <button
                      onClick={() => removeSelection(s.matchId, s.market, s.selection, s.line)}
                      aria-label="Remove selection"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>

              {dropped.length > 0 && (
                <div className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs">
                  <p className="flex items-center gap-1.5 font-semibold text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" /> No longer available
                  </p>
                  {dropped.map((d) => <p key={d} className="text-muted-foreground">{d}</p>)}
                  <p className="text-muted-foreground">Removed from your slip — tap place bet again to continue.</p>
                </div>
              )}

              {priceMoves.length > 0 && (
                <div className="space-y-1 rounded-lg border border-primary/40 bg-primary/10 p-2.5 text-xs">
                  <p className="font-semibold text-primary">Odds changed</p>
                  {priceMoves.map((m) => (
                    <p key={m.label} className="flex items-center gap-1.5 text-muted-foreground">
                      {m.to > m.from
                        ? <TrendingUp className="h-3.5 w-3.5 text-primary" />
                        : <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
                      {m.label}: {m.from.toFixed(2)} → <span className="font-semibold text-foreground">{m.to.toFixed(2)}</span>
                    </p>
                  ))}
                  <p className="text-muted-foreground">Tap again to accept the new price.</p>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <label htmlFor="stake" className="text-xs font-medium text-muted-foreground">
                  Stake (KES) — minimum {MIN_STAKE}
                </label>
                <Input
                  id="stake"
                  type="number"
                  min={MIN_STAKE}
                  inputMode="numeric"
                  value={stake}
                  onChange={(e) => setStake(Math.max(0, Number(e.target.value)))}
                  className="text-base font-semibold tabular-nums"
                />
                <div className="flex gap-1.5">
                  {QUICK_STAKES.map((v) => (
                    <Button key={v} variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setStake(v)}>
                      {v}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1 rounded-lg bg-muted/30 p-3 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Total odds</span>
                  <span className="font-semibold tabular-nums text-foreground">{combinedOdds.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Potential payout</span>
                  <span className="font-display font-bold tabular-nums text-primary">
                    KES {formatKES(potentialPayout)}
                  </span>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                disabled={submitting || stake < MIN_STAKE}
                onClick={submit}
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {!user
                  ? "Sign in to bet"
                  : priceMoves.length > 0
                    ? `Accept new odds — KES ${formatKES(stake)}`
                    : `Place bet — KES ${formatKES(stake)}`}
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">
                Stakes are debited immediately. Payouts settle automatically when the match finishes.
              </p>

            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};

export default BetSlipDrawer;
