import {
  ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown,
  Wallet as WalletIcon, History,
} from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import SpotlightCard from "@/components/reactbits/SpotlightCard";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
  mpesa_receipt: string | null;
  created_at: string;
}

interface TransactionHistoryProps {
  transactions: Transaction[];
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case "deposit": return <ArrowDownLeft className="h-4 w-4 text-primary" />;
    case "withdrawal": return <ArrowUpRight className="h-4 w-4 text-destructive" />;
    case "bet_win": return <TrendingUp className="h-4 w-4 text-primary" />;
    case "bet_stake": return <TrendingDown className="h-4 w-4 text-accent" />;
    case "bet_refund": return <ArrowDownLeft className="h-4 w-4 text-accent" />;
    default: return <WalletIcon className="h-4 w-4 text-muted-foreground" />;
  }
};

const getTypeLabel = (type: string) =>
  ({ deposit: "Deposit", withdrawal: "Withdrawal", bet_stake: "Bet Placed", bet_win: "Bet Won", bet_refund: "Bet Refund", house_fee: "House Fee" }[type] || type);

const getStatusBadge = (status: string) =>
  ({ completed: "bg-primary/20 text-primary", pending: "bg-accent/20 text-accent", failed: "bg-destructive/20 text-destructive", cancelled: "bg-muted text-muted-foreground" }[status] || "bg-muted text-muted-foreground");

const TransactionHistory = ({ transactions }: TransactionHistoryProps) => (
  <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
    <h2 className="font-display text-sm font-bold tracking-wider text-muted-foreground uppercase mb-3 flex items-center gap-2">
      <History className="h-3.5 w-3.5" /> Recent Transactions
    </h2>
    {transactions.length === 0 ? (
      <SpotlightCard className="p-8 text-center" spotlightColor="rgba(120, 255, 120, 0.05)">
        <History className="mx-auto mb-2 h-8 w-8 text-muted-foreground/20" />
        <p className="text-xs text-muted-foreground font-display">No transactions yet</p>
      </SpotlightCard>
    ) : (
      <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
        {transactions.slice(0, 20).map((tx, i) => (
          <motion.div key={tx.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}>
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/20 bg-card/30 hover:bg-card/60 transition-colors">
              <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                {getTypeIcon(tx.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold">{getTypeLabel(tx.type)}</p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${getStatusBadge(tx.status)}`}>{tx.status}</span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">
                  {tx.description || tx.mpesa_receipt || format(new Date(tx.created_at), "MMM d, HH:mm")}
                </p>
              </div>
              <p className={`font-display font-bold text-xs ${
                ["deposit", "bet_win", "bet_refund"].includes(tx.type) ? "text-primary" : "text-destructive"
              }`}>
                {["deposit", "bet_win", "bet_refund"].includes(tx.type) ? "+" : "-"}{Math.abs(tx.amount).toLocaleString()}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    )}
  </motion.div>
);

export default TransactionHistory;
