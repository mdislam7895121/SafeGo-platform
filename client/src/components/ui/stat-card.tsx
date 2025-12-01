import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: LucideIcon;
  iconColor: string;
  iconBgColor?: string;
  value: string | number;
  label: string;
  isLoading?: boolean;
  testId?: string;
  className?: string;
  children?: ReactNode;
}

export function StatCard({
  icon: Icon,
  iconColor,
  iconBgColor,
  value,
  label,
  isLoading = false,
  testId,
  className,
}: StatCardProps) {
  const defaultBgColor = iconBgColor || `${iconColor.replace('text-', 'bg-').split('-')[0]}-${iconColor.split('-')[1]}-50`;
  
  return (
    <div
      className={cn(
        "group relative overflow-visible cursor-pointer",
        "rounded-[14px] border border-border/60",
        "bg-gradient-to-br from-card via-card to-muted/20",
        "dark:from-card dark:via-card dark:to-muted/10",
        "shadow-sm hover:shadow-md",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-1 hover:border-border",
        className
      )}
      data-testid={testId}
    >
      <div className="p-5">
        <div className="flex flex-col items-center text-center gap-3">
          <div 
            className={cn(
              "h-12 w-12 rounded-xl flex items-center justify-center",
              "transition-transform duration-300 group-hover:scale-105",
              iconBgColor || "bg-muted/50"
            )}
          >
            <Icon className={cn("h-[1.4rem] w-[1.4rem]", iconColor)} />
          </div>
          
          {isLoading ? (
            <Skeleton className="h-8 w-14" />
          ) : (
            <p 
              className="text-2xl font-bold tracking-tight"
              data-testid={testId ? `stat-${testId.replace('card-', '')}` : undefined}
            >
              {value}
            </p>
          )}
          
          <p className="text-xs font-medium text-muted-foreground tracking-wide">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

interface ManagementCardProps {
  icon: LucideIcon;
  iconColor: string;
  iconBgColor: string;
  title: string;
  description: string;
  badge?: number;
  testId?: string;
  className?: string;
}

export function ManagementCard({
  icon: Icon,
  iconColor,
  iconBgColor,
  title,
  description,
  badge,
  testId,
  className,
}: ManagementCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-visible cursor-pointer",
        "rounded-[14px] border border-border/60",
        "bg-gradient-to-br from-card via-card to-muted/20",
        "dark:from-card dark:via-card dark:to-muted/10",
        "shadow-sm hover:shadow-md",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-1 hover:border-border",
        className
      )}
      data-testid={testId}
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div 
            className={cn(
              "h-14 w-14 rounded-xl flex items-center justify-center",
              "transition-transform duration-300 group-hover:scale-105",
              iconBgColor
            )}
          >
            <Icon className={cn("h-7 w-7", iconColor)} />
          </div>
          {badge !== undefined && badge > 0 && (
            <span 
              className="min-w-[1.5rem] h-6 px-2 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold shadow-sm"
              data-testid={testId ? `badge-${testId.replace('card-', '')}` : undefined}
            >
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </div>
        <h3 className="font-semibold text-lg mb-1.5 group-hover:text-primary transition-colors">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
