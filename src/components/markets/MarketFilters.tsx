import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, Flame, BarChart3, Clock } from "lucide-react";
import { CATEGORIES } from "@/lib/constants";
import { motion } from "framer-motion";

export type SortKey = "trending" | "newest" | "closing";

interface MarketFiltersProps {
  search: string;
  onSearchChange: (val: string) => void;
  category: string;
  onCategoryChange: (val: string) => void;
  sort: SortKey;
  onSortChange: (val: SortKey) => void;
  layoutId?: string;
}

const SORT_OPTIONS: { key: SortKey; label: string; icon: typeof Flame }[] = [
  { key: "trending", label: "Trending", icon: Flame },
  { key: "newest", label: "New", icon: BarChart3 },
  { key: "closing", label: "Closing", icon: Clock },
];

const MarketFilters = ({
  search, onSearchChange, category, onCategoryChange,
  sort, onSortChange, layoutId = "market-sort",
}: MarketFiltersProps) => (
  <div className="space-y-3">
    {/* Category chips */}
    <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
      {CATEGORIES.map(({ key, label, emoji }) => (
        <button
          key={key}
          onClick={() => onCategoryChange(key)}
          className={`whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
            category === key
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted/50 text-muted-foreground border-border/30 hover:text-foreground"
          }`}
        >
          <span>{emoji}</span> {label}
        </button>
      ))}
    </div>

    {/* Search + Sort */}
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search markets..."
          className="pl-9 h-10 bg-background/60 backdrop-blur-sm border-border/50"
        />
      </div>
      <div className="flex gap-0.5 p-0.5 bg-muted/50 rounded-xl border border-border/30 backdrop-blur-sm">
        {SORT_OPTIONS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onSortChange(key)}
            className={`relative flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              sort === key ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {sort === key && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 bg-primary rounded-lg shadow-sm"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1">
              <Icon className="h-3 w-3" />
              <span className="hidden sm:inline">{label}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  </div>
);

export default MarketFilters;
