import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Search, ShieldCheck, Phone, Wallet, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface Profile {
  id: string;
  username: string | null;
  email: string | null;
  phone_number: string | null;
  accuracy_rate: number;
  reputation_score: number;
  subscription_plan: string;
  followers_count: number;
  created_at: string;
}

interface WalletData {
  user_id: string;
  balance: number;
}

interface AdminUsersProps {
  profiles: Profile[];
  adminIds: string[];
  onRefresh: () => void;
}

const AdminUsers = ({ profiles, adminIds, onRefresh }: AdminUsersProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [wallets, setWallets] = useState<Map<string, number>>(new Map());
  const [txCounts, setTxCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    fetchWalletData();
  }, [profiles]);

  const fetchWalletData = async () => {
    const [walletRes, txRes] = await Promise.all([
      supabase.from("wallets").select("user_id, balance").limit(5000),
      supabase.from("transactions").select("user_id").limit(5000),
    ]);

    if (walletRes.data) {
      const map = new Map<string, number>();
      for (const w of walletRes.data) map.set(w.user_id, Number(w.balance));
      setWallets(map);
    }

    if (txRes.data) {
      const map = new Map<string, number>();
      for (const t of txRes.data as any[]) {
        map.set(t.user_id, (map.get(t.user_id) || 0) + 1);
      }
      setTxCounts(map);
    }
  };

  const filtered = search
    ? profiles.filter((p) =>
        (p.username || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.email || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.phone_number || "").includes(search)
      )
    : profiles;

  const toggleAdmin = async (userId: string, isCurrentlyAdmin: boolean) => {
    if (isCurrentlyAdmin) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else { toast({ title: "Admin role removed" }); onRefresh(); }
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else { toast({ title: "✅ Admin role granted" }); onRefresh(); }
    }
  };

  const flagUser = async (userId: string, username: string | null) => {
    if (!user) return;
    await supabase.from("market_audit_log").insert({
      action: "user_flagged",
      performed_by: user.id,
      details: { flagged_user_id: userId, username, reason: "Manual flag from admin panel" },
    });
    toast({ title: "🚩 User flagged", description: `@${username || userId.slice(0, 8)} flagged for review` });
  };

  const maskPhone = (phone: string | null) => {
    if (!phone) return "—";
    return phone.slice(0, 3) + "***" + phone.slice(-3);
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-display text-lg flex items-center gap-2">
            <Users className="h-5 w-5" /> Users ({filtered.length})
          </span>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border/50 max-h-[500px] overflow-y-auto">
          {filtered.map((p, i) => {
            const isAdmin = adminIds.includes(p.id);
            const balance = wallets.get(p.id) ?? 0;
            const txCount = txCounts.get(p.id) ?? 0;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                className="flex items-center justify-between py-3 px-2 hover:bg-muted/20 rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold ${isAdmin ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {(p.username || "?")[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground truncate">@{p.username || "anon"}</span>
                      {isAdmin && (
                        <Badge variant="outline" className="text-[10px] border-primary/50 text-primary px-1.5 py-0">
                          <ShieldCheck className="h-3 w-3 mr-0.5" /> Admin
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                    <span title="Wallet Balance" className="flex items-center gap-0.5">
                      <Wallet className="h-3 w-3" /> {Math.round(balance).toLocaleString()}
                    </span>
                    <span title="Transactions">📊 {txCount}</span>
                    <span title="Phone" className="flex items-center gap-0.5">
                      <Phone className="h-3 w-3" /> {maskPhone(p.phone_number)}
                    </span>
                    <span title="Accuracy">🎯 {p.accuracy_rate}%</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {p.subscription_plan}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
                    onClick={() => flagUser(p.id, p.username)}
                    title="Flag user"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant={isAdmin ? "destructive" : "outline"}
                    className="text-xs h-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => toggleAdmin(p.id, isAdmin)}
                  >
                    {isAdmin ? "Remove Admin" : "Make Admin"}
                  </Button>
                </div>
              </motion.div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No users found.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminUsers;