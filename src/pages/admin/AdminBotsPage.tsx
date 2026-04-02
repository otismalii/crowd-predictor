import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import { Zap } from "lucide-react";

const AdminBotsPage = () => (
  <div className="min-h-screen bg-background">
    <SEOHead title="Admin - Bots" path="/admin/bots" />
    <Navbar />
    <div className="border-b border-border/30">
      <div className="container py-6">
        <h1 className="font-display text-2xl font-bold tracking-wider"><Zap className="inline h-6 w-6 text-primary mr-2" />Bot <span className="text-primary">Simulation</span></h1>
        <p className="text-xs text-muted-foreground mt-0.5">Create bot profiles, assign strategies, run simulations</p>
      </div>
    </div>
    <div className="container py-6">
      <div className="border border-border/30 rounded-xl p-12 text-center">
        <Zap className="mx-auto mb-4 h-12 w-12 text-muted-foreground/20" />
        <p className="text-muted-foreground font-display text-lg">Bot engine coming soon</p>
        <p className="text-xs text-muted-foreground mt-1">Conservative, trend-following, contrarian, and market-maker bots</p>
      </div>
    </div>
    <Footer />
  </div>
);

export default AdminBotsPage;
