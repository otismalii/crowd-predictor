import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { StatusPill, IssueList } from "./IssueBadge";
import type { RowResult } from "@/lib/foundry/schema";
import { CheckCircle2, AlertTriangle, XCircle, Upload, X, Download } from "lucide-react";
import Papa from "papaparse";

type Props = {
  rows: RowResult[];
  onPublish: (rowIndexes: number[]) => Promise<void>;
  onReject: (rowIndexes: number[]) => void;
  publishing?: boolean;
};

export const PreviewGrid = ({ rows, onPublish, onReject, publishing }: Props) => {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const summary = useMemo(() => ({
    total: rows.length,
    ready: rows.filter((r) => r.status === "ready").length,
    warning: rows.filter((r) => r.status === "warning").length,
    error: rows.filter((r) => r.status === "error").length,
  }), [rows]);

  const toggle = (i: number) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  };

  const publishable = rows.filter((r) => r.status !== "error").map((r) => r.rowIndex);
  const publishSelected = () => onPublish([...selected].filter((i) => rows[i]?.status !== "error"));
  const publishAll = () => onPublish(publishable);

  const exportErrors = () => {
    const errored = rows.filter((r) => r.issues.length > 0);
    const csv = Papa.unparse(errored.flatMap((r) => r.issues.map((iss) => ({
      row: r.rowIndex + 1, slug: r.slug ?? "", severity: iss.severity, field: iss.field ?? "", code: iss.code, message: iss.message,
    }))));
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `import-issues-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/50 bg-card/40 p-3">
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 font-medium"><CheckCircle2 className="h-4 w-4 text-primary" /> {summary.ready} Ready</span>
          <span className="flex items-center gap-1.5 text-yellow-500"><AlertTriangle className="h-4 w-4" /> {summary.warning} Warning</span>
          <span className="flex items-center gap-1.5 text-destructive"><XCircle className="h-4 w-4" /> {summary.error} Error</span>
          <span className="text-muted-foreground">of {summary.total}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportErrors} disabled={!summary.warning && !summary.error} className="gap-1.5">
            <Download className="h-4 w-4" /> Export issues
          </Button>
          <Button variant="outline" size="sm" onClick={() => onReject([...selected])} disabled={!selected.size} className="gap-1.5">
            <X className="h-4 w-4" /> Reject selected
          </Button>
          <Button variant="outline" size="sm" onClick={publishSelected} disabled={!selected.size || publishing} className="gap-1.5">
            <Upload className="h-4 w-4" /> Publish selected ({selected.size})
          </Button>
          <Button size="sm" onClick={publishAll} disabled={!publishable.length || publishing} className="gap-1.5">
            <Upload className="h-4 w-4" /> Publish all ready ({publishable.length})
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => {
          const m = r.normalized;
          return (
            <Card key={r.rowIndex} className="p-3 space-y-2 relative">
              <div className="flex items-start gap-2">
                <Checkbox checked={selected.has(r.rowIndex)} onCheckedChange={() => toggle(r.rowIndex)} disabled={r.status === "error"} className="mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-muted-foreground">Row {r.rowIndex + 1}</span>
                    <StatusPill status={r.status} />
                  </div>
                  <p className="font-medium text-sm leading-snug mt-1 line-clamp-2">
                    {m?.question ?? (r.raw as any)?.question ?? "—"}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2 text-[11px] text-muted-foreground">
                    {m?.category && <span className="rounded bg-muted px-1.5 py-0.5">{m.category}</span>}
                    {m?.marketType && <span className="rounded bg-muted px-1.5 py-0.5">{m.marketType}</span>}
                    {m?.outcomes && <span className="rounded bg-muted px-1.5 py-0.5">{m.outcomes.length} outcomes</span>}
                    {m?.initialLiquidity != null && <span className="rounded bg-muted px-1.5 py-0.5">L {m.initialLiquidity}</span>}
                    {m?.closesAt && <span className="rounded bg-muted px-1.5 py-0.5">closes {new Date(m.closesAt).toLocaleDateString()}</span>}
                  </div>
                  <IssueList issues={r.issues} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
