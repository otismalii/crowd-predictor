import {
  LayoutDashboard, Activity, BarChart3, Plus, Scale, Droplet, Database,
  Landmark, RefreshCw, ShieldAlert, Gavel, Users, FileText, LineChart, Settings,
  Inbox, Sparkles, Brain, Radio, History, Workflow, ListChecks, Coins, Zap,
  Sun,
} from "lucide-react";
import type { AdminRole } from "@/hooks/useAdminRole";

export type AdminSection = "do" | "monitor" | "configure";

export type AdminNavItem = {
  to: string;
  label: string;
  icon: any;
  roles?: NonNullable<AdminRole>[];
  section?: AdminSection;
};

export type AdminNavGroup = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

// LDX v5 information architecture:
// Workspace (Inbox / Today) + 6 domains grouped by Do / Monitor / Configure
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { to: "/admin", label: "Overview", icon: LayoutDashboard, section: "monitor" },
      { to: "/admin/today", label: "Today", icon: Sun, section: "do" },
      { to: "/admin/inbox", label: "Inbox", icon: Inbox, section: "do" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { to: "/admin/operations/events", label: "Event Stream", icon: Activity, section: "monitor" },
    ],
  },
  {
    id: "markets",
    label: "Markets",
    items: [
      { to: "/admin/markets/queue", label: "Creation Queue", icon: Inbox, section: "do" },
      { to: "/admin/markets/oracle-suggestions", label: "Oracle Suggestions", icon: Sparkles, section: "do" },
      { to: "/admin/markets/resolution", label: "Resolution", icon: Scale, section: "do" },
      { to: "/admin/markets/import", label: "Import Markets", icon: Plus, roles: ["admin", "super_admin", "market_manager"], section: "do" },
      { to: "/admin/markets", label: "Active Markets", icon: BarChart3, section: "monitor" },
      { to: "/admin/markets/liquidity", label: "Liquidity", icon: Droplet, section: "monitor" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      { to: "/admin/finance/settlements", label: "Settlements", icon: Workflow, roles: ["admin", "super_admin"], section: "do" },
      { to: "/admin/finance/reconciliation", label: "Reconciliation", icon: RefreshCw, roles: ["admin", "super_admin"], section: "do" },
      { to: "/admin/finance/creator-payouts", label: "Creator Payouts", icon: Coins, roles: ["admin", "super_admin"], section: "do" },
      { to: "/admin/finance/treasury", label: "Treasury", icon: Landmark, roles: ["admin", "super_admin", "market_manager"], section: "monitor" },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    items: [
      { to: "/admin/intelligence/insights", label: "LOGIK Insights", icon: Brain, section: "monitor" },
      { to: "/admin/intelligence/predictions", label: "Prediction History", icon: History, section: "monitor" },
      { to: "/admin/intelligence/risk", label: "Risk Signals", icon: ShieldAlert, section: "monitor" },
      { to: "/admin/intelligence/sources", label: "Event Sources", icon: Radio, section: "configure" },
    ],
  },
  {
    id: "governance",
    label: "Governance",
    items: [
      { to: "/admin/governance/promotions", label: "Roles & Promotions", icon: ListChecks, roles: ["admin", "super_admin"], section: "do" },
      { to: "/admin/governance/disputes", label: "Disputes", icon: Gavel, roles: ["admin", "super_admin"], section: "do" },
      { to: "/admin/governance/fraud", label: "Fraud", icon: ShieldAlert, roles: ["admin", "super_admin"], section: "do" },
      { to: "/admin/governance/users", label: "Users", icon: Users, roles: ["admin", "super_admin"], section: "monitor" },
    ],
  },
  {
    id: "audit",
    label: "Audit",
    items: [
      { to: "/admin/audit/logs", label: "Audit Logs", icon: FileText, roles: ["admin", "super_admin"], section: "monitor" },
      { to: "/admin/audit/system", label: "System Analytics", icon: LineChart, section: "monitor" },
      { to: "/admin/audit/markets", label: "Market History", icon: History, section: "monitor" },
      { to: "/admin/audit/automation", label: "Automation", icon: Zap, roles: ["admin", "super_admin"], section: "monitor" },
      { to: "/admin/audit/settings", label: "Settings", icon: Settings, roles: ["super_admin"], section: "configure" },
    ],
  },
];

export const ROUTE_META: Record<string, { group: string; title: string }> = {};
ADMIN_NAV.forEach((g) => g.items.forEach((i) => { ROUTE_META[i.to] = { group: g.label, title: i.label }; }));

export const canSee = (item: AdminNavItem, role: AdminRole) => {
  if (!item.roles) return true;
  return !!role && item.roles.includes(role as NonNullable<AdminRole>);
};

export const SECTION_LABEL: Record<AdminSection, string> = {
  do: "Do",
  monitor: "Monitor",
  configure: "Configure",
};

export const SECTION_ORDER: AdminSection[] = ["do", "monitor", "configure"];
