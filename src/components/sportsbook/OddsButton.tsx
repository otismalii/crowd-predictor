import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  odds: number | null;
  suspended?: boolean;
  active?: boolean;
  onClick?: () => void;
  className?: string;
};

const OddsButton = ({ label, odds, suspended, active, onClick, className }: Props) => {
  const disabled = suspended || odds === null;

  return (
    <motion.button
      type="button"
      whileTap={disabled ? undefined : { scale: 0.96 }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-pressed={!!active}
      className={cn(
        "flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-2 transition-colors",
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-border/60 bg-muted/30 text-foreground hover:border-primary/50 hover:bg-primary/5",
        disabled && "cursor-not-allowed opacity-50 hover:border-border/60 hover:bg-muted/30",
        className,
      )}
    >
      <span className="w-full truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="flex items-center gap-1 font-display text-sm font-bold tabular-nums">
        {disabled ? <Lock className="h-3 w-3" /> : odds!.toFixed(2)}
      </span>
    </motion.button>
  );
};

export default OddsButton;
