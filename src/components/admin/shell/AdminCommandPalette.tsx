import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { ADMIN_NAV, canSee } from "./adminNav";
import { useAdminRole } from "@/hooks/useAdminRole";

export const AdminCommandPalette = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => {
  const navigate = useNavigate();
  const { role } = useAdminRole();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const go = (to: string) => { onOpenChange(false); navigate(to); };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump to page or run an action…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        {ADMIN_NAV.map((g) => {
          const visible = g.items.filter((i) => canSee(i, role));
          if (!visible.length) return null;
          return (
            <CommandGroup key={g.id} heading={g.label}>
              {visible.map((i) => (
                <CommandItem key={i.to} value={`${g.label} ${i.label}`} onSelect={() => go(i.to)}>
                  <i.icon className="h-4 w-4 mr-2" />
                  {i.label}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
        <CommandSeparator />
        <CommandGroup heading="Quick actions">
          <CommandItem onSelect={() => go("/admin/markets/resolution")}>Resolve next pending market</CommandItem>
          <CommandItem onSelect={() => go("/admin/finance/treasury")}>Approve next withdrawal</CommandItem>
          <CommandItem onSelect={() => go("/admin/risk/disputes")}>Open disputes queue</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};
