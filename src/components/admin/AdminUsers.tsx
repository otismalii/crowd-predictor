import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Search, ShieldCheck, Crown, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface Profile {
  id: string;
  username: string | null;
  email: string | null;
  accuracy_rate: number;
  reputation_score: number;
  subscription_plan: string;
  followers_count: number;
  created_at: string;
}

interface AdminUsersProps {
  profiles: Profile[];
  adminIds: string[];
  onRefresh: () => void;
}

const AdminUsers = ({ profiles, adminIds, onRefresh }: AdminUsersProps) => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const filtered = search
    ? profiles.filter((p) =>
        (p.username || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.email || "").toLowerCase().includes(search.toLowerCase())
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
                    <span title="Accuracy">🎯 {p.accuracy_rate}%</span>
                    <span title="Reputation">⭐ {p.reputation_score}</span>
                    <span title="Followers">👥 {p.followers_count}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {p.subscription_plan}
                  </Badge>
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
