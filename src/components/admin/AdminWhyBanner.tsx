import { Info } from "lucide-react";

/**
 * LDX v5 UX triad — every "Do" surface should answer:
 * What happened? / What can I do? / What next?
 */
export default function AdminWhyBanner({
  happened, canDo, next,
}: { happened: string; canDo: string; next: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-muted/20 p-3 flex gap-3 items-start">
      <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs flex-1">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">What happened</div>
          <div className="text-foreground/90">{happened}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">What you can do</div>
          <div className="text-foreground/90">{canDo}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">What happens next</div>
          <div className="text-foreground/90">{next}</div>
        </div>
      </div>
    </div>
  );
}
