import { useEffect, useState } from "react";
import { AdminPageHeader, AdminPageBody, AdminSectionCard, AdminEmptyState, AdminConfirmDialog } from "@/components/admin/primitives";
import { adminAction, fetchMatchConsole, fetchMatchOdds, type ConsoleMatch, type ConsoleOdds } from "@/services/adminService";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Workflow, RefreshCw, ChevronDown, ChevronRight, Gavel, Ban, Pencil, Lock, Unlock,
  CircleDollarSign, Clock,
} from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

type StatusTab = "live" | "upcoming" | "finished" | "void";

const TAB_STATUSES: Record<StatusTab, string[]> = {
  live: ["live"],
  upcoming: ["upcoming"],
  finished: ["finished"],
  void: ["postponed", "cancelled"],
};

const statusPill = (status: string) =>
  ({
    live: "bg-destructive/20 text-destructive",
    upcoming: "bg-accent/20 text-accent",
    finished: "bg-muted text-muted-foreground",
    postponed: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/20 text-destructive",
  }[status] || "bg-muted text-muted-foreground");

type Pending =
  | { kind: "settle"; match: ConsoleMatch }
  | { kind: "void"; match: ConsoleMatch }
  | { kind: "score"; match: ConsoleMatch; home: string; away: string; status: string }
  | { kind: "override"; odds: ConsoleOdds; oddsValue: string }
  | { kind: "reset_odds"; odds: ConsoleOdds }
  | { kind: "suspend"; odds: ConsoleOdds }
  | { kind: "unsuspend"; odds: ConsoleOdds };

const AdminSettlementsPage = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState<StatusTab>("live");
  const [matches, setMatches] = useState<ConsoleMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [odds, setOdds] = useState<Record<string, ConsoleOdds[]>>({});
  const [oddsLoading, setOddsLoading] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [scoreDraft, setScoreDraft] = useState({ home: "", away: "", status: "finished" });
  const [oddsDraft, setOddsDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await fetchMatchConsole(TAB_STATUSES[tab]);
    setMatches(data || []);
    setExpanded(null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tab]);

  const toggleMatch = async (matchId: string) => {
    if (expanded === matchId) return setExpanded(null);
    setExpanded(matchId);
    if (!odds[matchId]) {
      setOddsLoading(true);
      const { data } = await fetchMatchOdds(matchId);
      setOdds(prev => ({ ...prev, [matchId]: data || [] }));
      setOddsLoading(false);
    }
  };

  const runAction = async (fn: string, body: Record<string, unknown>) => {
    const res = await adminAction("admin-sportsbook-actions", { action: fn, ...body });
    if (!res.ok) {
      toast({ title: "Action failed", description: res.error, variant: "destructive" });
      return false;
    }
    toast({ title: "✅ Action applied", description: `${fn} completed and audited` });
    return true;
  };

  const handleConfirm = async () => {
    if (!pending) return;
    setBusy(true);
    let ok = false;
    try {
      switch (pending.kind) {
        case "settle":
          ok = await runAction("settle_match", { match_id: pending.match.id });
          break;
        case "void":
          ok = await runAction("void_match", { match_id: pending.match.id });
          break;
        case "score":
          ok = await runAction("update_score", {
            match_id: pending.match.id,
            home_score: Number(pending.home),
            away_score: Number(pending.away),
            status: pending.status,
          });
          break;
        case "override":
          ok = await runAction("override_odds", { odds_id: pending.odds.id, odds: Number(pending.oddsValue) });
          break;
        case "reset_odds":
          ok = await runAction("reset_odds", { odds_id: pending.odds.id });
          break;
        case "suspend":
          ok = await runAction("suspend", { odds_id: pending.odds.id });
          break;
        case "unsuspend":
          ok = await runAction("unsuspend", { odds_id: pending.odds.id });
          break;
      }
    } finally {
      setBusy(false);
      if (ok) {
        setPending(null);
        load();
      }
    }
  };

  const openPending = (p: Pending) => {
    setPending(p);
    if (p.kind === "score") {
      setScoreDraft({
        home: String(p.match.home_score ?? ""),
        away: String(p.match.away_score ?? ""),
        status: p.match.status === "live" ? "finished" : p.match.status,
      });
    }
    if (p.kind === "override") setOddsDraft(String(p.odds.override_odds ?? p.odds.generated_odds));
  };

  const pendingDescription = () => {
    if (!pending) return "";
    if (pending.kind === "settle")
      return `Settle all bets on ${pending.match.home_team?.name} vs ${pending.match.away_team?.name} from the final score (${pending.match.home_score ?? "?"}-${pending.match.away_score ?? "?"}). Payouts are credited from the ledger.`;
    if (pending.kind === "void")
      return `Void ${pending.match.home_team?.name} vs ${pending.match.away_team?.name}. All stakes on this match are refunded and slips regraded.`;
    if (pending.kind === "override")
      return `Override ${pending.odds.market} · ${pending.odds.selection} to ${pending.oddsValue || "—"}. New bets use this price.`;
    if (pending.kind === "reset_odds")
      return `Clear the manual override on ${pending.odds.market} · ${pending.odds.selection} and return to the generated price.`;
    if (pending.kind === "suspend")
      return `Suspend ${pending.odds.market} · ${pending.odds.selection} — players can no longer bet this line.`;
    if (pending.kind === "unsuspend")
      return `Re-open ${pending.odds.market} · ${pending.odds.selection} for betting.`;
    return "";
  };

  const pendingTitle = () => {
    if (!pending) return "";
    const labels: Record<Pending["kind"], string> = {
      settle: "🦅 Settle Match",
      void: "Void Match",
      score: "Update Score",
      override: "Override Odds",
      reset_odds: "Reset Odds",
      suspend: "Suspend Market",
      unsuspend: "Unsuspend Market",
    };
    return labels[pending.kind];
  };

  const extraField = () => {
    if (!pending) return null;
    if (pending.kind === "score") {
      return (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">Home</label>
            <Input value={scoreDraft.home} onChange={e => setScoreDraft(d => ({ ...d, home: e.target.value }))} className="h-9" inputMode="numeric" />
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">Away</label>
            <Input value={scoreDraft.away} onChange={e => setScoreDraft(d => ({ ...d, away: e.target.value }))} className="h-9" inputMode="numeric" />
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">Status</label>
            <select
              value={scoreDraft.status}
              onChange={e => setScoreDraft(d => ({ ...d, status: e.target.value }))}
              className="h-9 w-full px-2 rounded-lg border border-border/50 bg-background text-xs"
            >
              <option value="live">live</option>
              <option value="finished">finished</option>
              <option value="postponed">postponed</option>
              <option value="cancelled">cancelled</option>
            </select>
          </div>
        </div>
      );
    }
    if (pending.kind === "override") {
      return (
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">New odds (1.01 – 1000)</label>
          <Input value={oddsDraft} onChange={e => setOddsDraft(e.target.value)} className="h-9" inputMode="decimal" />
        </div>
      );
    }
    return null;
  };

  const canSubmit = () => {
    if (!pending) return false;
    if (pending.kind === "score") return scoreDraft.home !== "" && scoreDraft.away !== "";
    if (pending.kind === "override") {
      const n = Number(oddsDraft);
      return Number.isFinite(n) && n >= 1.01 && n <= 1000;
    }
    return true;
  };

  return (
    <>
      <AdminPageHeader
        icon={Workflow}
        title="Settlements"
        subtitle="Live fixtures, odds control and 1-click settlement — every action audited"
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        }
      />
      <AdminPageBody>
        <div className="flex gap-0.5 p-0.5 bg-muted/50 rounded-xl border border-border/30 w-fit mb-4">
          {(["live", "upcoming", "finished", "void"] as StatusTab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-3.5 py-2 rounded-lg text-xs font-medium capitalize transition-all min-h-[40px] ${
                tab === t ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === t && (
                <motion.div layoutId="settlements-tab" className="absolute inset-0 bg-primary rounded-lg" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
              )}
              <span className="relative z-10">{t === "void" ? "postponed / void" : t}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-14 rounded-xl border border-border/30 animate-pulse bg-muted/20" />)}</div>
        ) : matches.length === 0 ? (
          <AdminEmptyState icon={Clock} title={`No ${tab} matches`} description="Fixtures arrive automatically from the provider sync feed." />
        ) : (
          <div className="rounded-xl border border-border/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/30">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Match</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Competition</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Kickoff</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Score</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map(m => {
                    const isExpanded = expanded === m.id;
                    const canSettle = m.status === "finished" || m.status === "live";
                    const canVoid = ["upcoming", "live", "postponed"].includes(m.status);
                    return (
                      <>
                        <tr key={m.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <button onClick={() => toggleMatch(m.id)} className="flex items-center gap-2 text-left group">
                              {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-primary" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary" />}
                              <span className="font-medium">
                                {m.home_team?.short_name || "?"} <span className="text-muted-foreground">vs</span> {m.away_team?.short_name || "?"}
                              </span>
                            </button>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{m.competition?.name || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{format(new Date(m.kickoff_at), "MMM d, HH:mm")}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${statusPill(m.status)}`}>
                              {m.status}{m.minute != null ? ` · ${m.minute}'` : ""}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-display font-bold tabular-nums">
                            {m.home_score ?? "–"} : {m.away_score ?? "–"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-primary hover:bg-primary/10" onClick={() => openPending({ kind: "score", match: m, home: String(m.home_score ?? 0), away: String(m.away_score ?? 0), status: m.status })}>
                                <Pencil className="h-3 w-3" /> Score
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs gap-1 text-primary hover:bg-primary/10"
                                disabled={!canSettle}
                                onClick={() => openPending({ kind: "settle", match: m })}
                              >
                                <CircleDollarSign className="h-3 w-3" /> Settle
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs gap-1 text-destructive hover:bg-destructive/10"
                                disabled={!canVoid}
                                onClick={() => openPending({ kind: "void", match: m })}
                              >
                                <Ban className="h-3 w-3" /> Void
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${m.id}-odds`} className="border-b border-border/20 bg-muted/10">
                            <td colSpan={6} className="px-4 py-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Gavel className="h-3.5 w-3.5 text-primary" />
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Odds control</span>
                              </div>
                              {oddsLoading && !odds[m.id] ? (
                                <p className="text-muted-foreground text-xs">Loading markets…</p>
                              ) : (odds[m.id] || []).length === 0 ? (
                                <p className="text-muted-foreground text-xs">No odds generated for this match yet.</p>
                              ) : (
                                <div className="space-y-1">
                                  {(odds[m.id] || []).map(o => (
                                    <div key={o.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-border/10 last:border-0">
                                      <span className="w-32 truncate font-medium">{o.market}{o.line != null ? ` ${o.line}` : ""}</span>
                                      <span className="w-28 text-muted-foreground">{o.selection}</span>
                                      <span className="font-display font-bold tabular-nums">{Number(o.override_odds ?? o.generated_odds).toFixed(2)}</span>
                                      {o.override_odds != null && <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/20 text-accent font-semibold">OVERRIDE</span>}
                                      {o.is_suspended && <span className="text-[9px] px-1.5 py-0.5 rounded bg-destructive/20 text-destructive font-semibold">SUSPENDED</span>}
                                      <span className="flex-1" />
                                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => openPending({ kind: "override", odds: o, oddsValue: String(o.odds ?? "") })}>
                                        Override
                                      </Button>
                                      {o.override_odds != null && (
                                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => openPending({ kind: "reset_odds", odds: o })}>
                                          Reset
                                        </Button>
                                      )}
                                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => openPending({ kind: o.is_suspended ? "unsuspend" : "suspend", odds: o })}>
                                        {o.is_suspended ? <><Unlock className="h-3 w-3" /> Open</> : <><Lock className="h-3 w-3" /> Suspend</>}
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </AdminPageBody>

      <AdminConfirmDialog
        open={!!pending}
        onOpenChange={(v) => { if (!v) setPending(null); }}
        title={pendingTitle()}
        description={
          <>
            {pendingDescription()}
            {extraField()}
          </>
        }
        confirmLabel={pending?.kind === "void" ? "Void & refund" : "Confirm"}
        destructive={pending?.kind === "void"}
        requireReason={pending?.kind !== "override" && pending?.kind !== "score" && pending?.kind !== "unsuspend"}
        onConfirm={handleConfirm}
      />
    </>
  );
};

export default AdminSettlementsPage;
