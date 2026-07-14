interface Props {
  label: string;
  value: number; // 0..1
  tone?: "positive" | "negative" | "neutral";
}

export default function PressureBar({ label, value, tone = "neutral" }: Props) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const barClass =
    tone === "positive" ? "bg-primary" :
    tone === "negative" ? "bg-destructive" : "bg-accent";
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground mb-1">
        <span className="uppercase tracking-wider">{label}</span>
        <span className="tabular-nums text-foreground">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${barClass} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
