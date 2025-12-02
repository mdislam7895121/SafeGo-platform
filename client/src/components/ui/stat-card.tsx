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
        // Base card container
        "relative group cursor-pointer",
        "rounded-2xl",
        "bg-white/95",
        "min-h-[120px] sm:min-h-[110px]",
        "shadow-[0_10px_26px_rgba(15,23,42,0.08)]",
        "overflow-hidden",
        "transition-transform transition-shadow duration-300 ease-out",
        // Rim-light glow via before pseudo-element
        "before:content-[''] before:pointer-events-none before:absolute before:inset-0",
        "before:rounded-2xl",
        "before:shadow-[0_0_6px_rgba(255,255,255,0.34)]",
        // Under-glow via after pseudo-element
        "after:content-[''] after:pointer-events-none after:absolute",
        "after:bottom-[-12px] after:left-1/2 after:-translate-x-1/2",
        "after:w-[78%] after:h-[22px]",
        "after:rounded-full",
        "after:bg-[rgba(255,255,255,0.30)]",
        "after:blur-xl",
        // Hover effects
        "hover:-translate-y-1",
        "hover:shadow-[0_20px_42px_rgba(15,23,42,0.16)]",
        "hover:before:shadow-[0_0_10px_rgba(255,255,255,0.50)]",
        "hover:after:bg-[rgba(255,255,255,0.45)]",
        // Dark mode
        "dark:bg-[#101014]",
        "dark:shadow-[0_18px_40px_rgba(0,0,0,0.70)]",
        "dark:before:shadow-[0_0_5px_rgba(255,255,255,0.15)]",
        "dark:after:bg-[rgba(255,255,255,0.12)]",
        className
      )}
      data-testid={testId}
    >
      <div className="relative z-10 p-4 sm:p-5">
        <div className="flex flex-col items-center text-center gap-2 sm:gap-3">
          <div 
            className={cn(
              "h-11 w-11 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center",
              "transition-transform duration-300 group-hover:scale-105",
              iconBgColor || "bg-muted/50"
            )}
          >
            <Icon className={cn("h-5 w-5 sm:h-[1.4rem] sm:w-[1.4rem]", iconColor)} />
          </div>
          
          {isLoading ? (
            <Skeleton className="h-7 sm:h-8 w-12 sm:w-14" />
          ) : (
            <p 
              className="text-xl sm:text-2xl font-bold tracking-tight"
              data-testid={testId ? `stat-${testId.replace('card-', '')}` : undefined}
            >
              {value}
            </p>
          )}
          
          <p className="text-[11px] sm:text-xs font-medium text-muted-foreground tracking-wide leading-tight">
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
        // Base card container
        "relative group cursor-pointer",
        "rounded-2xl",
        "bg-white/95",
        "min-h-[140px] sm:min-h-[160px]",
        "shadow-[0_10px_26px_rgba(15,23,42,0.08)]",
        "overflow-hidden",
        "transition-transform transition-shadow duration-300 ease-out",
        // Rim-light glow via before pseudo-element
        "before:content-[''] before:pointer-events-none before:absolute before:inset-0",
        "before:rounded-2xl",
        "before:shadow-[0_0_6px_rgba(255,255,255,0.34)]",
        // Under-glow via after pseudo-element
        "after:content-[''] after:pointer-events-none after:absolute",
        "after:bottom-[-12px] after:left-1/2 after:-translate-x-1/2",
        "after:w-[78%] after:h-[22px]",
        "after:rounded-full",
        "after:bg-[rgba(255,255,255,0.30)]",
        "after:blur-xl",
        // Hover effects
        "hover:-translate-y-1",
        "hover:shadow-[0_20px_42px_rgba(15,23,42,0.16)]",
        "hover:before:shadow-[0_0_10px_rgba(255,255,255,0.50)]",
        "hover:after:bg-[rgba(255,255,255,0.45)]",
        // Dark mode
        "dark:bg-[#101014]",
        "dark:shadow-[0_18px_40px_rgba(0,0,0,0.70)]",
        "dark:before:shadow-[0_0_5px_rgba(255,255,255,0.15)]",
        "dark:after:bg-[rgba(255,255,255,0.12)]",
        className
      )}
      data-testid={testId}
    >
      <div className="relative z-10 p-4 sm:p-6">
        <div className="flex items-start justify-between mb-3 sm:mb-4 gap-2">
          <div 
            className={cn(
              "h-12 w-12 sm:h-14 sm:w-14 rounded-xl flex items-center justify-center shrink-0",
              "transition-transform duration-300 group-hover:scale-105",
              iconBgColor
            )}
          >
            <Icon className={cn("h-6 w-6 sm:h-7 sm:w-7", iconColor)} />
          </div>
          {badge !== undefined && badge > 0 && (
            <span 
              className="min-w-[1.5rem] h-6 px-2 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold shadow-sm shrink-0"
              data-testid={testId ? `badge-${testId.replace('card-', '')}` : undefined}
            >
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </div>
        <h3 className="font-semibold text-base sm:text-lg mb-1 sm:mb-1.5 group-hover:text-primary transition-colors leading-tight">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-2">
          {description}
        </p>
      </div>
    </div>
  );
}
