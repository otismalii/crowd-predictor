import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Trash2, MessageCircle, ShieldCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

interface Comment {
  id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  profiles?: { username: string | null; avatar_url: string | null };
}

interface CommentThreadProps {
  marketId: string;
  comments: Comment[];
  onRefresh: () => void;
}

const CommentThread = ({ marketId, comments, onRefresh }: CommentThreadProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (user) {
      supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
        setIsAdmin(!!data);
      });
    }
  }, [user]);

  const handlePost = async () => {
    if (!user || !commentText.trim()) return;
    setPosting(true);
    const { error } = await supabase.from("market_comments").insert({
      market_id: marketId,
      user_id: user.id,
      content: commentText.trim(),
    });
    if (error) {
      toast({ title: "Failed to post", description: error.message, variant: "destructive" });
    } else {
      setCommentText("");
      onRefresh();
    }
    setPosting(false);
  };

  const handleDelete = async (commentId: string) => {
    await supabase.from("market_comments").delete().eq("id", commentId);
    onRefresh();
  };

  return (
    <div className="space-y-3">
      {user ? (
        <div className="flex gap-2">
          <Textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Share your analysis or opinion..."
            rows={2}
            className="text-sm resize-none flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handlePost();
              }
            }}
          />
          <Button size="sm" onClick={handlePost} disabled={posting || !commentText.trim()} className="self-end neon-glow min-h-[44px]">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="text-center py-3 text-sm text-muted-foreground rounded-lg border border-border/20 bg-muted/10">
          <Link to="/auth" className="text-primary hover:underline font-medium">Sign in</Link> to join the discussion
        </div>
      )}

      {comments.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <MessageCircle className="mx-auto mb-2 h-8 w-8 opacity-20" />
          <p className="text-sm">No comments yet — be the first to share your take!</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1 scrollbar-thin">
          {comments.map((comment, i) => {
            const canDelete = user?.id === comment.user_id || isAdmin;
            return (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="flex gap-2.5 p-3 rounded-lg bg-muted/20 border border-border/20 hover:bg-muted/30 transition-colors"
              >
                <Avatar className="h-7 w-7 flex-shrink-0 ring-1 ring-border/30">
                  <AvatarImage src={(comment.profiles as any)?.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px] bg-muted">
                    {((comment.profiles as any)?.username || "?")[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link to={`/profile/${comment.user_id}`} className="text-xs font-semibold text-primary hover:underline">
                      @{(comment.profiles as any)?.username || "anon"}
                    </Link>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </span>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="ml-auto text-muted-foreground hover:text-destructive transition-colors flex items-center gap-0.5"
                        title={isAdmin && user?.id !== comment.user_id ? "Admin delete" : "Delete"}
                      >
                        {isAdmin && user?.id !== comment.user_id && <ShieldCheck className="h-2.5 w-2.5" />}
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-foreground mt-0.5 whitespace-pre-line">{comment.content}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CommentThread;