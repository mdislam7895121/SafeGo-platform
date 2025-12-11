import { ReactNode } from "react";
import { X, ChevronRight, ExternalLink, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  avatar?: {
    src?: string;
    fallback: string;
    className?: string;
  };
  headerActions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function DetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  badge,
  avatar,
  headerActions,
  children,
  footer,
  width = "md",
  className,
}: DetailDrawerProps) {
  if (!open) return null;

  const widthClasses = {
    sm: "w-80",
    md: "w-96",
    lg: "w-[480px]",
    xl: "w-[560px]",
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        data-testid="drawer-backdrop"
      />
      <div
        className={cn(
          "fixed right-0 top-0 h-full bg-background border-l shadow-xl z-50 flex flex-col",
          widthClasses[width],
          className
        )}
        data-testid="detail-drawer"
      >
        <div className="flex items-start justify-between p-4 border-b shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            {avatar && (
              <Avatar className={cn("h-10 w-10 shrink-0", avatar.className)}>
                <AvatarImage src={avatar.src} />
                <AvatarFallback>{avatar.fallback}</AvatarFallback>
              </Avatar>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-lg truncate" data-testid="drawer-title">
                  {title}
                </h2>
                {badge}
              </div>
              {subtitle && (
                <p className="text-sm text-muted-foreground truncate" data-testid="drawer-subtitle">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerActions}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
              data-testid="button-close-drawer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">{children}</div>
        </ScrollArea>

        {footer && (
          <div className="border-t p-4 shrink-0" data-testid="drawer-footer">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}

interface DetailSectionProps {
  title: string;
  icon?: LucideIcon;
  iconColor?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function DetailSection({
  title,
  icon: Icon,
  iconColor = "text-muted-foreground",
  actions,
  children,
  className,
}: DetailSectionProps) {
  return (
    <div className={cn("space-y-3", className)} data-testid={`section-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={cn("h-4 w-4", iconColor)} />}
          <h3 className="text-sm font-medium">{title}</h3>
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

interface DetailItemProps {
  label: string;
  value?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  isLoading?: boolean;
  className?: string;
}

export function DetailItem({
  label,
  value,
  icon: Icon,
  actions,
  isLoading,
  className,
}: DetailItemProps) {
  return (
    <div className={cn("flex items-start justify-between py-2", className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      <div className="flex items-center gap-2 text-right">
        {isLoading ? (
          <Skeleton className="h-4 w-20" />
        ) : (
          <span className="text-sm font-medium">{value || "-"}</span>
        )}
        {actions}
      </div>
    </div>
  );
}

interface DetailListProps {
  items: DetailItemProps[];
  divided?: boolean;
  className?: string;
}

export function DetailList({ items, divided = true, className }: DetailListProps) {
  return (
    <div className={cn(divided && "divide-y", className)}>
      {items.map((item, index) => (
        <DetailItem key={index} {...item} />
      ))}
    </div>
  );
}

interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  icon?: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
}

interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export function Timeline({ events, className }: TimelineProps) {
  return (
    <div className={cn("relative space-y-4", className)}>
      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
      {events.map((event, index) => {
        const Icon = event.icon;
        return (
          <div
            key={event.id}
            className="relative flex gap-3 pl-1"
            data-testid={`timeline-event-${event.id}`}
          >
            <div
              className={cn(
                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background",
                event.iconBgColor
              )}
            >
              {Icon ? (
                <Icon className={cn("h-3.5 w-3.5", event.iconColor)} />
              ) : (
                <div className="h-2 w-2 rounded-full bg-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-sm font-medium">{event.title}</p>
              {event.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
              )}
              <p className="text-[10px] text-muted-foreground/70 mt-1">{event.timestamp}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        className
      )}
      data-testid="empty-state"
    >
      {Icon && (
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <h3 className="font-medium text-lg">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

interface LoadingStateProps {
  rows?: number;
  className?: string;
}

export function LoadingState({ rows = 5, className }: LoadingStateProps) {
  return (
    <div className={cn("space-y-4", className)} data-testid="loading-state">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
