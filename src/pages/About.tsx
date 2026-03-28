import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import { Target, Globe, Shield, Zap } from "lucide-react";

const About = () => (
  <div className="min-h-screen bg-background">
    <SEOHead title="About Pagaza" description="Pagaza is Kenya's premier prediction market platform — credible, source-backed, and built for information-driven forecasting." path="/about" />
    <Navbar />
    <div className="container py-8 max-w-3xl">
      <h1 className="font-display text-3xl font-bold tracking-wider mb-6">
        About <span className="text-primary neon-text">Pagaza</span>
      </h1>

      <div className="space-y-8 text-sm text-muted-foreground">
        <p className="text-base text-foreground">
          Pagaza is a prediction market platform built in Kenya, for Kenya — and the world. 
          We believe the best forecasts come from transparent markets with clear rules, credible sources, and open resolution.
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          {[
            { icon: Target, title: "Kenya-First", desc: "Markets that matter to Kenyans — local politics, county events, economic indicators, and East African developments." },
            { icon: Globe, title: "Global Coverage", desc: "International politics, economics, social trends, and sports. If it's real and resolvable, we market it." },
            { icon: Shield, title: "Source-Backed", desc: "Every market resolution is backed by verifiable sources. No guesswork. No hidden admin decisions." },
            { icon: Zap, title: "Guest-First", desc: "Browse everything without signing up. Create an account when you're ready to save your progress." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-4 rounded-xl border border-border/30 bg-card/50">
              <Icon className="h-6 w-6 text-primary mb-2" />
              <h3 className="font-display text-sm font-bold text-foreground mb-1">{title}</h3>
              <p className="text-xs">{desc}</p>
            </div>
          ))}
        </div>

        <section>
          <h2 className="font-display text-lg font-bold text-foreground mb-2">How It Works</h2>
          <ol className="space-y-2 list-decimal list-inside">
            <li>Browse open markets across multiple categories.</li>
            <li>Buy shares in outcomes you believe will occur.</li>
            <li>Prices reflect the crowd's probability estimate.</li>
            <li>When the market resolves, winning shares pay out at 1 KES each.</li>
            <li>Build your track record on the leaderboard.</li>
          </ol>
        </section>

        <section>
          <h2 className="font-display text-lg font-bold text-foreground mb-2">Built By</h2>
          <p>
            <span className="text-accent font-semibold">LionByte Studios</span> — a Kenyan software studio building 
            credible, information-driven platforms for the modern web.
          </p>
        </section>
      </div>
    </div>
    <Footer />
  </div>
);

export default About;
