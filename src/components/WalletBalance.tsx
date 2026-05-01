import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Wallet, Lock } from "lucide-react";
import { motion } from "framer-motion";

interface WalletData {
  balance: number;
  locked_balance: number;
}

const WalletBalance = () => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);

  useEffect(() => {
    if (!user) { setWallet(null); return; }

    const fetchWallet = async () => {
      const { data } = await supabase
        .from("wallets")
        .select("balance, locked_balance")
        .eq("user_id", user.id)
        .single() as any;
      if (data) setWallet({ balance: Number(data.balance), locked_balance: Number(data.locked_balance || 0) });
    };

    fetchWallet();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      const channelName = `wallet-balance-${user.id}-${Date.now()}`;
      channel = supabase
        .channel(channelName)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` }, (payload: any) => {
          setWallet({
            balance: Number(payload.new.balance),
            locked_balance: Number(payload.new.locked_balance || 0),
          });
        })
        .subscribe();
    } catch (e) {
      console.warn("[realtime] WalletBalance channel setup failed:", e);
    }

    return () => { if (channel) supabase.removeChannel(channel); };
  }, [user]);

  if (!user || !wallet) return null;

  const hasLock = wallet.locked_balance > 0;

  return (
    <Link to="/wallet">
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors cursor-pointer"
        title={hasLock ? `Available: ${wallet.balance.toLocaleString()} KES · On hold: ${wallet.locked_balance.toLocaleString()} KES` : undefined}
      >
        <Wallet className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-display font-bold text-primary tabular-nums">
          {wallet.balance.toLocaleString()}
        </span>
        <span className="text-[10px] text-muted-foreground">KES</span>
        {hasLock && (
          <span className="ml-1 inline-flex items-center gap-0.5 text-[9px] text-accent">
            <Lock className="h-2.5 w-2.5" />
            {wallet.locked_balance.toLocaleString()}
          </span>
        )}
      </motion.div>
    </Link>
  );
};

export default WalletBalance;
