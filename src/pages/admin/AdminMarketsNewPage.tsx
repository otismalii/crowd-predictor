import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import MarketBuilder from "@/components/admin/MarketBuilder";
import { Navigate, useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

const AdminMarketsNewPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      setIsAdmin(data === true);
    });
  }, [user]);

  if (isAdmin === null) return <div className="min-h-screen bg-background"><Navbar /><div className="container py-20"><Skeleton className="h-8 w-48" /></div></div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Admin - New Market" path="/admin/markets/new" />
      <Navbar />
      <div className="border-b border-border/30">
        <div className="container py-6">
          <h1 className="font-display text-2xl font-bold tracking-wider">Create <span className="text-primary">New Market</span></h1>
          <p className="text-xs text-muted-foreground mt-0.5">Build and publish a new prediction market</p>
        </div>
      </div>
      <div className="container py-6 max-w-3xl">
        <MarketBuilder onCreated={() => navigate("/admin/markets")} />
      </div>
      <Footer />
    </div>
  );
};

export default AdminMarketsNewPage;
