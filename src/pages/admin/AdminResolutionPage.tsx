import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import AdminDisputes from "@/components/admin/AdminDisputes";
import AdminSourceRegistry from "@/components/admin/AdminSourceRegistry";
import { Scale } from "lucide-react";

const AdminResolutionPage = () => (
  <div className="min-h-screen bg-background">
    <SEOHead title="Admin - Resolution" path="/admin/resolution" />
    <Navbar />
    <div className="border-b border-border/30">
      <div className="container py-6">
        <h1 className="font-display text-2xl font-bold tracking-wider"><Scale className="inline h-6 w-6 text-primary mr-2" />Resolution <span className="text-primary">Console</span></h1>
        <p className="text-xs text-muted-foreground mt-0.5">Source verification, dispute management & settlement</p>
      </div>
    </div>
    <div className="container py-6 space-y-8">
      <AdminDisputes />
      <AdminSourceRegistry />
    </div>
    <Footer />
  </div>
);

export default AdminResolutionPage;
