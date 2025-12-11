import { Link, useLocation } from "wouter";
import { Home, ArrowLeft, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";

export function getCustomerHomeRoute(): string {
  return "/customer";
}

export function getCustomerEatsHomeRoute(): string {
  return "/customer/food";
}

interface CustomerHomeButtonProps {
  label?: string;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "icon";
  className?: string;
}

export function CustomerHomeButton({
  label = "Home",
  variant = "ghost",
  size = "default",
  className = "",
}: CustomerHomeButtonProps) {
  const [, navigate] = useLocation();
  
  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => navigate(getCustomerHomeRoute())}
      className={className}
      data-testid="button-customer-home"
    >
      <Home className="h-4 w-4 mr-2" />
      {size !== "icon" && label}
    </Button>
  );
}

interface BackToRestaurantsButtonProps {
  label?: string;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "icon";
  className?: string;
}

export function BackToRestaurantsButton({
  label = "Back to restaurants",
  variant = "ghost",
  size = "default",
  className = "",
}: BackToRestaurantsButtonProps) {
  const [, navigate] = useLocation();
  
  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => navigate(getCustomerEatsHomeRoute())}
      className={className}
      data-testid="button-back-to-restaurants"
    >
      <UtensilsCrossed className="h-4 w-4 mr-2" />
      {size !== "icon" && label}
    </Button>
  );
}

interface EatsNavigationBarProps {
  showHome?: boolean;
  showBackToRestaurants?: boolean;
  showBack?: boolean;
  backLabel?: string;
  backHref?: string;
  onBack?: () => void;
  title?: string;
  className?: string;
}

export function EatsNavigationBar({
  showHome = true,
  showBackToRestaurants = false,
  showBack = false,
  backLabel = "Back",
  backHref,
  onBack,
  title,
  className = "",
}: EatsNavigationBarProps) {
  const [, navigate] = useLocation();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backHref) {
      navigate(backHref);
    } else {
      window.history.back();
    }
  };

  return (
    <div className={`flex items-center justify-between gap-2 py-2 ${className}`}>
      <div className="flex items-center gap-2">
        {showBack && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {backLabel}
          </Button>
        )}
        {showBackToRestaurants && (
          <BackToRestaurantsButton variant="ghost" size="sm" />
        )}
        {title && (
          <span className="text-lg font-semibold ml-2">{title}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {showHome && (
          <CustomerHomeButton variant="ghost" size="sm" />
        )}
      </div>
    </div>
  );
}
