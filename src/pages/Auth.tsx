import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Zap, ArrowLeft, Mail, Lock, UserPlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import GradientText from "@/components/reactbits/GradientText";
import Aurora from "@/components/reactbits/Aurora";
import SplitText from "@/components/reactbits/SplitText";
import ShimmerButton from "@/components/reactbits/ShimmerButton";

const Auth = () => {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, resetPassword, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (mode === "forgot") {
      const { error } = await resetPassword(email);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Check your email", description: "Password reset link sent." });
      setLoading(false);
      return;
    }

    if (mode === "signup") {
      if (!username.trim()) {
        toast({ title: "Username required", variant: "destructive" });
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, username);
      if (error) toast({ title: "Signup failed", description: error.message, variant: "destructive" });
      else toast({ title: "Account created!", description: "Check your email to verify." });
    } else {
      const { error } = await signIn(email, password);
      if (error) toast({ title: "Login failed", description: error.message, variant: "destructive" });
      else navigate("/");
    }
    setLoading(false);
  };

  const titles = {
    login: "Welcome Back",
    signup: "Join the Game",
    forgot: "Reset Password",
  };

  const descriptions = {
    login: "Sign in to make your predictions",
    signup: "Create your account and start predicting",
    forgot: "We'll send you a reset link",
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 overflow-hidden">
      <Aurora />

      {/* Decorative floating elements */}
      <motion.div
        className="absolute top-1/4 left-10 h-32 w-32 rounded-full bg-primary/5 blur-3xl"
        animate={{ y: [0, -20, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 6, repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-1/4 right-10 h-40 w-40 rounded-full bg-accent/5 blur-3xl"
        animate={{ y: [0, 20, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 8, repeat: Infinity }}
      />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative w-full max-w-md"
      >
        <SpotlightCard className="backdrop-blur-sm" spotlightColor="rgba(120, 255, 120, 0.12)">
          <CardHeader className="text-center pb-2">
            <Link to="/" className="mx-auto mb-5 flex items-center gap-2 group">
              <motion.div
                whileHover={{ rotate: 180 }}
                transition={{ duration: 0.4 }}
              >
                <Zap className="h-8 w-8 text-primary" />
              </motion.div>
              <GradientText
                className="font-display text-2xl font-bold tracking-wider"
                animationSpeed={4}
              >
                PAGAZABETZ
              </GradientText>
            </Link>

            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <CardTitle className="font-display text-xl">
                  <SplitText text={titles[mode]} splitType="words" delay={0.08} />
                </CardTitle>
                <CardDescription className="mt-2">
                  {descriptions[mode]}
                </CardDescription>
              </motion.div>
            </AnimatePresence>
          </CardHeader>

          <CardContent className="pt-4">
            <AnimatePresence mode="wait">
              <motion.form
                key={mode}
                onSubmit={handleSubmit}
                className="space-y-4"
                initial={{ opacity: 0, x: mode === "signup" ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: mode === "signup" ? -20 : 20 }}
                transition={{ duration: 0.25 }}
              >
                {mode === "signup" && (
                  <motion.div
                    className="space-y-2"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    transition={{ delay: 0.1 }}
                  >
                    <Label htmlFor="username" className="flex items-center gap-1.5 text-xs">
                      <UserPlus className="h-3 w-3 text-primary" /> Username
                    </Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Your username"
                      required
                      className="bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
                    />
                  </motion.div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-1.5 text-xs">
                    <Mail className="h-3 w-3 text-primary" /> Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
                  />
                </div>

                {mode !== "forgot" && (
                  <div className="space-y-2">
                    <Label htmlFor="password" className="flex items-center gap-1.5 text-xs">
                      <Lock className="h-3 w-3 text-primary" /> Password
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
                    />
                  </div>
                )}

                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                  <Button type="submit" className="w-full neon-glow font-display tracking-wider" disabled={loading}>
                    {loading ? (
                      <motion.span
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                      >
                        Loading...
                      </motion.span>
                    ) : mode === "login" ? "⚡ Sign In" : mode === "signup" ? "⚡ Create Account" : "Send Reset Link"}
                  </Button>
                </motion.div>
              </motion.form>
            </AnimatePresence>

            <motion.div
              className="mt-5 space-y-2 text-center text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {mode === "login" && (
                <>
                  <button onClick={() => setMode("forgot")} className="text-primary/70 hover:text-primary hover:underline block mx-auto transition-colors text-xs">
                    Forgot password?
                  </button>
                  <p className="text-muted-foreground text-xs">
                    Don't have an account?{" "}
                    <button onClick={() => setMode("signup")} className="text-primary font-semibold hover:underline">Sign up</button>
                  </p>
                </>
              )}
              {mode === "signup" && (
                <p className="text-muted-foreground text-xs">
                  Already have an account?{" "}
                  <button onClick={() => setMode("login")} className="text-primary font-semibold hover:underline">Sign in</button>
                </p>
              )}
              {mode === "forgot" && (
                <button onClick={() => setMode("login")} className="text-primary hover:underline flex items-center gap-1 mx-auto text-xs">
                  <ArrowLeft className="h-3 w-3" /> Back to login
                </button>
              )}
            </motion.div>
          </CardContent>
        </SpotlightCard>
      </motion.div>
    </div>
  );
};

export default Auth;
