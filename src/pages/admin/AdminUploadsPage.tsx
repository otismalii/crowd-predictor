import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import { Image } from "lucide-react";

const AdminUploadsPage = () => (
  <div className="min-h-screen bg-background">
    <SEOHead title="Admin - Uploads" path="/admin/uploads" />
    <Navbar />
    <div className="border-b border-border/30">
      <div className="container py-6">
        <h1 className="font-display text-2xl font-bold tracking-wider"><Image className="inline h-6 w-6 text-primary mr-2" />Upload <span className="text-primary">Manager</span></h1>
        <p className="text-xs text-muted-foreground mt-0.5">Manage logos, OG images, social graphics, icons</p>
      </div>
    </div>
    <div className="container py-6">
      <div className="border border-border/30 rounded-xl p-12 text-center">
        <Image className="mx-auto mb-4 h-12 w-12 text-muted-foreground/20" />
        <p className="text-muted-foreground font-display text-lg">Upload manager coming soon</p>
        <p className="text-xs text-muted-foreground mt-1">Market images, source logos, banners, social assets</p>
      </div>
    </div>
    <Footer />
  </div>
);

export default AdminUploadsPage;
