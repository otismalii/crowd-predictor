import { type ReactNode } from "react";

interface ShimmerButtonProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}

const ShimmerButton = ({
  children,
  className = "",
  onClick,
  disabled = false,
}: ShimmerButtonProps) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group relative inline-flex items-center justify-center overflow-hidden rounded-lg border border-primary/30 bg-primary/10 px-6 py-3 font-display text-sm font-semibold uppercase tracking-wider text-primary transition-all duration-300 hover:bg-primary/20 hover:border-primary/50 hover:shadow-[0_0_20px_hsl(var(--primary)/0.3)] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <span className="absolute inset-0 overflow-hidden rounded-lg">
        <span className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
      </span>
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  );
};

export default ShimmerButton;
