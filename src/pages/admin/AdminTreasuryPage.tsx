import { useEffect, useState } from "react";
import {
  fetchTreasurySummary,
  fetchAdminTransactions,
  fetchLedgerEntries,
  approveTransaction,
  rejectTransaction,
  type TreasurySummary,
  type TransactionRow,
} from "@/services/treasuryService";
import { getEntryLabel, isCredit, type LedgerEntry } from "@/lib/ledger";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { CardContent } from "@/components/ui/card";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import AnimatedCounter from "@/components/reactbits/AnimatedCounter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Landmark, ArrowDownLeft, ArrowUpRight, RefreshCw, Search,
  Clock, DollarSign, Wallet, CheckCircle2, XCircle, Shield,
} from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import TreasuryBuckets from "@/components/admin/TreasuryBuckets";

const AdminTreasuryPage = () => {
  const { toast } = useToast();
  const [summary, setSummary] = useState<TreasurySummary | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"transactions" | "ledger">("transactions");
  const [txFilter, setTxFilter] = useState({ status: "all", type: "all", search: "" });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{ tx: TransactionRow; action: "approve" | "reject" } | null>(null);
  const [confirmReason, setConfirmReason] = useState("");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [summaryRes, txRes, ledgerRes] = await Promise.all([
      fetchTreasurySummary(),
      fetchAdminTransactions(txFilter),
      fetchLedgerEntries(200),
    ]);
    if (summaryRes.data) setSummary(summaryRes.data);
    if (txRes.data) setTransactions(txRes.data);
    if (ledgerRes.data) setLedger(ledgerRes.data as LedgerEntry[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAdminTransactions(txFilter).then(res => {
      if (res.data) setTransactions(res.data);
    });
  }, [txFilter.status, txFilter.type]);

  const handleSearch = () => {
    fetchAdminTransactions(txFilter).then(res => {
      if (res.data) setTransactions(res.data);
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmDialog) return;
    const { tx, action } = confirmDialog;
    setActionLoading(tx.id);

    if (action === "approve") {
      const { error } = await approveTransaction(tx, confirmReason);
      if (error) toast({ title: "Error", description: error, variant: "destructive" });
      else toast({ title: "🦅 Transaction approved" });
    } else {
      const { error } = await rejectTransaction(tx, confirmReason);
      if (error) toast({ title: "Error", description: error, variant: "destructive" });
      else toast({ title: "❌ Transaction rejected" });
    }

    setActionLoading(null);
    setConfirmDialog(null);
    setConfirmReason("");
    fetchData();
  };

  const reserveRatio = summary && summary.totalWalletBalances > 0
    ? ((summary.netBalance / summary.totalWalletBalances) * 100)
    : 0;

  const getStatusColor = (status: string) => ({
    completed: "bg-primary/20 text-primary",
    pending: "bg-accent/20 text-accent",
    failed: "bg-destructive/20 text-destructive",
    cancelled: "bg-muted text-muted-foreground",
  }[status] || "bg-muted text-muted-foreground");

  return (
    <div className="min-h-screen bg-background pb-20">
      <SEOHead title="Admin - Treasury" path="/admin/treasury" />
      

      <div className="border-b border-border/30">
        <div className="container py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Landmark className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-wider">
                Treasury <span className="text-primary">Management</span>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">Inflows, outflows, ledger & transaction control</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      <div className="container py-6 space-y-6">
        <TreasuryBuckets />
        {summary && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[
                { label: "Total Inflow", value: summary.totalInflow, icon: ArrowDownLeft, color: "text-primary" },
                { label: "Total Outflow", value: summary.totalOutflow, icon: ArrowUpRight, color: "text-destructive" },
                { label: "Net Balance", value: summary.netBalance, icon: DollarSign, color: summary.netBalance >= 0 ? "text-primary" : "text-destructive" },
                { label: "Platform Revenue", value: summary.platformRevenue, icon: Shield, color: "text-primary" },
                { label: "Pending Deposits", value: summary.pendingDeposits, icon: Clock, color: "text-accent" },
                { label: "Pending Withdrawals", value: summary.pendingWithdrawals, icon: Clock, color: "text-accent" },
                { label: "User Liabilities", value: summary.totalWalletBalances, icon: Wallet, color: "text-foreground" },
              ].map(({ label, value, icon: Icon, color }, i) => (
                <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <SpotlightCard spotlightColor="rgba(120, 255, 120, 0.08)" className="h-full">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className={`h-3.5 w-3.5 ${color}`} />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
                      </div>
                      <div className={`font-display text-lg font-bold tabular-nums ${color}`}>
                        <AnimatedCounter value={Math.round(Math.abs(value))} fontSize={18} duration={0.8} />
                        <span className="text-xs font-normal text-muted-foreground ml-0.5"> KES</span>
                      </div>
                    </CardContent>
                  </SpotlightCard>
                </motion.div>
              ))}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.21 }}>
                <SpotlightCard spotlightColor="rgba(120, 255, 120, 0.08)" className="h-full">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Shield className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Reserve Ratio</span>
                    </div>
                    <div className={`font-display text-lg font-bold tabular-nums ${reserveRatio >= 100 ? "text-primary" : reserveRatio >= 50 ? "text-accent" : "text-destructive"}`}>
                      {reserveRatio.toFixed(1)}%
                    </div>
                  </CardContent>
                </SpotlightCard>
              </motion.div>
            </div>
          </>
        )}

        <div className="flex gap-0.5 p-0.5 bg-muted/50 rounded-xl border border-border/30 w-fit">
          {(["transactions", "ledger"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative px-4 py-2 rounded-lg text-xs font-medium transition-all min-h-[44px] ${
                activeTab === tab ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {activeTab === tab && (
                <motion.div layoutId="treasury-tab" className="absolute inset-0 bg-primary rounded-lg" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
              )}
              <span className="relative z-10 capitalize">{tab}</span>
            </button>
          ))}
        </div>

        {activeTab === "transactions" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={txFilter.search}
                  onChange={e => setTxFilter(f => ({ ...f, search: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                  placeholder="Search M-Pesa code or phone..."
                  className="pl-9 h-9"
                />
              </div>
              <select
                value={txFilter.status}
                onChange={e => setTxFilter(f => ({ ...f, status: e.target.value }))}
                className="h-9 px-3 rounded-lg border border-border/50 bg-background text-xs"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
              <select
                value={txFilter.type}
                onChange={e => setTxFilter(f => ({ ...f, type: e.target.value }))}
                className="h-9 px-3 rounded-lg border border-border/50 bg-background text-xs"
              >
                <option value="all">All Types</option>
                <option value="deposit">Deposit</option>
                <option value="withdrawal">Withdrawal</option>
                <option value="bet_stake">Bet Stake</option>
                <option value="bet_win">Bet Win</option>
              </select>
            </div>

            <div className="rounded-xl border border-border/30 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30 bg-muted/30">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ref</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Phone</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx => (
                      <tr key={tx.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium">{(tx as any).profiles?.username || tx.user_id.slice(0, 8)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {tx.type === "deposit" ? <ArrowDownLeft className="h-3.5 w-3.5 text-primary" /> : <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />}
                            <span className="capitalize">{tx.type.replace("_", " ")}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-display font-bold tabular-nums">
                          {Number(tx.amount).toLocaleString()} <span className="text-muted-foreground font-normal">KES</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusColor(tx.status)}`}>
                            {tx.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">{tx.mpesa_receipt || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{tx.phone_number || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{format(new Date(tx.created_at), "MMM d, HH:mm")}</td>
                        <td className="px-4 py-3">
                          {tx.status === "pending" && (
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-primary hover:bg-primary/10"
                                disabled={actionLoading === tx.id}
                                onClick={() => { setConfirmDialog({ tx, action: "approve" }); setConfirmReason(""); }}
                                title="Approve"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                disabled={actionLoading === tx.id}
                                onClick={() => { setConfirmDialog({ tx, action: "reject" }); setConfirmReason(""); }}
                                title="Reject"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {transactions.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No transactions found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "ledger" && (
          <div className="rounded-xl border border-border/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/30">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Balance After</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map(entry => (
                    <tr key={entry.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`font-medium ${isCredit(entry.entry_type) ? "text-primary" : "text-destructive"}`}>
                          {getEntryLabel(entry.entry_type)}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-display font-bold tabular-nums ${isCredit(entry.entry_type) ? "text-primary" : "text-destructive"}`}>
                        {isCredit(entry.entry_type) ? "+" : "-"}{Math.abs(entry.amount).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-display tabular-nums">{entry.balance_after.toLocaleString()}</td>
                      <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">{entry.description || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{format(new Date(entry.created_at), "MMM d, HH:mm")}</td>
                    </tr>
                  ))}
                  {ledger.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No ledger entries</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog?.action === "approve" ? "🦅 Approve Transaction" : "❌ Reject Transaction"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog?.action === "approve"
                ? `Approve ${confirmDialog.tx.type} of KES ${Number(confirmDialog.tx.amount).toLocaleString()}?`
                : `Reject ${confirmDialog?.tx.type} of KES ${Number(confirmDialog?.tx.amount || 0).toLocaleString()}? ${confirmDialog?.tx.type === "withdrawal" ? "Funds will be refunded." : ""}`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={confirmReason}
            onChange={e => setConfirmReason(e.target.value)}
            placeholder="Reason (required for audit trail)..."
            rows={2}
            className="mt-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              disabled={!confirmReason.trim() || !!actionLoading}
              className={confirmDialog?.action === "reject" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {confirmDialog?.action === "approve" ? "Approve" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      
    </div>
  );
};

export default AdminTreasuryPage;