import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import TradeHistoryList from "@/components/portfolio/TradeHistoryList";
import { Activity as ActivityIcon } from "lucide-react";
import { Link } from "react-router-dom";

const Activity = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setTransactions(data || []);
        setLoading(false);
      });
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-20 text-center text-muted-foreground">
          <ActivityIcon className="mx-auto mb-4 h-12 w-12 opacity-20" />
          <p className="font-display text-lg">Sign in to view activity</p>
          <Link to="/auth" className="text-primary hover:underline text-sm mt-2 inline-block">Sign in</Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Activity" path="/activity" />
      <Navbar />

      <div className="border-b border-border/30">
        <div className="container py-6">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-wider">
            <ActivityIcon className="inline h-7 w-7 text-primary mr-2" />
            <span className="text-primary">Activity</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Trade history, settlements & transactions</p>
        </div>
      </div>

      <div className="container py-6 max-w-2xl">
        {loading ? (
          <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : (
          <TradeHistoryList trades={transactions} />
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Activity;
