import { ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { formatDate } from "@/lib/format";
import { getEntryLabel, isCredit } from "@/lib/ledger";

interface Trade {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
  created_at: string;
}

interface TradeHistoryListProps {
  trades: Trade[];
}

const getIcon = (type: string) => {
  if (type === "deposit") return <ArrowDownLeft className="h-4 w-4 text-primary" />;
  if (type === "withdrawal") return <ArrowUpRight className="h-4 w-4 text-destructive" />;
  if (type === "bet_win") return <TrendingUp className="h-4 w-4 text-primary" />;
  if (type === "bet_stake") return <TrendingDown className="h-4 w-4 text-accent" />;
  return <Wallet className="h-4 w-4 text-muted-foreground" />;
};

const getStatusBadge = (status: string) => {
  const map: Record<string, string> = {
    completed: "bg-primary/20 text-primary",
    pending: "bg-accent/20 text-accent",
    failed: "bg-destructive/20 text-destructive",
    cancelled: "bg-muted text-muted-foreground",
  };
  return map[status] || "bg-muted text-muted-foreground";
};

const TradeHistoryList = ({ trades }: TradeHistoryListProps) => {
  if (trades.length === 0) {
    return <div className="text-center py-12 text-muted-foreground text-sm">No transactions yet</div>;
  }

  return (
    <div className="space-y-1">
      {trades.map((tx) => (
        <div key={tx.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/30 transition-colors">
          {getIcon(tx.type)}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{getEntryLabel(tx.type)}</p>
            {tx.description && <p className="text-[10px] text-muted-foreground truncate">{tx.description}</p>}
          </div>
          <div className="text-right flex-shrink-0">
            <span className={`text-sm font-display font-bold tabular-nums ${isCredit(tx.type) ? "text-primary" : "text-destructive"}`}>
              {isCredit(tx.type) ? "+" : "-"}{Math.abs(tx.amount).toLocaleString()}
            </span>
            <div className="flex items-center gap-1.5 justify-end mt-0.5">
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${getStatusBadge(tx.status)}`}>
                {tx.status}
              </span>
              <span className="text-[10px] text-muted-foreground">{formatDate(tx.created_at, "MMM d")}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TradeHistoryList;
