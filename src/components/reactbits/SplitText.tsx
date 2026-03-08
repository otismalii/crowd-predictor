import { useMemo } from "react";
import { motion } from "framer-motion";

interface SplitTextProps {
  text: string;
  className?: string;
  delay?: number;
  splitType?: "chars" | "words";
  as?: "h1" | "h2" | "h3" | "p" | "span";
}

const SplitText = ({
  text,
  className = "",
  delay = 0.03,
  splitType = "chars",
  as: Tag = "span",
}: SplitTextProps) => {
  const parts = useMemo(() => {
    if (splitType === "words") return text.split(" ");
    return text.split("");
  }, [text, splitType]);

  return (
    <Tag className={className} aria-label={text}>
      {parts.map((part, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{
            delay: i * delay,
            duration: 0.4,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
          className="inline-block"
          style={{ whiteSpace: part === " " || (splitType === "words" && i < parts.length - 1) ? "pre" : undefined }}
        >
          {part}{splitType === "words" && i < parts.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </Tag>
  );
};

export default SplitText;
