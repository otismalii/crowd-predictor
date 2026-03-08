import { useTeamBadge } from "@/hooks/useTeamBadge";
import { Shield } from "lucide-react";

interface TeamBadgeProps {
  teamName: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "h-6 w-6",
  md: "h-10 w-10",
  lg: "h-14 w-14",
};

const TeamBadge = ({ teamName, size = "md", className = "" }: TeamBadgeProps) => {
  const badge = useTeamBadge(teamName);

  if (badge) {
    return (
      <img
        src={badge}
        alt={teamName}
        className={`${sizeMap[size]} object-contain ${className}`}
        loading="lazy"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  return (
    <div className={`${sizeMap[size]} rounded-full bg-muted flex items-center justify-center ${className}`}>
      <Shield className="h-1/2 w-1/2 text-muted-foreground" />
    </div>
  );
};

export default TeamBadge;
