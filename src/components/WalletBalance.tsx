import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Wallet } from "lucide-react";
import { motion } from "framer-motion";

const WalletBalance = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!user) { setBalance(null); return; }

    const fetchBalance = async () => {
      const { data } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", user.id)
        .single() as any;
      if (data) setBalance(data.balance);
    };

    fetchBalance();

    const channel = supabase
      .channel("wallet-balance")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` }, (payload: any) => {
        setBalance(payload.new.balance);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (!user || balance === null) return null;

  return (
    <Link to="/wallet">
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors cursor-pointer"
      >
        <Wallet className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-display font-bold text-primary">
          {balance.toLocaleString()}
        </span>
        <span className="text-[10px] text-muted-foreground">KES</span>
      </motion.div>
    </Link>
  );
};

export default WalletBalance;
