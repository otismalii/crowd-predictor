import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

export type StatTone = "default" | "primary" | "accent" | "destructive" | "muted";

const toneClass: Record<StatTone, string> = {
  default: "text-foreground",
  primary: "text-primary",
  accent: "text-accent",
  destructive: "text-destructive",
  muted: "text-muted-foreground",
};

export type AdminStat = {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: StatTone;
  hint?: string;
};

export const AdminStatCard = ({ label, value, icon: Icon, tone = "default", hint }: AdminStat) => (
  <div className="rounded-xl border border-border/40 bg-card/60 p-3.5">
    <div className="flex items-center gap-1.5 mb-1.5">
      {Icon && <Icon className={`h-3.5 w-3.5 ${toneClass[tone]}`} />}
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
    </div>
    <div className={`font-display text-xl font-bold tabular-nums ${toneClass[tone]}`}>{value}</div>
    {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
  </div>
);

export const AdminStatGrid = ({ stats, cols = 4 }: { stats: AdminStat[]; cols?: 2 | 3 | 4 | 5 }) => {
  const colsClass = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4", 5: "sm:grid-cols-3 lg:grid-cols-5" }[cols];
  return (
    <div className={`grid grid-cols-2 ${colsClass} gap-3`}>
      {stats.map((s) => <AdminStatCard key={s.label} {...s} />)}
    </div>
  );
};
