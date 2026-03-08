import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Database, Plus, Trash2, Edit, RefreshCw, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface Match {
  id: string;
  home_team: string;
  away_team: string;
  league: string;
  kickoff: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  external_match_id: string | null;
}

interface AdminMatchesProps {
  matches: Match[];
  onRefresh: () => void;
}

const MATCH_STATUSES = ["upcoming", "live", "finished", "postponed", "cancelled"];

const AdminMatches = ({ matches, onRefresh }: AdminMatchesProps) => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editMatch, setEditMatch] = useState<Match | null>(null);
  const [form, setForm] = useState({
    home_team: "",
    away_team: "",
    league: "",
    kickoff: "",
    status: "upcoming" as string,
    home_score: "",
    away_score: "",
  });
  const [saving, setSaving] = useState(false);

  const resetForm = () => setForm({ home_team: "", away_team: "", league: "", kickoff: "", status: "upcoming", home_score: "", away_score: "" });

  const openAdd = () => { resetForm(); setEditMatch(null); setAddOpen(true); };
  const openEdit = (m: Match) => {
    setEditMatch(m);
    setForm({
      home_team: m.home_team,
      away_team: m.away_team,
      league: m.league,
      kickoff: m.kickoff ? new Date(m.kickoff).toISOString().slice(0, 16) : "",
      status: m.status,
      home_score: m.home_score?.toString() || "",
      away_score: m.away_score?.toString() || "",
    });
    setAddOpen(true);
  };

  const handleSave = async () => {
    if (!form.home_team || !form.away_team || !form.league || !form.kickoff) {
      toast({ title: "Missing fields", description: "Fill in all required fields.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      home_team: form.home_team,
      away_team: form.away_team,
      league: form.league,
      kickoff: new Date(form.kickoff).toISOString(),
      status: form.status as any,
      home_score: form.home_score ? parseInt(form.home_score) : null,
      away_score: form.away_score ? parseInt(form.away_score) : null,
    };

    if (editMatch) {
      const { error } = await supabase.from("matches").update(payload).eq("id", editMatch.id);
      if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
      else toast({ title: "✅ Match updated" });
    } else {
      const { error } = await supabase.from("matches").insert(payload);
      if (error) toast({ title: "Insert failed", description: error.message, variant: "destructive" });
      else toast({ title: "✅ Match added" });
    }
    setSaving(false);
    setAddOpen(false);
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("matches").delete().eq("id", id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else { toast({ title: "🗑️ Match deleted" }); onRefresh(); }
  };

  const filtered = matches.filter((m) => {
    const matchesSearch = `${m.home_team} ${m.away_team} ${m.league}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusColor = (s: string) => {
    if (s === "live") return "bg-destructive/20 text-destructive animate-pulse";
    if (s === "finished") return "bg-muted text-muted-foreground";
    if (s === "upcoming") return "bg-primary/20 text-primary";
    return "bg-accent/20 text-accent";
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-display text-lg flex items-center gap-2">
            <Database className="h-5 w-5" /> Matches ({filtered.length})
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-48" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {MATCH_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="neon-glow" onClick={openAdd}>
                  <Plus className="mr-1 h-4 w-4" /> Add Match
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="font-display">{editMatch ? "Edit Match" : "Add Match"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Home Team *</Label>
                      <Input value={form.home_team} onChange={(e) => setForm({ ...form, home_team: e.target.value })} placeholder="Arsenal" />
                    </div>
                    <div>
                      <Label className="text-xs">Away Team *</Label>
                      <Input value={form.away_team} onChange={(e) => setForm({ ...form, away_team: e.target.value })} placeholder="Chelsea" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">League *</Label>
                      <Input value={form.league} onChange={(e) => setForm({ ...form, league: e.target.value })} placeholder="Premier League" />
                    </div>
                    <div>
                      <Label className="text-xs">Kickoff *</Label>
                      <Input type="datetime-local" value={form.kickoff} onChange={(e) => setForm({ ...form, kickoff: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Status</Label>
                      <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MATCH_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Home Score</Label>
                      <Input type="number" value={form.home_score} onChange={(e) => setForm({ ...form, home_score: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Away Score</Label>
                      <Input type="number" value={form.away_score} onChange={(e) => setForm({ ...form, away_score: e.target.value })} />
                    </div>
                  </div>
                  <Button onClick={handleSave} disabled={saving} className="neon-glow">
                    {saving ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : editMatch ? "Update Match" : "Add Match"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border/50 max-h-[500px] overflow-y-auto">
          <AnimatePresence>
            {filtered.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-between py-3 px-2 hover:bg-muted/20 rounded-lg transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{m.home_team} vs {m.away_team}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.league} • {new Date(m.kickoff).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {m.status === "finished" && (
                    <span className="text-sm font-bold text-primary">{m.home_score}-{m.away_score}</span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(m.status)}`}>{m.status}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEdit(m)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive" onClick={() => handleDelete(m.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No matches found. Add one or sync from API!</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminMatches;
