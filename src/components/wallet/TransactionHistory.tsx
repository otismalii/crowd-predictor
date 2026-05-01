import {
  ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown,
  Wallet as WalletIcon, History,
} from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import { getEntryLabel, isCredit, type LedgerEntry } from "@/lib/ledger";

interface TransactionHistoryProps {
  entries: LedgerEntry[];
}

const getTypeIcon = (type: string) => {
  if (type === "deposit") return <ArrowDownLeft className="h-4 w-4 text-primary" />;
  if (type === "withdrawal") return <ArrowUpRight className="h-4 w-4 text-destructive" />;
  if (type === "trade_buy" || type === "bet_stake") return <TrendingDown className="h-4 w-4 text-accent" />;
  if (type === "trade_sell" || type === "settlement_win" || type === "bet_win") return <TrendingUp className="h-4 w-4 text-primary" />;
  if (type === "refund" || type === "bet_refund") return <ArrowDownLeft className="h-4 w-4 text-accent" />;
  return <WalletIcon className="h-4 w-4 text-muted-foreground" />;
};

const TransactionHistory = ({ entries }: TransactionHistoryProps) => (
  <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
    <h2 className="font-display text-sm font-bold tracking-wider text-muted-foreground uppercase mb-3 flex items-center gap-2">
      <History className="h-3.5 w-3.5" /> Ledger
      <span className="ml-auto text-[9px] font-normal text-muted-foreground/60 normal-case tracking-normal">
        Immutable timeline
      </span>
    </h2>
    {entries.length === 0 ? (
      <SpotlightCard className="p-8 text-center" spotlightColor="rgba(120, 255, 120, 0.05)">
        <History className="mx-auto mb-2 h-8 w-8 text-muted-foreground/20" />
        <p className="text-xs text-muted-foreground font-display">No ledger entries yet</p>
      </SpotlightCard>
    ) : (
      <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
        {entries.slice(0, 50).map((entry, i) => {
          const credit = isCredit(entry.entry_type);
          return (
            <motion.div key={entry.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}>
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/20 bg-card/30 hover:bg-card/60 transition-colors">
                <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                  {getTypeIcon(entry.entry_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{getEntryLabel(entry.entry_type)}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {entry.description || format(new Date(entry.created_at), "MMM d, HH:mm")}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-display font-bold text-xs tabular-nums ${credit ? "text-primary" : "text-destructive"}`}>
                    {credit ? "+" : "−"}{Math.abs(Number(entry.amount)).toLocaleString()}
                  </p>
                  <p className="text-[9px] text-muted-foreground tabular-nums">
                    Bal: {Number(entry.balance_after).toLocaleString()}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    )}
  </motion.div>
);

export default TransactionHistory;
