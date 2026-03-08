import { useRef, useState, type ReactNode } from "react";

interface MagnetProps {
  children: ReactNode;
  padding?: number;
  magnetStrength?: number;
  disabled?: boolean;
  className?: string;
}

const Magnet = ({
  children,
  padding = 60,
  magnetStrength = 3,
  disabled = false,
  className = "",
}: MagnetProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("translate3d(0, 0, 0)");
  const [transition, setTransition] = useState("transform 0.5s ease-in-out");

  const handleMouseMove = (e: React.MouseEvent) => {
    if (disabled || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distX = e.clientX - centerX;
    const distY = e.clientY - centerY;
    const distance = Math.sqrt(distX * distX + distY * distY);
    const magnetRange = Math.max(rect.width, rect.height) / 2 + padding;

    if (distance < magnetRange) {
      setTransition("transform 0.3s ease-out");
      setTransform(`translate3d(${distX / magnetStrength}px, ${distY / magnetStrength}px, 0)`);
    } else {
      setTransition("transform 0.5s ease-in-out");
      setTransform("translate3d(0, 0, 0)");
    }
  };

  const handleMouseLeave = () => {
    setTransition("transform 0.5s ease-in-out");
    setTransform("translate3d(0, 0, 0)");
  };

  return (
    <div
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ display: "inline-block" }}
    >
      <div ref={ref} style={{ transform, transition, willChange: "transform" }}>
        {children}
      </div>
    </div>
  );
};

export default Magnet;
