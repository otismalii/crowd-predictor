import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import { BarChart3 } from "lucide-react";

const AdminAnalyticsPage = () => (
  <div className="min-h-screen bg-background">
    <SEOHead title="Admin - Analytics" path="/admin/analytics" />
    <Navbar />
    <div className="border-b border-border/30">
      <div className="container py-6">
        <h1 className="font-display text-2xl font-bold tracking-wider"><BarChart3 className="inline h-6 w-6 text-primary mr-2" /><span className="text-primary">Analytics</span></h1>
        <p className="text-xs text-muted-foreground mt-0.5">Signups, retention, trade volume, engagement</p>
      </div>
    </div>
    <div className="container py-6">
      <div className="border border-border/30 rounded-xl p-12 text-center">
        <BarChart3 className="mx-auto mb-4 h-12 w-12 text-muted-foreground/20" />
        <p className="text-muted-foreground font-display text-lg">Analytics dashboard coming soon</p>
        <p className="text-xs text-muted-foreground mt-1">Signups, retention, first trade conversion, dead markets, top categories</p>
      </div>
    </div>
    <Footer />
  </div>
);

export default AdminAnalyticsPage;
