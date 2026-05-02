import { useEffect, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Event {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string | null;
  actor_id: string | null;
  payload: any;
  idempotency_key: string | null;
  created_at: string;
}

const AdminEventStreamPage = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("event_log")
        .select("*").order("created_at", { ascending: false }).limit(200);
      setEvents(data as Event[] || []);
      setLoading(false);
    };
    load();
    const channel = supabase.channel(`event-stream-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "event_log" },
        (p) => setEvents(prev => [p.new as Event, ...prev].slice(0, 200)))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = filter
    ? events.filter(e =>
        e.event_type.includes(filter) ||
        e.aggregate_type.includes(filter) ||
        (e.actor_id || "").includes(filter) ||
        JSON.stringify(e.payload).includes(filter))
    : events;

  return (
    <div className="min-h-screen bg-background">
      <Helmet><title>Event Stream · Pagaza Admin</title></Helmet>
      <Navbar />
      <main className="container py-8 pb-24 space-y-4">
        <header>
          <h1 className="font-display text-2xl font-bold tracking-wider">Event Stream</h1>
          <p className="text-xs text-muted-foreground mt-1">Live tail · filter by type, actor, or correlation id</p>
        </header>

        <Input
          placeholder="Filter events…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-md"
        />

        <Card>
          <CardHeader><CardTitle className="text-sm font-display tracking-wider">{filtered.length} events</CardTitle></CardHeader>
          <CardContent>
            {loading ? <p className="text-xs text-muted-foreground">Loading…</p> : (
              <div className="space-y-1.5 max-h-[700px] overflow-y-auto font-mono text-[11px]">
                {filtered.map(e => (
                  <div key={e.id} className="p-2 rounded bg-muted/30 border border-border/20">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="secondary" className="text-[10px]">{e.event_type}</Badge>
                      <span className="text-muted-foreground">{new Date(e.created_at).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-muted-foreground">
                      <span>actor:{e.actor_id?.slice(0, 8) ?? "—"}</span> ·{" "}
                      <span>aggregate:{e.aggregate_type}/{e.aggregate_id?.slice(0, 8) ?? "—"}</span>
                    </div>
                    <pre className="mt-1 text-[10px] text-muted-foreground/80 overflow-x-auto">{JSON.stringify(e.payload, null, 0)}</pre>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default AdminEventStreamPage;
