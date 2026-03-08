import { Card, CardContent } from "@/components/ui/card";
import { Users, Activity, Database, TrendingUp, Trophy, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

interface AdminOverviewProps {
  stats: {
    users: number;
    predictions: number;
    matches: number;
    liveMatches: number;
    pendingPredictions: number;
    correctRate: number;
  };
}

const AdminOverview = ({ stats }: AdminOverviewProps) => {
  const cards = [
    { label: "Total Users", value: stats.users, icon: Users, color: "text-primary", bg: "bg-primary/10" },
    { label: "Predictions", value: stats.predictions, icon: Activity, color: "text-accent", bg: "bg-accent/10" },
    { label: "Matches", value: stats.matches, icon: Database, color: "text-primary", bg: "bg-primary/10" },
    { label: "Live Now", value: stats.liveMatches, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Pending", value: stats.pendingPredictions, icon: TrendingUp, color: "text-accent", bg: "bg-accent/10" },
    { label: "Accuracy %", value: `${stats.correctRate}%`, icon: Trophy, color: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
        >
          <Card className="glass-card hover:border-primary/30 transition-colors">
            <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
              <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-display font-bold">{stat.value}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};

export default AdminOverview;
