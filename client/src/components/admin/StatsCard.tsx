import { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  trend?: "up" | "down" | "neutral";
  isLoading?: boolean;
  className?: string;
  onClick?: () => void;
}

export function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  iconColor = "text-primary",
  iconBgColor = "bg-primary/10",
  trend,
  isLoading,
  className,
  onClick,
}: MetricCardProps) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up"
      ? "text-green-600 dark:text-green-400"
      : trend === "down"
      ? "text-red-600 dark:text-red-400"
      : "text-muted-foreground";

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all",
        onClick && "cursor-pointer hover-elevate",
        className
      )}
      onClick={onClick}
      data-testid={`metric-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
              {title}
            </p>
            {isLoading ? (
              <Skeleton className="h-8 w-24 mt-1" />
            ) : (
              <p className="text-xl sm:text-2xl font-bold mt-1 truncate">{value}</p>
            )}
            {(change !== undefined || changeLabel) && (
              <div className="flex items-center gap-1 mt-1.5">
                {trend && <TrendIcon className={cn("h-3 w-3", trendColor)} />}
                {change !== undefined && (
                  <span className={cn("text-xs font-medium", trendColor)}>
                    {change > 0 ? "+" : ""}
                    {change}%
                  </span>
                )}
                {changeLabel && (
                  <span className="text-xs text-muted-foreground">{changeLabel}</span>
                )}
              </div>
            )}
          </div>
          {Icon && (
            <div className={cn("p-2 sm:p-2.5 rounded-lg shrink-0", iconBgColor)}>
              <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5", iconColor)} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface MetricGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}

export function MetricGrid({ children, columns = 4, className }: MetricGridProps) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  };

  return (
    <div className={cn("grid gap-3 sm:gap-4", gridCols[columns], className)}>
      {children}
    </div>
  );
}

interface ProgressCardProps {
  title: string;
  value: number;
  max: number;
  icon?: LucideIcon;
  iconColor?: string;
  progressColor?: string;
  isLoading?: boolean;
  className?: string;
}

export function ProgressCard({
  title,
  value,
  max,
  icon: Icon,
  iconColor = "text-primary",
  progressColor = "bg-primary",
  isLoading,
  className,
}: ProgressCardProps) {
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0;

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {Icon && <Icon className={cn("h-4 w-4", iconColor)} />}
        </div>
        {isLoading ? (
          <Skeleton className="h-2 w-full rounded-full" />
        ) : (
          <>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", progressColor)}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="font-medium">{value.toLocaleString()}</span>
              <span className="text-muted-foreground">of {max.toLocaleString()}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface ListCardProps {
  title: string;
  items: {
    id: string;
    label: string;
    value: string | number;
    sublabel?: string;
    icon?: LucideIcon;
    iconColor?: string;
  }[];
  viewAllHref?: string;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function ListCard({
  title,
  items,
  viewAllHref,
  isLoading,
  emptyMessage = "No data available",
  className,
}: ListCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <div className="divide-y">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-4 py-3"
                  data-testid={`list-item-${item.id}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {Icon && (
                      <Icon className={cn("h-4 w-4 shrink-0", item.iconColor || "text-muted-foreground")} />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.label}</p>
                      {item.sublabel && (
                        <p className="text-xs text-muted-foreground truncate">{item.sublabel}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-semibold shrink-0 ml-2">{item.value}</span>
                </div>
              );
            })}
          </div>
        )}
        {viewAllHref && items.length > 0 && (
          <div className="p-2 border-t">
            <a
              href={viewAllHref}
              className="block text-center text-sm text-primary hover:underline py-1"
            >
              View all
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
