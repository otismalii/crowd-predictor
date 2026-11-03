import { useState } from "react";
import { cn } from "@/lib/utils";
import { useDataSaver } from "@/hooks/useDataSaver";

type Props = { name: string; logoUrl?: string | null; className?: string };

/** 20px team badge with initials fallback (used when no logo, load fails, or Data Saver is on). */
const TeamCrest = ({ name, logoUrl, className }: Props) => {
  const [failed, setFailed] = useState(false);
  const [dataSaver] = useDataSaver();
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const showImg = logoUrl && !failed && !dataSaver;

  return (
    <span
      className={cn(
        "inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[8px] font-bold text-muted-foreground",
        className,
      )}
      aria-hidden
    >
      {showImg ? (
        <img src={`${logoUrl}/tiny`} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain"
          onError={(e) => {
            const img = e.currentTarget;
            if (img.src.endsWith("/tiny")) img.src = logoUrl!; else setFailed(true);
          }} />
      ) : initials}
    </span>
  );
};

export default TeamCrest;
