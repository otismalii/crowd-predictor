import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MoreHorizontal, Edit, Copy, Send, X, Download, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MarketStatusPill from "@/components/markets/MarketStatusPill";
import { callAdminAction, type AdminMarket } from "@/hooks/useMarketsAdmin";
import { SCHEMA_VERSION } from "@/lib/foundry/schema";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MarketAuditDrawer from "./MarketAuditDrawer";

type Props = { markets: AdminMarket[]; loading: boolean; onChange: () => void };

const MarketsTable = ({ markets, loading, onChange }: Props) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [auditFor, setAuditFor] = useState<AdminMarket | null>(null);
  const [editing, setEditing] = useState<AdminMarket | null>(null);
  const [reasonFor, setReasonFor] = useState<{ market: AdminMarket; action: "publish" | "close" | "cancel" } | null>(null);
  const [reason, setReason] = useState("");

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    try { await fn(); } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); onChange(); }
  };

  const exportMarket = async (m: AdminMarket) => {
    const { data: outcomes } = await supabase.from("market_outcomes").select("label,sort_order").eq("market_id", m.id).order("sort_order");
    const { data: sources } = await supabase.from("market_sources").select("source_name,source_url,source_type").eq("market_id", m.id);
    const pkg = {
      version: SCHEMA_VERSION,
      batchName: `${m.title.slice(0, 40)} export`,
      generatedBy: "admin-export",
      generatedAt: new Date().toISOString(),
      markets: [{
        question: m.title, slug: m.slug, category: m.category,
        closesAt: m.closes_at, imageUrl: m.image_url,
        outcomes: (outcomes ?? []).map((o: any) => ({ label: o.label })),
        sources: (sources ?? []).map((s: any) => ({ url: s.source_url ?? undefined, publisher: s.source_name, sourceType: s.source_type })),
      }],
    };
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `${m.slug ?? m.id}.json`; a.click();
  };

  const confirmSimple = async () => {
    if (!reasonFor || !reason.trim()) { toast.error("Reason required"); return; }
    await withBusy(reasonFor.market.id, async () => {
      await callAdminAction({ action: reasonFor.action, marketId: reasonFor.market.id, reason });
      toast.success(`Market ${reasonFor.action}ed`);
    });
    setReasonFor(null); setReason("");
  };

  if (loading) return <p className="text-sm text-muted-foreground py-8 text-center">Loading markets…</p>;
  if (!markets.length) return <p className="text-sm text-muted-foreground py-12 text-center">No markets in this state.</p>;

  return (
    <>
      <div className="rounded-lg border border-border/30 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3">Title</th>
              <th className="text-left p-3">Category</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3">Volume (KES)</th>
              <th className="text-left p-3">Closes</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {markets.map((m) => (
              <tr key={m.id} className="border-t border-border/20 hover:bg-muted/20">
                <td className="p-3 max-w-xs truncate font-medium">{m.title}</td>
                <td className="p-3 text-xs text-muted-foreground">{m.category}</td>
                <td className="p-3"><MarketStatusPill status={m.status} /></td>
                <td className="p-3 text-right tabular-nums">{Math.round(Number(m.total_volume || 0)).toLocaleString()}</td>
                <td className="p-3 text-xs text-muted-foreground">
                  {m.closes_at ? formatDistanceToNow(new Date(m.closes_at), { addSuffix: true }) : "—"}
                </td>
                <td className="p-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7" disabled={busy === m.id}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => setEditing(m)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => withBusy(m.id, async () => {
                        await callAdminAction({ action: "clone", marketId: m.id });
                        toast.success("Cloned as draft");
                      })}>
                        <Copy className="mr-2 h-4 w-4" /> Clone
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportMarket(m)}>
                        <Download className="mr-2 h-4 w-4" /> Export JSON
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {["draft", "review", "published"].includes(m.status) && (
                        <DropdownMenuItem onClick={() => setReasonFor({ market: m, action: "publish" })}>
                          <Send className="mr-2 h-4 w-4" /> Publish
                        </DropdownMenuItem>
                      )}
                      {["open", "active"].includes(m.status) && (
                        <DropdownMenuItem onClick={() => setReasonFor({ market: m, action: "close" })}>
                          <X className="mr-2 h-4 w-4" /> Close now
                        </DropdownMenuItem>
                      )}
                      {!["resolved", "settled", "cancelled", "archived"].includes(m.status) && (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setReasonFor({ market: m, action: "cancel" })}
                        >
                          <X className="mr-2 h-4 w-4" /> Cancel
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setAuditFor(m)}>
                        <ScrollText className="mr-2 h-4 w-4" /> View audit
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reason dialog */}
      <Dialog open={!!reasonFor} onOpenChange={(o) => { if (!o) { setReasonFor(null); setReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">{reasonFor?.action} market</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{reasonFor?.market.title}</p>
          <Textarea placeholder="Reason (required, audited)" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setReasonFor(null); setReason(""); }}>Cancel</Button>
            <Button onClick={confirmSimple} disabled={!reason.trim()}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <EditMarketDialog market={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChange(); }} />

      {/* Audit drawer */}
      <MarketAuditDrawer market={auditFor} onClose={() => setAuditFor(null)} />
    </>
  );
};

const EditMarketDialog = ({ market, onClose, onSaved }: { market: AdminMarket | null; onClose: () => void; onSaved: () => void }) => {
  const [title, setTitle] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useState(() => {
    if (market) {
      setTitle(market.title);
      setClosesAt(market.closes_at ? market.closes_at.slice(0, 16) : "");
    }
  });

  if (!market) return null;

  const save = async () => {
    if (!reason.trim()) { toast.error("Reason required"); return; }
    setSaving(true);
    try {
      await callAdminAction({
        action: "update", marketId: market.id, reason,
        patch: { title, closes_at: closesAt ? new Date(closesAt).toISOString() : market.closes_at },
      });
      toast.success("Market updated");
      onSaved();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={!!market} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit market</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label className="text-xs">Closes at</Label><Input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} /></div>
          <div><Label className="text-xs">Reason (required, audited)</Label><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !reason.trim()}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MarketsTable;
