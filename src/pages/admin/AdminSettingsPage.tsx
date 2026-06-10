import { useEffect, useState } from "react";
import { AdminPageHeader, AdminPageBody, AdminSectionCard, AdminEmptyState } from "@/components/admin/primitives";
import { Settings, Save, Lock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminRole } from "@/hooks/useAdminRole";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

type SettingRow = {
  key: string;
  value: any;
  description: string | null;
  category: string;
  updated_at: string;
  updated_by: string | null;
};

const NUMERIC_KEYS = new Set([
  "trade_fee_bps",
  "min_deposit_kes",
  "max_deposit_kes",
  "daily_withdrawal_cap_kes",
  "max_shares_per_trade",
]);
const BOOLEAN_KEYS = new Set([
  "maintenance_mode",
  "new_market_creation_enabled",
]);

const CATEGORY_LABELS: Record<string, string> = {
  finance: "Finance",
  trading: "Trading",
  system: "System & Feature Flags",
  general: "General",
};

const AdminSettingsPage = () => {
  const { isSuperAdmin, loading: roleLoading } = useAdminRole();
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any)
        .from("app_settings")
        .select("*")
        .order("category")
        .order("key");
      if (error) {
        toast.error("Failed to load settings");
      } else {
        setRows(data || []);
        setDraft(Object.fromEntries((data || []).map((r: SettingRow) => [r.key, r.value])));
      }
      setLoading(false);
    })();
  }, []);

  const save = async (key: string) => {
    if (!isSuperAdmin) return;
    setSaving(key);
    let value = draft[key];
    if (NUMERIC_KEYS.has(key)) value = Number(value);
    const { error } = await (supabase as any)
      .from("app_settings")
      .update({ value })
      .eq("key", key);
    setSaving(null);
    if (error) {
      toast.error(`Save failed: ${error.message}`);
    } else {
      toast.success(`${key} updated`);
      setRows((prev) => prev.map((r) => (r.key === key ? { ...r, value, updated_at: new Date().toISOString() } : r)));
    }
  };

  const grouped = rows.reduce<Record<string, SettingRow[]>>((acc, r) => {
    (acc[r.category] ||= []).push(r);
    return acc;
  }, {});

  return (
    <>
      <AdminPageHeader
        icon={Settings}
        title="Platform Settings"
        subtitle={isSuperAdmin ? "Tune fees, limits, and feature flags" : "Read-only — super_admin role required to edit"}
      />
      <AdminPageBody>
        {!isSuperAdmin && !roleLoading && (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-300">
            <Lock className="h-4 w-4" />
            You can view current values but only super admins can change them.
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <AdminEmptyState icon={AlertTriangle} title="No settings configured" description="Seed defaults via migration." />
        ) : (
          Object.entries(grouped).map(([category, items]) => (
            <AdminSectionCard key={category} title={CATEGORY_LABELS[category] || category}>
              <div className="divide-y divide-border/50">
                {items.map((row) => {
                  const isBool = BOOLEAN_KEYS.has(row.key);
                  const isNum = NUMERIC_KEYS.has(row.key);
                  return (
                    <div key={row.key} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0 flex-1">
                        <Label className="font-mono text-xs text-foreground">{row.key}</Label>
                        {row.description && <p className="text-xs text-muted-foreground mt-0.5">{row.description}</p>}
                        <p className="text-[10px] text-muted-foreground/70 mt-1">Updated {new Date(row.updated_at).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2 md:w-72 md:justify-end">
                        {isBool ? (
                          <Switch
                            checked={!!draft[row.key]}
                            disabled={!isSuperAdmin}
                            onCheckedChange={(v) => setDraft((d) => ({ ...d, [row.key]: v }))}
                          />
                        ) : (
                          <Input
                            type={isNum ? "number" : "text"}
                            value={draft[row.key] ?? ""}
                            disabled={!isSuperAdmin}
                            onChange={(e) => setDraft((d) => ({ ...d, [row.key]: e.target.value }))}
                            className="h-9 w-40"
                          />
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!isSuperAdmin || saving === row.key || JSON.stringify(draft[row.key]) === JSON.stringify(row.value)}
                          onClick={() => save(row.key)}
                        >
                          <Save className="h-3.5 w-3.5 mr-1" /> Save
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </AdminSectionCard>
          ))
        )}
      </AdminPageBody>
    </>
  );
};

export default AdminSettingsPage;
