import SEOHead from "@/components/SEOHead";
import MarketBuilder from "@/components/admin/MarketBuilder";
import { useNavigate } from "react-router-dom";

const AdminMarketsNewPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Admin - New Market" path="/admin/markets/new" />
      
      <div className="border-b border-border/30">
        <div className="container py-6">
          <h1 className="font-display text-2xl font-bold tracking-wider">Create <span className="text-primary">New Market</span></h1>
          <p className="text-xs text-muted-foreground mt-0.5">Build and publish a new prediction market</p>
        </div>
      </div>
      <div className="container py-6 max-w-3xl">
        <MarketBuilder onCreated={() => navigate("/admin/markets")} />
      </div>
      
    </div>
  );
};

export default AdminMarketsNewPage;
