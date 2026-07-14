import { Activity, Droplet, TrendingUp, TrendingDown } from "lucide-react";
import type { MarketIntelligence } from "@/services/marketIntelligenceService";
import PressureBar from "./PressureBar";

export default function OverviewCard({ data }: { data: MarketIntelligence }) {
  const mom = Number(data.momentum ?? 0);
  const MomIcon = mom >= 0 ? TrendingUp : TrendingDown;
  const momTone = mom >= 0 ? "text-primary" : "text-destructive";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Confidence" value={data.confidence != null ? `${data.confidence}` : "—"} suffix={data.confidence != null ? "/100" : undefined} icon={<Activity className="h-3 w-3" />} />
        <Metric label="Momentum" value={`${mom >= 0 ? "+" : ""}${(mom * 100).toFixed(1)}¢`} icon={<MomIcon className={`h-3 w-3 ${momTone}`} />} valueClass={momTone} />
        <Metric label="Liquidity" value={data.liquidity_score != null ? `${data.liquidity_score}` : "—"} suffix={data.liquidity_score != null ? "/100" : undefined} icon={<Droplet className="h-3 w-3" />} />
      </div>
      <div className="space-y-2.5">
        <PressureBar label="Buy pressure (24h)" value={Number(data.buy_pressure ?? 0)} tone="positive" />
        <PressureBar label="Sell pressure (24h)" value={Number(data.sell_pressure ?? 0)} tone="negative" />
      </div>
    </div>
  );
}

function Metric({ label, value, suffix, icon, valueClass }: { label: string; value: string; suffix?: string; icon?: React.ReactNode; valueClass?: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground mb-1">
        {icon}<span>{label}</span>
      </div>
      <div className={`font-display text-lg font-bold tabular-nums ${valueClass ?? "text-foreground"}`}>
        {value}{suffix && <span className="text-[10px] text-muted-foreground font-normal ml-0.5">{suffix}</span>}
      </div>
    </div>
  );
}
