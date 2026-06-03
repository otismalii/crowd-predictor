import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

type Props = {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export const AdminPageHeader = ({ icon: Icon, title, subtitle, actions }: Props) => (
  <div className="border-b border-border/30 bg-background">
    <div className="px-4 sm:px-6 py-4 flex items-start justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-wide truncate">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  </div>
);

export const AdminPageBody = ({ children }: { children: ReactNode }) => (
  <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-6 pb-20">{children}</div>
);
