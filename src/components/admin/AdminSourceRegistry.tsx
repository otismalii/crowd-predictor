import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Database, Plus, RefreshCw, Search, Globe, Zap, AlertTriangle } from "lucide-react";

interface SourceEntry {
  id: string;
  name: string;
  source_type: string;
  base_url: string | null;
  priority: number;
  is_active: boolean;
  last_fetched_at: string | null;
  last_error: string | null;
}

const AdminSourceRegistry = () => {
  const { toast } = useToast();
  const [sources, setSources] = useState<SourceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", source_type: "api", base_url: "", priority: 50 });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchSources(); }, []);

  const fetchSources = async () => {
    setLoading(true);
    const { data } = await supabase.from("source_registry").select("*").order("priority", { ascending: false });
    setSources(data || []);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!form.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    setSaving(true);
    const { error } = await supabase.from("source_registry").insert({
      name: form.name,
      source_type: form.source_type,
      base_url: form.base_url || null,
      priority: form.priority,
    });
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "✅ Source added" }); setAddOpen(false); setForm({ name: "", source_type: "api", base_url: "", priority: 50 }); fetchSources(); }
    setSaving(false);
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("source_registry").update({ is_active: !current }).eq("id", id);
    fetchSources();
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="font-display text-lg flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" /> Source Registry ({sources.length})
          </span>
          <div className="flex gap-2">
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="neon-glow"><Plus className="h-4 w-4 mr-1" /> Add Source</Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader><DialogTitle className="font-display">Add Source</DialogTitle></DialogHeader>
                <div className="space-y-3 py-2">
                  <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="SportMonks API" /></div>
                  <div><Label className="text-xs">Type</Label><Input value={form.source_type} onChange={e => setForm({ ...form, source_type: e.target.value })} placeholder="api / scraper / manual" /></div>
                  <div><Label className="text-xs">Base URL</Label><Input value={form.base_url} onChange={e => setForm({ ...form, base_url: e.target.value })} placeholder="https://api.example.com" /></div>
                  <div><Label className="text-xs">Priority ({form.priority})</Label><Input type="range" min={1} max={100} value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })} /></div>
                  <Button onClick={handleAdd} disabled={saving} className="w-full neon-glow">{saving ? "Adding..." : "Add Source"}</Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={fetchSources}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sources.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No sources registered. Add API sources and scrapers.</p>
        ) : (
          <div className="divide-y divide-border/30 max-h-[400px] overflow-y-auto">
            {sources.map(s => (
              <div key={s.id} className="py-3 px-2 flex items-center justify-between hover:bg-muted/20 rounded-lg">
                <div className="flex items-center gap-3">
                  {s.source_type === "api" ? <Globe className="h-4 w-4 text-primary" /> : <Zap className="h-4 w-4 text-accent" />}
                  <div>
                    <p className="text-sm font-semibold">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground">{s.source_type} • Priority: {s.priority}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {s.last_error && <span title={s.last_error}><AlertTriangle className="h-3.5 w-3.5 text-destructive" /></span>}
                  <Badge
                    variant={s.is_active ? "default" : "secondary"}
                    className="text-[10px] cursor-pointer"
                    onClick={() => toggleActive(s.id, s.is_active)}
                  >
                    {s.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminSourceRegistry;
