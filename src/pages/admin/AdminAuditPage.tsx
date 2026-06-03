import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, RefreshCw, Search } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

interface AuditEntry {
  id: string;
  action: string;
  market_id: string | null;
  performed_by: string;
  details: Record<string, any> | null;
  created_at: string;
  market?: { title: string } | null;
  admin_profile?: { username: string | null } | null;
}

const AdminAuditPage = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  useEffect(() => { fetchAudit(); }, []);

  const fetchAudit = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("market_audit_log")
      .select("*, market:market_id(title), admin_profile:performed_by(username)")
      .order("created_at", { ascending: false })
      .limit(200) as any;
    setEntries(data || []);
    setLoading(false);
  };

  const actions = Array.from(new Set(entries.map(e => e.action)));

  const filtered = entries.filter(e => {
    if (actionFilter !== "all" && e.action !== actionFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        e.action.toLowerCase().includes(s) ||
        (e.market as any)?.title?.toLowerCase().includes(s) ||
        (e.admin_profile as any)?.username?.toLowerCase().includes(s) ||
        JSON.stringify(e.details || {}).toLowerCase().includes(s)
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <SEOHead title="Admin - Audit Log" path="/admin/audit" />
      
      <div className="border-b border-border/30">
        <div className="container py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-wider">
                Audit <span className="text-primary">Log</span>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">All admin actions · Immutable trail</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAudit} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      <div className="container py-6 space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search audit log..." className="pl-9 h-9" />
          </div>
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-border/50 bg-background text-xs"
          >
            <option value="all">All Actions</option>
            {actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : (
          <div className="rounded-xl border border-border/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/30">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Market</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Admin</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Details</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry, i) => (
                    <motion.tr
                      key={entry.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.01 }}
                      className="border-b border-border/20 hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold text-[10px]">
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">
                        {(entry.market as any)?.title || "—"}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        @{(entry.admin_profile as any)?.username || entry.performed_by.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground truncate max-w-[250px]">
                        {entry.details ? JSON.stringify(entry.details).slice(0, 80) : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {format(new Date(entry.created_at), "MMM d, HH:mm")}
                      </td>
                    </motion.tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No audit entries found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      
    </div>
  );
};

export default AdminAuditPage;