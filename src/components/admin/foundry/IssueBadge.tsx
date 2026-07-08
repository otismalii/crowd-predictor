import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { Issue } from "@/lib/foundry/schema";
import { cn } from "@/lib/utils";

export const StatusPill = ({ status }: { status: "ready" | "warning" | "error" | "published" | "rejected" | "publishing" | "failed" }) => {
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    ready: { label: "Ready", cls: "bg-primary/15 text-primary", icon: CheckCircle2 },
    warning: { label: "Warning", cls: "bg-yellow-500/15 text-yellow-500", icon: AlertTriangle },
    error: { label: "Error", cls: "bg-destructive/15 text-destructive", icon: AlertCircle },
    published: { label: "Published", cls: "bg-emerald-500/15 text-emerald-500", icon: CheckCircle2 },
    publishing: { label: "Publishing…", cls: "bg-blue-500/15 text-blue-500", icon: Info },
    rejected: { label: "Rejected", cls: "bg-muted text-muted-foreground", icon: AlertCircle },
    failed: { label: "Failed", cls: "bg-destructive/15 text-destructive", icon: AlertCircle },
  };
  const cfg = map[status] ?? map.ready;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", cfg.cls)}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </span>
  );
};

export const IssueList = ({ issues }: { issues: Issue[] }) => {
  if (!issues.length) return null;
  return (
    <ul className="mt-2 space-y-1 text-xs">
      {issues.map((iss, idx) => (
        <li key={idx} className={cn(
          "flex gap-1.5",
          iss.severity === "error" ? "text-destructive" : iss.severity === "warning" ? "text-yellow-500" : "text-muted-foreground",
        )}>
          {iss.severity === "error" ? <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
          <span><span className="font-medium">{iss.field || iss.code}:</span> {iss.message}</span>
        </li>
      ))}
    </ul>
  );
};
