import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { 
  Share2, 
  Copy, 
  Check,
  ExternalLink,
} from "lucide-react";
import { SiX, SiFacebook, SiLinkedin, SiWhatsapp } from "react-icons/si";

interface SocialShareButtonProps {
  title: string;
  description?: string;
  url?: string;
  hashtags?: string[];
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function SocialShareButton({
  title,
  description = "",
  url,
  hashtags = [],
  className,
  variant = "outline",
  size = "sm",
}: SocialShareButtonProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description);
  const hashtagString = hashtags.length > 0 ? hashtags.map(h => h.replace("#", "")).join(",") : "";

  const shareLinks = {
    twitter: `https://twitter.com/intent/tweet?text=${encodedTitle}${description ? `%20-%20${encodedDescription}` : ""}&url=${encodedUrl}${hashtagString ? `&hashtags=${hashtagString}` : ""}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedTitle}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${encodedTitle}${description ? `%20-%20${encodedDescription}` : ""}%20${encodedUrl}`,
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "The promotion link has been copied to your clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Could not copy link to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleShare = (platform: keyof typeof shareLinks) => {
    const link = shareLinks[platform];
    window.open(link, "_blank", "noopener,noreferrer,width=600,height=400");
    setIsOpen(false);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url: shareUrl,
        });
        setIsOpen(false);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Share failed:", err);
        }
      }
    }
  };

  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={cn("gap-1.5", className)}
          data-testid="button-share"
        >
          <Share2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Share</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {canNativeShare && (
          <>
            <DropdownMenuItem
              onClick={handleNativeShare}
              className="gap-2 cursor-pointer"
              data-testid="button-native-share"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Share...</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        
        <DropdownMenuItem
          onClick={() => handleShare("twitter")}
          className="gap-2 cursor-pointer"
          data-testid="button-share-twitter"
        >
          <SiX className="h-4 w-4" />
          <span>Share on X (Twitter)</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem
          onClick={() => handleShare("facebook")}
          className="gap-2 cursor-pointer"
          data-testid="button-share-facebook"
        >
          <SiFacebook className="h-4 w-4 text-blue-600" />
          <span>Share on Facebook</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem
          onClick={() => handleShare("linkedin")}
          className="gap-2 cursor-pointer"
          data-testid="button-share-linkedin"
        >
          <SiLinkedin className="h-4 w-4 text-blue-700" />
          <span>Share on LinkedIn</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem
          onClick={() => handleShare("whatsapp")}
          className="gap-2 cursor-pointer"
          data-testid="button-share-whatsapp"
        >
          <SiWhatsapp className="h-4 w-4 text-green-500" />
          <span>Share on WhatsApp</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={handleCopyLink}
          className="gap-2 cursor-pointer"
          data-testid="button-copy-link"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          <span>{copied ? "Copied!" : "Copy link"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function generatePromotionShareUrl(
  promotionId: string,
  promotionType: "ride" | "restaurant" | "driver"
): string {
  let baseUrl = "";
  
  if (typeof window !== "undefined") {
    baseUrl = window.location.origin;
  } else if (import.meta.env.VITE_PUBLIC_URL) {
    baseUrl = import.meta.env.VITE_PUBLIC_URL;
  }
  
  const utmParams = new URLSearchParams({
    utm_source: "social",
    utm_medium: "share",
    utm_campaign: `${promotionType}_promo`,
    utm_content: promotionId,
  });
  
  return baseUrl ? `${baseUrl}/?${utmParams.toString()}` : `/?${utmParams.toString()}`;
}

export function formatPromotionForShare(
  promotion: {
    name?: string;
    title?: string;
    description?: string | null;
    discountType?: string;
    value?: number;
    discountPercentage?: number | null;
    discountValue?: number | null;
  }
): { title: string; description: string; hashtags: string[] } {
  const name = promotion.name || promotion.title || "Special Promotion";
  
  let discountText = "";
  if (promotion.discountType === "PERCENT" && promotion.value) {
    discountText = `${promotion.value}% off`;
  } else if (promotion.discountType === "FLAT" && promotion.value) {
    discountText = `$${promotion.value} off`;
  } else if (promotion.discountPercentage) {
    discountText = `${promotion.discountPercentage}% off`;
  } else if (promotion.discountValue) {
    discountText = `$${promotion.discountValue} off`;
  }

  const title = discountText ? `${name} - ${discountText}` : name;
  const description = promotion.description || "Check out this amazing deal on SafeGo!";
  
  return {
    title,
    description,
    hashtags: ["SafeGo", "Promotion", "Deal"],
  };
}
