const Aurora = ({ className = "" }: { className?: string }) => {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div
        className="absolute -top-1/2 -left-1/2 h-[200%] w-[200%] animate-[aurora-spin_20s_linear_infinite]"
        style={{
          background: `
            conic-gradient(
              from 0deg at 50% 50%,
              transparent 0deg,
              hsl(var(--primary) / 0.06) 60deg,
              transparent 120deg,
              hsl(var(--accent) / 0.04) 180deg,
              transparent 240deg,
              hsl(var(--primary) / 0.08) 300deg,
              transparent 360deg
            )
          `,
        }}
      />
      <div
        className="absolute -top-1/2 -left-1/2 h-[200%] w-[200%] animate-[aurora-spin_30s_linear_infinite_reverse]"
        style={{
          background: `
            conic-gradient(
              from 180deg at 50% 50%,
              transparent 0deg,
              hsl(var(--accent) / 0.04) 90deg,
              transparent 180deg,
              hsl(var(--primary) / 0.06) 270deg,
              transparent 360deg
            )
          `,
        }}
      />
    </div>
  );
};

export default Aurora;
