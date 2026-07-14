import { format } from "date-fns";
import { CircleDot } from "lucide-react";

interface Props {
  events: Array<{ ts: string; label: string; kind: string }>;
}

export default function EventTimeline({ events }: Props) {
  if (!events || events.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No timeline events yet.</p>;
  }
  const sorted = [...events].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  return (
    <ol className="relative border-l border-border/50 pl-4 space-y-3">
      {sorted.map((e, i) => (
        <li key={i} className="relative">
          <CircleDot className="absolute -left-[22px] top-0.5 h-3 w-3 text-primary bg-background" />
          <p className="text-xs font-medium text-foreground">{e.label}</p>
          <p className="text-[10px] text-muted-foreground">{format(new Date(e.ts), "MMM d, HH:mm")}</p>
        </li>
      ))}
    </ol>
  );
}
