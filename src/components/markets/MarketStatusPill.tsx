import { getStatusColor } from "@/lib/market-state";

interface MarketStatusPillProps {
  status: string;
  size?: "sm" | "md";
}

const MarketStatusPill = ({ status, size = "sm" }: MarketStatusPillProps) => {
  const colorClass = getStatusColor(status);
  const sizeClass = size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1";

  return (
    <span className={`${sizeClass} rounded-full font-semibold ${colorClass}`}>
      {status === "open" && <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary mr-1" />}
      {status.toUpperCase()}
    </span>
  );
};

export default MarketStatusPill;
