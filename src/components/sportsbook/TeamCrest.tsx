import { useState } from "react";
import { cn } from "@/lib/utils";
import { useDataSaver } from "@/hooks/useDataSaver";

type Size = "xs" | "sm" | "md" | "lg";
type Props = { name: string; logoUrl?: string | null; className?: string; size?: Size };

const SIZES: Record<Size, string> = {
  xs: "h-4 w-4 text-[7px]",
  sm: "h-6 w-6 text-[9px]",
  md: "h-8 w-8 text-[10px]",
  lg: "h-14 w-14 text-sm",
};

/** Team badge. Shields are never clipped; initials fallback when no logo, load fails, or Data Saver is on. */
const TeamCrest = ({ name, logoUrl, className, size = "sm" }: Props) => {
  const [failed, setFailed] = useState(false);
  const [dataSaver] = useDataSaver();
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const showImg = logoUrl && !failed && !dataSaver;
  const src = logoUrl ? (size === "lg" ? logoUrl : `${logoUrl}/tiny`) : undefined;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-bold",
        SIZES[size],
        !showImg && "rounded-full border border-border bg-muted text-muted-foreground",
        className,
      )}
      aria-hidden
    >
      {showImg ? (
        <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain drop-shadow"
          onError={(e) => {
            const img = e.currentTarget;
            if (img.src.endsWith("/tiny")) img.src = logoUrl!; else setFailed(true);
          }} />
      ) : initials}
    </span>
  );
};

export default TeamCrest;
