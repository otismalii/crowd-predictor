import {
  LayoutDashboard, Activity, BarChart3, Plus, Scale, Droplet, Database,
  Landmark, RefreshCw, ShieldAlert, Gavel, Users, FileText, LineChart, Settings,
  Inbox, Sparkles, Brain, Radio, History, Workflow, ListChecks, Coins,
} from "lucide-react";
import type { AdminRole } from "@/hooks/useAdminRole";

export type AdminNavItem = {
  to: string;
  label: string;
  icon: any;
  roles?: NonNullable<AdminRole>[];
};

export type AdminNavGroup = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

// v4 LDX information architecture: 6 domains
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    id: "operations",
    label: "Operations",
    items: [
      { to: "/admin", label: "Overview", icon: LayoutDashboard },
      { to: "/admin/operations/events", label: "Event Stream", icon: Activity },
    ],
  },
  {
    id: "markets",
    label: "Markets",
    items: [
      { to: "/admin/markets", label: "Active Markets", icon: BarChart3 },
      { to: "/admin/markets/queue", label: "Creation Queue", icon: Inbox },
      { to: "/admin/markets/oracle-suggestions", label: "Oracle Suggestions", icon: Sparkles },
      { to: "/admin/markets/new", label: "Import Markets", icon: Plus, roles: ["admin", "super_admin", "market_manager"] },
      { to: "/admin/markets/resolution", label: "Resolution", icon: Scale },
      { to: "/admin/markets/liquidity", label: "Liquidity", icon: Droplet },
      { to: "/admin/markets/sources", label: "Sources", icon: Database },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      { to: "/admin/finance/treasury", label: "Treasury", icon: Landmark, roles: ["admin", "super_admin", "market_manager"] },
      { to: "/admin/finance/settlements", label: "Settlements", icon: Workflow, roles: ["admin", "super_admin"] },
      { to: "/admin/finance/creator-payouts", label: "Creator Payouts", icon: Coins, roles: ["admin", "super_admin"] },
      { to: "/admin/finance/reconciliation", label: "Reconciliation", icon: RefreshCw, roles: ["admin", "super_admin"] },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    items: [
      { to: "/admin/intelligence/insights", label: "LOGIK Insights", icon: Brain },
      { to: "/admin/intelligence/sources", label: "Event Sources", icon: Radio },
      { to: "/admin/intelligence/risk", label: "Risk Signals", icon: ShieldAlert },
      { to: "/admin/intelligence/predictions", label: "Prediction History", icon: History },
    ],
  },
  {
    id: "governance",
    label: "Governance",
    items: [
      { to: "/admin/governance/users", label: "Users", icon: Users, roles: ["admin", "super_admin"] },
      { to: "/admin/governance/promotions", label: "Roles & Promotions", icon: ListChecks, roles: ["admin", "super_admin"] },
      { to: "/admin/governance/disputes", label: "Disputes", icon: Gavel, roles: ["admin", "super_admin"] },
      { to: "/admin/governance/fraud", label: "Fraud", icon: ShieldAlert, roles: ["admin", "super_admin"] },
    ],
  },
  {
    id: "audit",
    label: "Audit",
    items: [
      { to: "/admin/audit/logs", label: "Audit Logs", icon: FileText, roles: ["admin", "super_admin"] },
      { to: "/admin/audit/system", label: "System Analytics", icon: LineChart },
      { to: "/admin/audit/markets", label: "Market History", icon: History },
      { to: "/admin/audit/settings", label: "Settings", icon: Settings, roles: ["super_admin"] },
    ],
  },
];

export const ROUTE_META: Record<string, { group: string; title: string }> = {};
ADMIN_NAV.forEach((g) => g.items.forEach((i) => { ROUTE_META[i.to] = { group: g.label, title: i.label }; }));

export const canSee = (item: AdminNavItem, role: AdminRole) => {
  if (!item.roles) return true;
  return !!role && item.roles.includes(role as NonNullable<AdminRole>);
};
