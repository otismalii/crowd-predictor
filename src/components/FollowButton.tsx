import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, UserMinus } from "lucide-react";
import { motion } from "framer-motion";

interface FollowButtonProps {
  targetUserId: string;
  onFollowChange?: () => void;
}

const FollowButton = ({ targetUserId, onFollowChange }: FollowButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || user.id === targetUserId) return;
    supabase
      .from("follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId)
      .maybeSingle()
      .then(({ data }) => setIsFollowing(!!data));
  }, [user, targetUserId]);

  if (!user || user.id === targetUserId) return null;

  const handleToggle = async () => {
    setLoading(true);
    if (isFollowing) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else {
        setIsFollowing(false);
        // Insert notification for unfollow not needed
      }
    } else {
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: user.id, following_id: targetUserId });
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else {
        setIsFollowing(true);
        // Send notification
        await supabase.from("notifications").insert({
          user_id: targetUserId,
          type: "follow",
          title: "New follower!",
          message: `Someone started following you`,
          link: `/profile/${user.id}`,
        });
      }
    }
    onFollowChange?.();
    setLoading(false);
  };

  return (
    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
      <Button
        onClick={handleToggle}
        disabled={loading}
        variant={isFollowing ? "outline" : "default"}
        size="sm"
        className={isFollowing ? "border-primary/30 text-primary hover:text-destructive hover:border-destructive/30" : "neon-glow"}
      >
        {isFollowing ? (
          <><UserMinus className="h-3.5 w-3.5 mr-1.5" /> Unfollow</>
        ) : (
          <><UserPlus className="h-3.5 w-3.5 mr-1.5" /> Follow</>
        )}
      </Button>
    </motion.div>
  );
};

export default FollowButton;
