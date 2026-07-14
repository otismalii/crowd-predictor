import { useState } from "react";
import { Sparkles, ShieldAlert } from "lucide-react";
import type { MarketIntelligence } from "@/services/marketIntelligenceService";

const RISK_TONE: Record<string, string> = {
  low: "bg-primary/10 text-primary border-primary/20",
  medium: "bg-accent/10 text-accent border-accent/20",
  high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  critical: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function AiBriefingCard({ data }: { data: MarketIntelligence }) {
  const [side, setSide] = useState<"bull" | "bear">("bull");
  const risk = data.risk_level ?? "low";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">LOGIK briefing</span>
        <span className={`ml-auto text-[9px] px-2 py-0.5 rounded-full border font-medium uppercase tracking-wider ${RISK_TONE[risk]}`}>
          <ShieldAlert className="inline h-2.5 w-2.5 mr-0.5" />
          {risk} risk
        </span>
      </div>

      {data.summary ? (
        <p className="text-xs leading-relaxed text-foreground/90">{data.summary}</p>
      ) : (
        <p className="text-xs italic text-muted-foreground">Briefing not yet available.</p>
      )}

      <div className="flex gap-0.5 p-0.5 bg-muted/40 rounded-lg border border-border/30 w-fit">
        <button onClick={() => setSide("bull")} className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition ${side === "bull" ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}>Bull case</button>
        <button onClick={() => setSide("bear")} className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition ${side === "bear" ? "bg-destructive/20 text-destructive" : "text-muted-foreground"}`}>Bear case</button>
      </div>

      <p className="text-xs leading-relaxed text-foreground/80 rounded-lg border border-border/30 bg-muted/10 p-2.5">
        {side === "bull" ? (data.bull_case ?? "—") : (data.bear_case ?? "—")}
      </p>

      {data.risk_notes && (
        <p className="text-[10px] text-muted-foreground italic">Risk: {data.risk_notes}</p>
      )}

      <p className="text-[9px] text-muted-foreground/60">AI-generated analysis. Not financial advice.</p>
    </div>
  );
}
