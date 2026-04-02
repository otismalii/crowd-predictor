import { CheckCircle2, AlertCircle } from "lucide-react";

interface ResolutionBadgeProps {
  source?: string | null;
  verified?: boolean;
}

const ResolutionBadge = ({ source, verified }: ResolutionBadgeProps) => {
  if (!source) return null;

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
      verified
        ? "bg-primary/10 text-primary border border-primary/20"
        : "bg-muted text-muted-foreground border border-border/30"
    }`}>
      {verified ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      {source}
    </span>
  );
};

export default ResolutionBadge;
