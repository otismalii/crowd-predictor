import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import { Link } from "react-router-dom";

interface DepositWithdrawProps {
  wallet: { id: string; balance: number; currency: string } | null;
  phoneNumber: string | null;
  onComplete: () => void;
}

const quickAmounts = [50, 100, 500, 1000, 5000];

const DepositWithdraw = ({ wallet, phoneNumber, onComplete }: DepositWithdrawProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [walletAction, setWalletAction] = useState<"deposit" | "withdraw">("deposit");

  const handleDeposit = async () => {
    if (!user || !wallet || !amount) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 10) {
      toast({ title: "Minimum deposit is KES 10", variant: "destructive" });
      return;
    }
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("pesapal-deposit", {
        body: { amount: numAmount, phone_number: phoneNumber || undefined, callback_url: window.location.origin + "/wallet" },
      });
      if (error) throw error;
      if (data?.redirect_url) {
        toast({ title: "🔄 Redirecting to PesaPal...", description: "Complete your payment on PesaPal" });
        window.location.href = data.redirect_url;
        return;
      }
      toast({ title: "Deposit initiated!", description: "Complete payment to fund your wallet" });
      setAmount("");
      setTimeout(onComplete, 5000);
    } catch (e: any) {
      toast({ title: "Deposit failed", description: e.message || "Try again", variant: "destructive" });
    }
    setProcessing(false);
  };

  const handleWithdraw = async () => {
    if (!user || !wallet || !amount) return;
    if (!phoneNumber) {
      toast({ title: "Phone number required", description: "Add your phone number in profile settings first", variant: "destructive" });
      return;
    }
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
      const { error } = await supabase.functions.invoke("pesapal-withdraw", {
        body: { amount: numAmount },
      });
      if (error) throw error;
      toast({ title: "🦅 Landing confirmed!", description: "Withdrawal pending admin approval" });
      setAmount("");
      onComplete();
    } catch (e: any) {
      toast({ title: "Withdrawal failed", description: e.message || "Try again", variant: "destructive" });
    }
    setProcessing(false);
  };

  return (
    <SpotlightCard spotlightColor="rgba(120, 255, 120, 0.1)">
      <CardContent className="p-5 space-y-4">
        {/* Toggle deposit/withdraw */}
        <div className="flex gap-0.5 p-0.5 bg-muted/50 rounded-xl border border-border/30">
          {([
            { key: "deposit" as const, label: "💰 Deposit" },
            { key: "withdraw" as const, label: "💸 Withdraw" },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setWalletAction(key)}
              className={`relative flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                walletAction === key ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {walletAction === key && (
                <motion.div layoutId="wallet-action-bg" className="absolute inset-0 bg-primary rounded-lg" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
              )}
              <span className="relative z-10">{label}</span>
            </button>
          ))}
        </div>

        {/* Phone number display */}
        {walletAction === "withdraw" && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Phone Number</label>
            {phoneNumber ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border/30 bg-muted/20">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="font-display text-sm">
                  {phoneNumber.slice(0, 3)}***{phoneNumber.slice(-3)}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-destructive/30 bg-destructive/5">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-xs text-destructive">
                  Add your phone number in <Link to={`/profile/${user?.id}`} className="underline font-semibold">profile settings</Link> first
                </span>
              </div>
            )}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Amount (KES)</label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            min={10}
            className="text-center font-display text-xl font-bold h-12"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {quickAmounts.map((qa) => (
            <motion.button
              key={qa}
              whileTap={{ scale: 0.95 }}
              onClick={() => setAmount(String(qa))}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                amount === String(qa)
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border text-muted-foreground hover:border-muted-foreground"
              }`}
            >
              {qa.toLocaleString()}
            </motion.button>
          ))}
        </div>

        {walletAction === "withdraw" && wallet && (
          <p className="text-xs text-muted-foreground">
            Available: <span className="text-primary font-bold">KES {wallet.balance.toLocaleString()}</span>
          </p>
        )}

        <Button
          onClick={walletAction === "deposit" ? handleDeposit : handleWithdraw}
          disabled={processing || !amount || (walletAction === "withdraw" && !phoneNumber)}
          className={`w-full h-11 text-sm font-display tracking-wider ${
            walletAction === "deposit"
              ? "neon-glow"
              : "neon-glow-accent bg-accent text-accent-foreground hover:bg-accent/90"
          }`}
        >
          {processing
            ? "Processing..."
            : walletAction === "deposit"
            ? `💰 Deposit KES ${amount || "0"}`
            : `💸 Withdraw KES ${amount || "0"}`}
        </Button>
      </CardContent>
    </SpotlightCard>
  );
};

export default DepositWithdraw;
