import { ReactNode } from "react";
import { LucideIcon, Inbox, AlertCircle } from "lucide-react";

export const AdminEmptyState = ({
  icon: Icon = Inbox, title, description, action,
}: { icon?: LucideIcon; title: string; description?: string; action?: ReactNode }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="p-3 rounded-full bg-muted/40 mb-3"><Icon className="h-5 w-5 text-muted-foreground" /></div>
    <h3 className="text-sm font-medium">{title}</h3>
    {description && <p className="text-xs text-muted-foreground mt-1 max-w-sm">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const AdminErrorState = ({ message, retry }: { message?: string; retry?: () => void }) => (
  <AdminEmptyState
    icon={AlertCircle}
    title="Something went wrong"
    description={message || "Failed to load data."}
    action={retry ? <button onClick={retry} className="text-xs underline text-primary">Try again</button> : undefined}
  />
);

export const AdminSectionCard = ({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) => (
  <section className="rounded-xl border border-border/40 bg-card/40">
    <header className="flex items-center justify-between px-4 py-3 border-b border-border/30">
      <h2 className="text-sm font-display font-bold tracking-wide uppercase text-muted-foreground">{title}</h2>
      {action}
    </header>
    <div className="p-4">{children}</div>
  </section>
);
