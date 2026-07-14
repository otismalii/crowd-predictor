import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Sparkles, BarChart3, Clock, Link2 } from "lucide-react";
import { useMarketIntelligence } from "@/hooks/useMarketIntelligence";
import OverviewCard from "./OverviewCard";
import AiBriefingCard from "./AiBriefingCard";
import EventTimeline from "./EventTimeline";
import SourceList from "./SourceList";

type Tab = "overview" | "ai" | "timeline" | "sources";
const TABS: { key: Tab; label: string; icon: typeof Sparkles }[] = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "ai", label: "AI", icon: Sparkles },
  { key: "timeline", label: "Timeline", icon: Clock },
  { key: "sources", label: "Sources", icon: Link2 },
];

export default function IntelligencePanel({ marketId }: { marketId: string }) {
  const { data, loading, refreshing, refresh } = useMarketIntelligence(marketId);
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="rounded-xl border border-border/30 bg-card/50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm font-bold tracking-wider text-foreground uppercase">Intelligence</h3>
        <button
          onClick={() => refresh(false)}
          disabled={refreshing}
          title="Refresh"
          className="ml-auto p-1 rounded-md hover:bg-muted/50 transition text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex gap-0.5 p-0.5 bg-muted/40 rounded-lg border border-border/30 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition whitespace-nowrap ${
              tab === key ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === key && <motion.div layoutId="intel-tab" className="absolute inset-0 bg-primary rounded-md" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
            <span className="relative z-10 flex items-center gap-1"><Icon className="h-2.5 w-2.5" />{label}</span>
          </button>
        ))}
      </div>

      <div className="min-h-[180px]">
        {loading && !data ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-muted/50 rounded w-3/4" />
            <div className="h-3 bg-muted/40 rounded w-full" />
            <div className="h-3 bg-muted/40 rounded w-5/6" />
          </div>
        ) : !data ? (
          <p className="text-xs text-muted-foreground italic">Intelligence unavailable.</p>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
              {tab === "overview" && <OverviewCard data={data} />}
              {tab === "ai" && <AiBriefingCard data={data} />}
              {tab === "timeline" && <EventTimeline events={data.event_timeline ?? []} />}
              {tab === "sources" && <SourceList sources={data.sources ?? []} />}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
