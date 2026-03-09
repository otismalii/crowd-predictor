import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import WalletSkeleton from "@/components/skeletons/WalletSkeleton";
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, Phone, History, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import GradientText from "@/components/reactbits/GradientText";
import SplitText from "@/components/reactbits/SplitText";
import Aurora from "@/components/reactbits/Aurora";
import AnimatedCounter from "@/components/reactbits/AnimatedCounter";
import { Link } from "react-router-dom";

interface WalletData {
  id: string;
  balance: number;
  currency: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
  mpesa_receipt: string | null;
  created_at: string;
}

const Wallet = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"deposit" | "withdraw" | "history">("deposit");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetchWallet();
  }, [user]);

  const fetchWallet = async () => {
    if (!user) return;
    const [walletRes, txRes] = await Promise.all([
      supabase.from("wallets").select("*").eq("user_id", user.id).single() as any,
      supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50) as any,
    ]);
    if (walletRes.data) setWallet(walletRes.data);
    if (txRes.data) setTransactions(txRes.data);
    setLoading(false);
  };

  const handleDeposit = async () => {
    if (!user || !wallet || !amount || !phone) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 10) {
      toast({ title: "Minimum deposit is KES 10", variant: "destructive" });
      return;
    }
    setProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke("mpesa-deposit", {
        body: { amount: numAmount, phone_number: phone },
      });

      if (error) throw error;
      toast({ title: "📱 STK Push sent!", description: "Check your phone to complete M-Pesa payment" });
      setAmount("");
      // Poll for completion
      setTimeout(fetchWallet, 5000);
      setTimeout(fetchWallet, 15000);
      setTimeout(fetchWallet, 30000);
    } catch (e: any) {
      toast({ title: "Deposit failed", description: e.message || "Try again", variant: "destructive" });
    }
    setProcessing(false);
  };

  const handleWithdraw = async () => {
    if (!user || !wallet || !amount || !phone) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 10) {
      toast({ title: "Minimum withdrawal is KES 10", variant: "destructive" });
      return;
    }
    if (numAmount > wallet.balance) {
      toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }
    setProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke("mpesa-withdraw", {
        body: { amount: numAmount, phone_number: phone },
      });

      if (error) throw error;
      toast({ title: "💸 Withdrawal initiated!", description: "You'll receive M-Pesa shortly" });
      setAmount("");
      fetchWallet();
    } catch (e: any) {
      toast({ title: "Withdrawal failed", description: e.message || "Try again", variant: "destructive" });
    }
    setProcessing(false);
  };

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

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      deposit: "Deposit", withdrawal: "Withdrawal", bet_stake: "Bet Placed",
      bet_win: "Bet Won", bet_refund: "Bet Refund", house_fee: "House Fee",
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: "bg-primary/20 text-primary",
      pending: "bg-accent/20 text-accent",
      failed: "bg-destructive/20 text-destructive",
      cancelled: "bg-muted text-muted-foreground",
    };
    return styles[status] || "bg-muted text-muted-foreground";
  };

  const quickAmounts = [50, 100, 500, 1000, 5000];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="relative border-b border-border/30 overflow-hidden">
        <Aurora />
        <div className="relative container py-10 sm:py-14">
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-wider">
            <SplitText text="MY " className="text-foreground" splitType="chars" delay={0.04} />
            <GradientText className="font-display text-4xl sm:text-5xl font-bold tracking-wider">WALLET</GradientText>
          </h1>

          {wallet && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-6"
            >
              <SpotlightCard className="inline-block" spotlightColor="rgba(120, 255, 120, 0.15)">
                <CardContent className="p-6 flex items-center gap-6">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <WalletIcon className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Balance</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm text-muted-foreground font-medium">KES</span>
                      <AnimatedCounter value={wallet.balance} fontSize={36} className="font-display font-bold text-primary" duration={1} />
                    </div>
                  </div>
                </CardContent>
              </SpotlightCard>
            </motion.div>
          )}

          <div className="flex gap-1 mt-8 p-1 bg-muted/50 rounded-xl w-fit backdrop-blur-sm border border-border/30">
            {([
              { key: "deposit" as const, label: "💰 Deposit", icon: ArrowDownLeft },
              { key: "withdraw" as const, label: "💸 Withdraw", icon: ArrowUpRight },
              { key: "history" as const, label: "📋 History", icon: History },
            ]).map(({ key, label }) => (
              <motion.button
                key={key}
                onClick={() => setTab(key)}
                className={`relative px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  tab === key ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                whileTap={{ scale: 0.98 }}
              >
                {tab === key && (
                  <motion.div layoutId="wallet-tab-bg" className="absolute inset-0 bg-primary rounded-lg neon-glow" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                )}
                <span className="relative z-10">{label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      <div className="container py-6 max-w-lg">
        {!user ? (
          <SpotlightCard className="p-12 text-center" spotlightColor="rgba(120, 255, 120, 0.08)">
            <WalletIcon className="mx-auto mb-3 h-10 w-10 text-primary/30" />
            <p className="text-muted-foreground font-display">Sign in to access your wallet</p>
            <Link to="/auth"><Button className="mt-4 neon-glow">Sign In</Button></Link>
          </SpotlightCard>
        ) : loading ? (
          <WalletSkeleton />
        ) : (
          <AnimatePresence mode="wait">
            {(tab === "deposit" || tab === "withdraw") && (
              <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                <SpotlightCard spotlightColor="rgba(120, 255, 120, 0.1)">
                  <CardContent className="p-6 space-y-4">
                    <h2 className="font-display text-lg font-bold tracking-wider flex items-center gap-2">
                      {tab === "deposit" ? (
                        <><ArrowDownLeft className="h-5 w-5 text-primary" /> DEPOSIT VIA M-PESA</>
                      ) : (
                        <><ArrowUpRight className="h-5 w-5 text-accent" /> WITHDRAW TO M-PESA</>
                      )}
                    </h2>

                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground font-medium">Phone Number</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="254712345678"
                          className="pl-10 font-display"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground font-medium">Amount (KES)</label>
                      <Input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0"
                        min={10}
                        className="text-center font-display text-2xl font-bold h-14"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {quickAmounts.map((qa) => (
                        <motion.button
                          key={qa}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setAmount(String(qa))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            amount === String(qa)
                              ? "border-primary text-primary bg-primary/10"
                              : "border-border text-muted-foreground hover:border-muted-foreground"
                          }`}
                        >
                          {qa.toLocaleString()}
                        </motion.button>
                      ))}
                    </div>

                    {tab === "withdraw" && wallet && (
                      <p className="text-xs text-muted-foreground">
                        Available: <span className="text-primary font-bold">KES {wallet.balance.toLocaleString()}</span>
                      </p>
                    )}

                    <Button
                      onClick={tab === "deposit" ? handleDeposit : handleWithdraw}
                      disabled={processing || !amount || !phone}
                      className={`w-full h-12 text-base font-display tracking-wider ${
                        tab === "deposit" ? "neon-glow" : "neon-glow-accent bg-accent text-accent-foreground hover:bg-accent/90"
                      }`}
                    >
                      {processing
                        ? "Processing..."
                        : tab === "deposit"
                        ? `💰 Deposit KES ${amount || "0"}`
                        : `💸 Withdraw KES ${amount || "0"}`}
                    </Button>
                  </CardContent>
                </SpotlightCard>
              </motion.div>
            )}

            {tab === "history" && (
              <motion.div key="history" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-3">
                {transactions.length === 0 ? (
                  <SpotlightCard className="p-12 text-center" spotlightColor="rgba(120, 255, 120, 0.08)">
                    <History className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                    <p className="text-muted-foreground font-display">No transactions yet</p>
                  </SpotlightCard>
                ) : (
                  transactions.map((tx, i) => (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <SpotlightCard spotlightColor="rgba(120, 255, 120, 0.05)">
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-muted/50 flex items-center justify-center flex-shrink-0">
                            {getTypeIcon(tx.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold">{getTypeLabel(tx.type)}</p>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getStatusBadge(tx.status)}`}>
                                {tx.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {tx.description || tx.mpesa_receipt || format(new Date(tx.created_at), "MMM d, yyyy HH:mm")}
                            </p>
                          </div>
                          <p className={`font-display font-bold text-sm ${
                            ["deposit", "bet_win", "bet_refund"].includes(tx.type) ? "text-primary" : "text-destructive"
                          }`}>
                            {["deposit", "bet_win", "bet_refund"].includes(tx.type) ? "+" : "-"}KES {Math.abs(tx.amount).toLocaleString()}
                          </p>
                        </CardContent>
                      </SpotlightCard>
                    </motion.div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Wallet;
