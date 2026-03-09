import { useMemo } from "react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";

interface PasswordStrengthProps {
  password: string;
}

const rules = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One number", test: (p: string) => /[0-9]/.test(p) },
  { label: "One special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const PasswordStrength = ({ password }: PasswordStrengthProps) => {
  const passed = useMemo(() => rules.filter(r => r.test(password)).length, [password]);
  const strength = password.length === 0 ? 0 : passed;

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["bg-muted", "bg-destructive", "bg-accent", "bg-primary/70", "bg-primary"][strength];

  if (password.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="space-y-2"
    >
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-1">
          {[1, 2, 3, 4].map(i => (
            <motion.div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                i <= strength ? strengthColor : "bg-muted"
              }`}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: i * 0.05 }}
            />
          ))}
        </div>
        <span className={`text-[10px] font-semibold ${
          strength <= 1 ? "text-destructive" : strength <= 2 ? "text-accent" : "text-primary"
        }`}>
          {strengthLabel}
        </span>
      </div>

      {/* Rules checklist */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {rules.map((rule, i) => {
          const pass = rule.test(password);
          return (
            <motion.div
              key={rule.label}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-1"
            >
              {pass ? (
                <Check className="h-3 w-3 text-primary flex-shrink-0" />
              ) : (
                <X className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
              )}
              <span className={`text-[10px] ${pass ? "text-primary" : "text-muted-foreground/60"}`}>
                {rule.label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default PasswordStrength;
