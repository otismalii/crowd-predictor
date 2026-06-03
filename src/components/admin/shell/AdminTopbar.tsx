import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Command as CmdIcon, Home } from "lucide-react";
import { ROUTE_META } from "./adminNav";
import { AdminCommandPalette } from "./AdminCommandPalette";
import { useAdminRole } from "@/hooks/useAdminRole";

const envLabel = () => {
  if (typeof window === "undefined") return "prod";
  const h = window.location.hostname;
  if (h.includes("lovable.app") || h.includes("localhost") || h.includes("preview")) return "preview";
  return "prod";
};

export const AdminTopbar = () => {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const { role } = useAdminRole();
  const meta = ROUTE_META[pathname] ?? { group: "Admin", title: "" };
  const env = envLabel();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/40 bg-background/95 backdrop-blur px-3 sm:px-4">
      <SidebarTrigger />
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
        <Link to="/admin" className="hover:text-foreground flex items-center gap-1">
          <Home className="h-3 w-3" /> Admin
        </Link>
        {meta.group && <><span>/</span><span>{meta.group}</span></>}
        {meta.title && <><span>/</span><span className="text-foreground font-medium truncate">{meta.title}</span></>}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <Badge variant={env === "prod" ? "destructive" : "secondary"} className="hidden sm:inline-flex text-[10px] uppercase">
          {env}
        </Badge>
        {role && (
          <Badge variant="outline" className="hidden md:inline-flex text-[10px] uppercase">{role.replace("_", " ")}</Badge>
        )}
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2">
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden md:inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <CmdIcon className="h-2.5 w-2.5" />K
          </kbd>
        </Button>
      </div>
      <AdminCommandPalette open={open} onOpenChange={setOpen} />
    </header>
  );
};
