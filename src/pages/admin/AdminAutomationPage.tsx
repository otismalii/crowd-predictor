import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader, AdminStatGrid, AdminEmptyState } from "@/components/admin/primitives";
import { Activity, CheckCircle2, XCircle, Clock, Zap, Play, Ban, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type JobDef = {
  job_type: string; display_name: string; description: string | null;
  handler: string; cron_expression: string | null; enabled: boolean;
  timeout_seconds: number; owner_group: string;
};
type Health = {
  job_type: string; display_name: string; enabled: boolean; cron_expression: string | null;
  last_run: string | null; next_run: string | null;
  pending_count: number; running_count: number;
  success_24h: number; failure_24h: number; avg_duration_ms: number;
};
type Run = {
  id: string; job_type: string; status: string; scheduled_by: string;
  attempts: number; max_attempts: number;
  run_after: string; started_at: string | null; finished_at: string | null;
  duration_ms: number | null; last_error: string | null; result: any; payload: any;
  cancel_reason: string | null; created_at: string;
};

const statusColor: Record<string, string> = {
  queued: "bg-muted text-muted-foreground",
  running: "bg-primary/20 text-primary border-primary/40",
  succeeded: "bg-green-500/15 text-green-500 border-green-500/40",
  failed: "bg-destructive/15 text-destructive border-destructive/40",
  cancelled: "bg-muted text-muted-foreground",
};

export default function AdminAutomationPage() {
  const [defs, setDefs] = useState<JobDef[]>([]);
  const [health, setHealth] = useState<Health[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Run | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Run | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const load = async () => {
    const [d, h, r] = await Promise.all([
      supabase.from("job_definitions" as any).select("*").order("owner_group"),
      supabase.from("v_job_health" as any).select("*"),
      supabase.from("system_jobs").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setDefs(((d.data as unknown) as JobDef[]) ?? []);
    setHealth(((h.data as unknown) as Health[]) ?? []);
    setRuns(((r.data as unknown) as Run[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`admin-jobs-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "system_jobs" }, () => load())
      .subscribe();
    const interval = setInterval(load, 15_000);
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, []);

  const stats = useMemo(() => {
    const queued = runs.filter(r => r.status === "queued").length;
    const running = runs.filter(r => r.status === "running").length;
    const success = health.reduce((a, h) => a + (h.success_24h ?? 0), 0);
    const failed = health.reduce((a, h) => a + (h.failure_24h ?? 0), 0);
    const avgMs = health.length
      ? Math.round(health.reduce((a, h) => a + (h.avg_duration_ms ?? 0), 0) / Math.max(1, health.filter(h => h.avg_duration_ms).length))
      : 0;
    return [
      { label: "Queued", value: queued, icon: Clock, tone: "muted" as const },
      { label: "Running", value: running, icon: Activity, tone: "primary" as const },
      { label: "Succeeded (24h)", value: success, icon: CheckCircle2, tone: "accent" as const },
      { label: "Failed (24h)", value: failed, icon: XCircle, tone: "destructive" as const },
      { label: "Avg latency", value: `${avgMs}ms`, icon: Zap },
    ];
  }, [runs, health]);

  const runNow = async (jobType: string) => {
    const { error } = await supabase.functions.invoke("jobs-enqueue", {
      body: { job_type: jobType, reason: "manual run from admin dashboard" },
    });
    if (error) toast.error("Enqueue failed: " + error.message);
    else { toast.success(`Enqueued ${jobType}`); load(); }
  };

  const toggleEnabled = async (jobType: string, enabled: boolean) => {
    const { error } = await supabase.from("job_definitions").update({ enabled }).eq("job_type", jobType);
    if (error) toast.error(error.message);
    else { toast.success(enabled ? "Enabled" : "Paused"); load(); }
  };

  const submitCancel = async () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    const { error } = await supabase.functions.invoke("jobs-cancel", {
      body: { job_id: cancelTarget.id, reason: cancelReason.trim() },
    });
    if (error) toast.error("Cancel failed: " + error.message);
    else { toast.success("Job cancelled"); setCancelTarget(null); setCancelReason(""); load(); }
  };

  const healthByType = useMemo(() => Object.fromEntries(health.map(h => [h.job_type, h])), [health]);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <AdminPageHeader
        title="Automation"
        subtitle="Background jobs, cron schedules, and worker health."
        actions={<Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh</Button>}
      />

      <AdminStatGrid stats={stats} cols={5} />

      <Tabs defaultValue="definitions">
        <TabsList>
          <TabsTrigger value="definitions">Job Definitions</TabsTrigger>
          <TabsTrigger value="runs">Live Runs</TabsTrigger>
        </TabsList>

        <TabsContent value="definitions" className="mt-3">
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Cron</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Success 24h</TableHead>
                  <TableHead className="text-right">Failed 24h</TableHead>
                  <TableHead className="text-right">Avg ms</TableHead>
                  <TableHead>Last run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defs.map(d => {
                  const h = healthByType[d.job_type];
                  return (
                    <TableRow key={d.job_type}>
                      <TableCell>
                        <div className="font-medium">{d.display_name}</div>
                        <div className="text-xs text-muted-foreground">{d.job_type}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{d.cron_expression ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline">{d.owner_group}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums text-green-500">{h?.success_24h ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">{h?.failure_24h ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{h?.avg_duration_ms ?? 0}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {h?.last_run ? formatDistanceToNow(new Date(h.last_run), { addSuffix: true }) : "never"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={d.enabled ? "default" : "secondary"}>{d.enabled ? "Enabled" : "Paused"}</Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="ghost" onClick={() => runNow(d.job_type)}>
                          <Play className="h-3.5 w-3.5 mr-1" />Run
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleEnabled(d.job_type, !d.enabled)}>
                          {d.enabled ? "Pause" : "Enable"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {defs.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={9}><AdminEmptyState title="No job definitions" description="Add rows to job_definitions to schedule work." /></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="runs" className="mt-3">
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map(r => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setDetail(r)}>
                    <TableCell className="font-medium">{r.job_type}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColor[r.status] ?? ""}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.scheduled_by}</TableCell>
                    <TableCell className="tabular-nums text-xs">{r.attempts}/{r.max_attempts}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.started_at ? formatDistanceToNow(new Date(r.started_at), { addSuffix: true }) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {r.duration_ms ? `${r.duration_ms}ms` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {(r.status === "queued" || r.status === "running") && (
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setCancelTarget(r); }}>
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {runs.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={7}><AdminEmptyState title="No job runs yet" description="Cron will enqueue jobs shortly, or click Run on a definition." /></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detail?.job_type}</DialogTitle>
            <DialogDescription>Run detail · {detail?.id}</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-xs text-muted-foreground">Status</div><Badge variant="outline" className={statusColor[detail.status]}>{detail.status}</Badge></div>
                <div><div className="text-xs text-muted-foreground">Trigger</div>{detail.scheduled_by}</div>
                <div><div className="text-xs text-muted-foreground">Attempts</div>{detail.attempts}/{detail.max_attempts}</div>
                <div><div className="text-xs text-muted-foreground">Duration</div>{detail.duration_ms ?? 0}ms</div>
              </div>
              {detail.last_error && (
                <div>
                  <div className="text-xs text-destructive mb-1">Error</div>
                  <pre className="bg-destructive/10 text-destructive text-xs p-2 rounded overflow-auto max-h-40">{detail.last_error}</pre>
                </div>
              )}
              <div>
                <div className="text-xs text-muted-foreground mb-1">Payload</div>
                <pre className="bg-muted text-xs p-2 rounded overflow-auto max-h-40">{JSON.stringify(detail.payload, null, 2)}</pre>
              </div>
              {detail.result && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Result</div>
                  <pre className="bg-muted text-xs p-2 rounded overflow-auto max-h-40">{JSON.stringify(detail.result, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel job</DialogTitle>
            <DialogDescription>Provide a reason (audit-logged).</DialogDescription>
          </DialogHeader>
          <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason for cancellation..." rows={3} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelTarget(null)}>Back</Button>
            <Button variant="destructive" onClick={submitCancel} disabled={!cancelReason.trim()}>Cancel job</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
