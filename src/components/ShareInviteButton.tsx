import { useState } from "react";
import { Share2, Copy, Check, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface ShareInviteButtonProps {
  url: string;
  title: string;
  text?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

const ShareInviteButton = ({ 
  url, 
  title, 
  text = "Check this out on PagazaBetz!", 
  variant = "ghost",
  size = "icon",
  className = "",
}: ShareInviteButtonProps) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const fullUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;
  const encodedUrl = encodeURIComponent(fullUrl);
  const encodedText = encodeURIComponent(`${text}\n${title}`);

  const shareLinks = {
    whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodeURIComponent(title)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast({ title: "Link copied to clipboard!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy link", variant: "destructive" });
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: fullUrl });
      } catch {
        // User cancelled or error - silently ignore
      }
    }
  };

  // Use native share on mobile if available
  if (typeof navigator !== "undefined" && navigator.share) {
    return (
      <Button 
        variant={variant} 
        size={size} 
        onClick={handleNativeShare} 
        title="Share"
        className={className}
      >
        <Share2 className="h-4 w-4" />
        {size !== "icon" && <span className="ml-2">Share</span>}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} title="Share" className={className}>
          <Share2 className="h-4 w-4" />
          {size !== "icon" && <span className="ml-2">Share</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleCopy} className="cursor-pointer">
          {copied ? (
            <Check className="h-4 w-4 mr-2 text-primary" />
          ) : (
            <Copy className="h-4 w-4 mr-2" />
          )}
          Copy link
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem asChild>
          <a 
            href={shareLinks.whatsapp} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="cursor-pointer flex items-center"
          >
            <MessageCircle className="h-4 w-4 mr-2 text-green-500" />
            WhatsApp
          </a>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <a 
            href={shareLinks.facebook} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="cursor-pointer flex items-center"
          >
            <svg className="h-4 w-4 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            Facebook
          </a>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <a 
            href={shareLinks.twitter} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="cursor-pointer flex items-center"
          >
            <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            Twitter / X
          </a>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <a 
            href={shareLinks.telegram} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="cursor-pointer flex items-center"
          >
            <Send className="h-4 w-4 mr-2 text-sky-500" />
            Telegram
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ShareInviteButton;
