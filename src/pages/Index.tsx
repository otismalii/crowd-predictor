import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Zap, Users, Brain, Trophy, ArrowRight } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const features = [
  {
    icon: Users,
    title: "Crowd Predictions",
    description: "See what the community thinks. Post your predictions and vote on others.",
  },
  {
    icon: Brain,
    title: "AI Insights",
    description: "Powered by AI analysis combining stats, form, and community sentiment.",
  },
  {
    icon: Trophy,
    title: "Leaderboards",
    description: "Climb the ranks. Prove you're the sharpest predictor in the game.",
  },
];

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden py-24 md:py-36">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="container relative text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <h1 className="font-display text-5xl font-bold leading-tight tracking-wider md:text-7xl">
              Predict with the{" "}
              <span className="text-primary neon-text">Crowd</span>.
              <br />
              Smarter with{" "}
              <span className="text-accent neon-text-accent">AI</span>.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Join Kenya's smartest football prediction community. Combine crowd wisdom with AI-powered insights to make better predictions.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button
                size="lg"
                className="neon-glow text-lg px-8"
                onClick={() => navigate(user ? "/feed" : "/auth")}
              >
                {user ? "Go to Feed" : "Start Predicting"} <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="container">
          <h2 className="mb-12 text-center font-display text-3xl font-bold tracking-wider md:text-4xl">
            Why <span className="text-primary">PagazaBetz</span>?
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="glass-card rounded-lg p-8 text-center transition-all hover:neon-glow"
              >
                <f.icon className="mx-auto mb-4 h-10 w-10 text-primary" />
                <h3 className="mb-2 font-display text-xl font-bold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container text-center">
          <div className="glass-card mx-auto max-w-2xl rounded-2xl p-12">
            <Zap className="mx-auto mb-4 h-12 w-12 text-accent animate-pulse-neon" />
            <h2 className="font-display text-3xl font-bold tracking-wider">Ready to Play?</h2>
            <p className="mt-4 text-muted-foreground">
              Free to join. Make your first prediction today.
            </p>
            <Button
              size="lg"
              className="mt-8 neon-glow text-lg px-8"
              onClick={() => navigate(user ? "/feed" : "/auth")}
            >
              {user ? "Go to Feed" : "Join Now"} <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
