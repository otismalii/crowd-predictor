import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import { Handshake } from "lucide-react";

const AdminCollaborationsPage = () => (
  <div className="min-h-screen bg-background">
    <SEOHead title="Admin - Collaborations" path="/admin/collaborations" />
    <Navbar />
    <div className="border-b border-border/30">
      <div className="container py-6">
        <h1 className="font-display text-2xl font-bold tracking-wider"><Handshake className="inline h-6 w-6 text-primary mr-2" /><span className="text-primary">Collaborations</span></h1>
        <p className="text-xs text-muted-foreground mt-0.5">Promotions, partner content, and campaign management</p>
      </div>
    </div>
    <div className="container py-6">
      <div className="border border-border/30 rounded-xl p-12 text-center">
        <Handshake className="mx-auto mb-4 h-12 w-12 text-muted-foreground/20" />
        <p className="text-muted-foreground font-display text-lg">Collaboration tools coming soon</p>
        <p className="text-xs text-muted-foreground mt-1">Manage sponsor branding, promoted markets, shareable promo bundles</p>
      </div>
    </div>
    <Footer />
  </div>
);

export default AdminCollaborationsPage;
