import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { fetchWatchlist, removeFromWatchlist } from "@/services/watchlistService";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bookmark, X, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

const Watchlist = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await fetchWatchlist(user.id);
    setItems((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const handleRemove = async (marketId: string) => {
    if (!user) return;
    await removeFromWatchlist(user.id, marketId);
    setItems((prev) => prev.filter((i) => i.market_id !== marketId));
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <SEOHead title="Watchlist" path="/watchlist" description="Markets you're tracking on Pagaza." />
      <Navbar />
      <div className="container py-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Bookmark className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-wider">Watchlist</h1>
            <p className="text-xs text-muted-foreground">Markets you're tracking</p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-12">Loading…</p>
        ) : items.length === 0 ? (
          <SpotlightCard className="p-10 text-center" spotlightColor="rgba(120, 255, 120, 0.08)">
            <Bookmark className="mx-auto mb-3 h-10 w-10 text-primary/20" />
            <p className="text-muted-foreground font-display mb-2">Your watchlist is empty</p>
            <p className="text-xs text-muted-foreground mb-4">Browse markets and tap the bookmark icon to save them.</p>
            <Link to="/markets">
              <Button size="sm" className="neon-glow">
                <TrendingUp className="h-3.5 w-3.5 mr-1.5" /> Browse markets
              </Button>
            </Link>
          </SpotlightCard>
        ) : (
          <div className="space-y-3">
            {items.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <SpotlightCard className="group" spotlightColor="rgba(120, 255, 120, 0.08)">
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <Link to={`/market/${item.market_id}`} className="flex-1 min-w-0">
                      <p className="font-display font-bold text-sm group-hover:text-primary transition-colors truncate">
                        {item.markets?.title || "Market"}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {item.markets?.status}
                        </span>
                        <span className="text-[10px] text-muted-foreground">·</span>
                        <span className="text-[10px] text-accent font-medium">
                          {Number(item.markets?.total_volume ?? 0).toLocaleString()} KES vol
                        </span>
                        {item.alert_price !== null && item.alert_price !== undefined && (
                          <>
                            <span className="text-[10px] text-muted-foreground">·</span>
                            <span className="text-[10px] text-primary font-medium">
                              alert @ {Number(item.alert_price).toFixed(2)}
                            </span>
                          </>
                        )}
                      </div>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(item.market_id)}
                      className="shrink-0 h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      aria-label="Remove from watchlist"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </SpotlightCard>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Watchlist;
