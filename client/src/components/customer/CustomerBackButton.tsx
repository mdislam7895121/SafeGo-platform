import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CustomerServiceTab = "ride" | "eats" | "parcel" | "tickets" | "rental" | "shop";

interface CustomerBackButtonProps {
  fallbackRoute?: string;
  fallbackTab?: CustomerServiceTab;
  onBack?: () => boolean | void;
  label?: string;
  className?: string;
}

export function CustomerBackButton({
  fallbackRoute = "/customer",
  fallbackTab,
  onBack,
  label = "Back",
  className,
}: CustomerBackButtonProps) {
  const [, setLocation] = useLocation();

  const handleBack = () => {
    if (onBack) {
      const shouldPreventNavigation = onBack();
      if (shouldPreventNavigation === true) {
        return;
      }
    }

    try {
      if (window.history.length > 1) {
        const currentPath = window.location.pathname;
        
        if (currentPath.startsWith("/customer")) {
          window.history.back();
          return;
        }
      }
    } catch (error) {
      console.error("[CustomerBackButton] History navigation failed:", error);
    }

    let targetRoute = fallbackRoute;
    if (fallbackTab) {
      targetRoute = `${fallbackRoute}?tab=${fallbackTab}`;
    }
    setLocation(targetRoute);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleBack}
      className={cn(
        "flex items-center gap-1.5 text-muted-foreground hover:text-foreground px-2 h-9",
        className
      )}
      data-testid="button-customer-back"
    >
      <ArrowLeft className="h-4 w-4" />
      <span>{label}</span>
    </Button>
  );
}
