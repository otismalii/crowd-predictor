import {
  LayoutDashboard, Activity, BarChart3, Plus, Scale, Droplet, Database,
  Landmark, RefreshCw, ShieldAlert, Gavel, Users, FileText, LineChart, Settings,
} from "lucide-react";
import type { AdminRole } from "@/hooks/useAdminRole";

export type AdminNavItem = {
  to: string;
  label: string;
  icon: any;
  roles?: NonNullable<AdminRole>[]; // omit = visible to all admin roles
};

export type AdminNavGroup = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

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
      { to: "/admin/markets", label: "Markets", icon: BarChart3 },
      { to: "/admin/markets/new", label: "New Market", icon: Plus },
      { to: "/admin/markets/resolution", label: "Resolution", icon: Scale },
      { to: "/admin/markets/liquidity", label: "Liquidity", icon: Droplet },
      { to: "/admin/markets/sources", label: "Sources", icon: Database },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      { to: "/admin/finance/treasury", label: "Treasury", icon: Landmark, roles: ["admin", "super_admin"] },
      { to: "/admin/finance/reconciliation", label: "Reconciliation", icon: RefreshCw, roles: ["admin", "super_admin"] },
    ],
  },
  {
    id: "risk",
    label: "Risk",
    items: [
      { to: "/admin/risk/fraud", label: "Fraud", icon: ShieldAlert, roles: ["admin", "super_admin"] },
      { to: "/admin/risk/disputes", label: "Disputes", icon: Gavel, roles: ["admin", "super_admin"] },
      { to: "/admin/risk/users", label: "Users", icon: Users, roles: ["admin", "super_admin"] },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { to: "/admin/system/audit", label: "Audit Log", icon: FileText, roles: ["admin", "super_admin"] },
      { to: "/admin/system/analytics", label: "Analytics", icon: LineChart },
      { to: "/admin/system/settings", label: "Settings", icon: Settings, roles: ["super_admin"] },
    ],
  },
];

export const ROUTE_META: Record<string, { group: string; title: string }> = {};
ADMIN_NAV.forEach((g) => g.items.forEach((i) => { ROUTE_META[i.to] = { group: g.label, title: i.label }; }));

export const canSee = (item: AdminNavItem, role: AdminRole) => {
  if (!item.roles) return true;
  return !!role && item.roles.includes(role as NonNullable<AdminRole>);
};
