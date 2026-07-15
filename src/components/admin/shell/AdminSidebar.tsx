import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { Shield } from "lucide-react";
import { ADMIN_NAV, canSee, SECTION_LABEL, SECTION_ORDER, type AdminSection } from "./adminNav";
import { useAdminRole } from "@/hooks/useAdminRole";

export const AdminSidebar = () => {
  const { pathname } = useLocation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { role } = useAdminRole();

  const isActive = (to: string) => pathname === to || (to !== "/admin" && pathname.startsWith(to));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-border/40 px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-display text-sm font-bold tracking-wider">Pagaza</span>
              <span className="text-[10px] text-muted-foreground uppercase">Control Room</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {ADMIN_NAV.map((group) => {
          const visible = group.items.filter((i) => canSee(i, role));
          if (visible.length === 0) return null;

          // Bucket items by section, keep declared order within each bucket
          const buckets: Record<AdminSection, typeof visible> = { do: [], monitor: [], configure: [] };
          for (const item of visible) buckets[item.section ?? "monitor"].push(item);

          return (
            <SidebarGroup key={group.id}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                {SECTION_ORDER.map((sec) => {
                  const items = buckets[sec];
                  if (!items.length) return null;
                  return (
                    <div key={sec} className="mb-1">
                      {!collapsed && (
                        <div className="px-2 pt-1 pb-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                          {SECTION_LABEL[sec]}
                        </div>
                      )}
                      <SidebarMenu>
                        {items.map((item) => (
                          <SidebarMenuItem key={item.to}>
                            <SidebarMenuButton asChild isActive={isActive(item.to)} tooltip={item.label}>
                              <NavLink to={item.to} end={item.to === "/admin"} className="flex items-center gap-2">
                                <item.icon className="h-4 w-4 shrink-0" />
                                {!collapsed && <span>{item.label}</span>}
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </div>
                  );
                })}
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
};
