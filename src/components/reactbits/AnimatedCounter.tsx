import { useEffect, useRef, useState } from "react";
import { motion, useSpring, useTransform, useInView } from "framer-motion";

interface AnimatedCounterProps {
  value: number;
  fontSize?: number;
  className?: string;
  duration?: number;
  suffix?: string;
}

const AnimatedCounter = ({
  value,
  fontSize = 36,
  className = "",
  duration = 1.5,
  suffix = "",
}: AnimatedCounterProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const spring = useSpring(0, { duration: duration * 1000, bounce: 0 });
  const display = useTransform(spring, (v) =>
    Number.isInteger(value) ? Math.round(v).toString() : v.toFixed(1)
  );
  const [displayValue, setDisplayValue] = useState("0");

  useEffect(() => {
    if (isInView) {
      spring.set(value);
    }
  }, [isInView, value, spring]);

  useEffect(() => {
    const unsubscribe = display.on("change", (v) => setDisplayValue(v));
    return unsubscribe;
  }, [display]);

  return (
    <span ref={ref} className={className} style={{ fontSize, fontVariantNumeric: "tabular-nums" }}>
      {displayValue}{suffix}
    </span>
  );
};

export default AnimatedCounter;
