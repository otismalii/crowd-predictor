import { type ReactNode } from "react";

interface GradientTextProps {
  children: ReactNode;
  className?: string;
  colors?: string[];
  animationSpeed?: number;
  direction?: "horizontal" | "vertical" | "diagonal";
}

const GradientText = ({
  children,
  className = "",
  colors = ["hsl(120, 100%, 55%)", "hsl(50, 100%, 50%)", "hsl(142, 72%, 38%)", "hsl(120, 100%, 55%)"],
  animationSpeed = 6,
  direction = "horizontal",
}: GradientTextProps) => {
  const gradientDirection =
    direction === "horizontal"
      ? "to right"
      : direction === "vertical"
      ? "to bottom"
      : "to bottom right";

  return (
    <span
      className={`inline-block bg-clip-text text-transparent ${className}`}
      style={{
        backgroundImage: `linear-gradient(${gradientDirection}, ${colors.join(", ")})`,
        backgroundSize: direction === "horizontal" ? "300% 100%" : direction === "vertical" ? "100% 300%" : "300% 300%",
        animation: `gradient-shift ${animationSpeed}s ease infinite`,
      }}
    >
      {children}
    </span>
  );
};

export default GradientText;
