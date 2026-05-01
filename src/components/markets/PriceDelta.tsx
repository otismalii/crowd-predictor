import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface PriceDeltaProps {
  delta: number; // percentage points, e.g. +5 means up 5pp
  className?: string;
}

const PriceDelta = ({ delta, className = "" }: PriceDeltaProps) => {
  if (Math.abs(delta) < 0.5) {
    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] text-muted-foreground ${className}`}>
        <Minus className="h-2.5 w-2.5" /> 0%
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums ${
        up ? "text-primary" : "text-destructive"
      } ${className}`}
    >
      {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {up ? "+" : ""}{delta.toFixed(1)}pp
    </span>
  );
};

export default PriceDelta;
