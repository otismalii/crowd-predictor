import { ExternalLink } from "lucide-react";

interface Props {
  sources: Array<{ url?: string; publisher?: string; source_type?: string; snapshot_excerpt?: string }>;
}

export default function SourceList({ sources }: Props) {
  if (!sources || sources.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No source evidence attached.</p>;
  }
  return (
    <ul className="space-y-2">
      {sources.map((s, i) => (
        <li key={i} className="rounded-lg border border-border/30 bg-muted/10 p-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground truncate">{s.publisher ?? "Source"}</span>
            {s.source_type && <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wider">{s.source_type}</span>}
            {s.url && (
              <a href={s.url} target="_blank" rel="noreferrer" className="ml-auto text-muted-foreground hover:text-primary">
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          {s.snapshot_excerpt && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-3">{s.snapshot_excerpt}</p>}
        </li>
      ))}
    </ul>
  );
}
