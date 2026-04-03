import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, CheckCheck, User, Target, Zap, TrendingUp, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const typeIcons: Record<string, typeof Bell> = {
  follow: User,
  prediction_result: Target,
  match_start: Zap,
  streak: TrendingUp,
};

const NotificationBell = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();

    const channelName = `notifications-${user.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) {
      setNotifications(data as Notification[]);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(prev - 1, 0));
  };

  if (!user) return null;

  return (
    <div className="relative">
      <motion.button
        onClick={() => setOpen(!open)}
        whileTap={{ scale: 0.9 }}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 top-full mt-2 z-50 w-80 max-h-96 overflow-y-auto rounded-xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-xl"
            >
              <div className="flex items-center justify-between p-3 border-b border-border/50">
                <span className="font-display text-sm font-bold tracking-wider">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1"
                  >
                    <CheckCheck className="h-3 w-3" /> Mark all read
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  <Bell className="mx-auto mb-2 h-6 w-6 opacity-20" />
                  No notifications yet
                </div>
              ) : (
                notifications.map((n, i) => {
                  const IconComp = typeIcons[n.type] || Volume2;
                  const content = (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => { if (!n.is_read) markRead(n.id); setOpen(false); }}
                      className={`flex items-start gap-3 p-3 transition-colors cursor-pointer hover:bg-muted/30 ${
                        !n.is_read ? "bg-primary/5" : ""
                      }`}
                    >
                      <div className="h-7 w-7 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <IconComp className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold ${!n.is_read ? "text-foreground" : "text-muted-foreground"}`}>
                          {n.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      {!n.is_read && (
                        <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                      )}
                    </motion.div>
                  );

                  return n.link ? (
                    <Link key={n.id} to={n.link}>{content}</Link>
                  ) : (
                    <div key={n.id}>{content}</div>
                  );
                })
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;
