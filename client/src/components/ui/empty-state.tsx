import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  iconColor?: string;
  iconBgColor?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "secondary" | "ghost";
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  size?: "sm" | "md" | "lg";
  testId?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  iconColor = "text-muted-foreground/60",
  iconBgColor = "bg-muted/50",
  action,
  secondaryAction,
  className,
  size = "md",
  testId,
}: EmptyStateProps) {
  const sizeClasses = {
    sm: {
      container: "py-6 px-4",
      iconWrapper: "h-10 w-10",
      icon: "h-5 w-5",
      title: "text-sm font-medium",
      description: "text-xs",
      gap: "gap-2",
    },
    md: {
      container: "py-10 px-6",
      iconWrapper: "h-14 w-14",
      icon: "h-7 w-7",
      title: "text-base font-semibold",
      description: "text-sm",
      gap: "gap-3",
    },
    lg: {
      container: "py-16 px-8",
      iconWrapper: "h-20 w-20",
      icon: "h-10 w-10",
      title: "text-lg font-semibold",
      description: "text-base",
      gap: "gap-4",
    },
  };

  const classes = sizeClasses[size];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        classes.container,
        classes.gap,
        className
      )}
      data-testid={testId}
    >
      <div
        className={cn(
          "rounded-full flex items-center justify-center",
          "transition-transform duration-300",
          classes.iconWrapper,
          iconBgColor
        )}
      >
        <Icon className={cn(classes.icon, iconColor)} />
      </div>

      <div className="space-y-1.5 max-w-xs">
        <h3 className={cn(classes.title, "text-foreground")}>{title}</h3>
        <p className={cn(classes.description, "text-muted-foreground leading-relaxed")}>
          {description}
        </p>
      </div>

      {(action || secondaryAction) && (
        <div className="flex items-center gap-2 mt-2">
          {action && (
            <Button
              variant={action.variant || "default"}
              size={size === "sm" ? "sm" : "default"}
              onClick={action.onClick}
              data-testid={testId ? `${testId}-action` : undefined}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="ghost"
              size={size === "sm" ? "sm" : "default"}
              onClick={secondaryAction.onClick}
              data-testid={testId ? `${testId}-secondary-action` : undefined}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

interface EmptyStateCardProps extends EmptyStateProps {
  bordered?: boolean;
}

export function EmptyStateCard({
  bordered = true,
  className,
  ...props
}: EmptyStateCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl",
        bordered && "border border-dashed border-border/60",
        "bg-gradient-to-br from-muted/20 to-muted/5",
        className
      )}
    >
      <EmptyState {...props} />
    </div>
  );
}

export const emptyStatePresets = {
  parcels: {
    icon: "Package" as const,
    title: "No active parcels today",
    description: "All parcels have been delivered or there are no new orders. New parcels will appear here.",
  },
  payouts: {
    icon: "HandCoins" as const,
    title: "No pending payouts",
    description: "All payouts have been processed. Pending payouts will be listed here when available.",
  },
  users: {
    icon: "Users" as const,
    title: "No users found",
    description: "There are no users matching your search criteria. Try adjusting your filters.",
  },
  drivers: {
    icon: "Car" as const,
    title: "No drivers available",
    description: "There are no active drivers at the moment. Drivers will appear here once they come online.",
  },
  restaurants: {
    icon: "UtensilsCrossed" as const,
    title: "No restaurants found",
    description: "No restaurants match your current filters. Try broadening your search.",
  },
  orders: {
    icon: "ShoppingBag" as const,
    title: "No orders yet",
    description: "Orders will appear here as customers place them. Check back soon!",
  },
  notifications: {
    icon: "Bell" as const,
    title: "All caught up!",
    description: "You have no new notifications. We'll notify you when something needs your attention.",
  },
  kyc: {
    icon: "Shield" as const,
    title: "No pending approvals",
    description: "All KYC applications have been reviewed. New submissions will appear here.",
  },
  wallets: {
    icon: "Wallet" as const,
    title: "No wallet activity",
    description: "There's no recent wallet activity to display. Transactions will appear here.",
  },
  fraud: {
    icon: "AlertTriangle" as const,
    title: "No fraud alerts",
    description: "Great news! No suspicious activity has been detected. We're monitoring for you.",
  },
  logs: {
    icon: "ScrollText" as const,
    title: "No activity logs",
    description: "System activity logs will be recorded here. No recent activity to display.",
  },
  search: {
    icon: "Search" as const,
    title: "No results found",
    description: "We couldn't find anything matching your search. Try different keywords.",
  },
  error: {
    icon: "AlertCircle" as const,
    title: "Something went wrong",
    description: "We encountered an error loading this content. Please try again.",
  },
  support: {
    icon: "MessageSquare" as const,
    title: "No support tickets",
    description: "There are no open support conversations. All tickets have been resolved.",
  },
};
