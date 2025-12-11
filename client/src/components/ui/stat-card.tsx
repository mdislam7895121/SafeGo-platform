import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { BaseAnalyticsCard, AnimatedNumber } from "@/components/ui/analytics-card";

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
  icon,
  iconColor,
  iconBgColor,
  value,
  label,
  isLoading = false,
  testId,
  className,
}: StatCardProps) {
  return (
    <BaseAnalyticsCard icon={icon} iconClassName={iconColor} testId={testId} className={cn("h-[140px]", className)}>
      <div className="flex flex-col justify-between h-full">
        <p className="text-[14px] font-medium text-[#6B7280] dark:text-[#9CA3AF] leading-tight">
          {label}
        </p>

        <div className="flex-1 flex items-center">
          {isLoading ? (
            <div className="h-8 w-24 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
          ) : (
            <p
              className="text-[32px] font-semibold text-[#111827] dark:text-white tracking-[-0.02em]"
              data-testid={testId ? `stat-${testId.replace('card-', '')}` : undefined}
            >
              {typeof value === "number" ? (
                <AnimatedNumber value={value} />
              ) : (
                value
              )}
            </p>
          )}
        </div>
      </div>
    </BaseAnalyticsCard>
  );
}

interface QuickActionCardProps {
  icon: LucideIcon;
  iconColor: string;
  label: string;
  testId?: string;
  className?: string;
}

export function QuickActionCard({
  icon: Icon,
  iconColor,
  label,
  testId,
  className,
}: QuickActionCardProps) {
  return (
    <div
      className={cn(
        "premium-glow-card",
        "px-4 py-3",
        "flex items-center gap-2.5",
        "cursor-pointer group",
        "transition-all duration-200",
        className
      )}
      data-testid={testId}
    >
      <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-white/80 dark:bg-white/10 shrink-0 transition-transform duration-200 group-hover:scale-105">
        <Icon className={cn("h-4 w-4", iconColor)} />
      </div>
      <span className="text-[14px] font-medium text-[#111827] dark:text-white whitespace-nowrap">
        {label}
      </span>
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
    <BaseAnalyticsCard testId={testId} className={cn("cursor-pointer h-[160px]", className)}>
      <div className="flex flex-col h-full">
        <div className="flex items-start justify-between mb-3 gap-3">
          <div 
            className={cn(
              "h-11 w-11 rounded-xl flex items-center justify-center shrink-0",
              "transition-transform duration-200 group-hover:scale-105",
              iconBgColor
            )}
          >
            <Icon className={cn("h-5 w-5", iconColor)} />
          </div>
          {badge !== undefined && badge > 0 && (
            <span 
              className="min-w-[1.5rem] h-6 px-2 flex items-center justify-center rounded-full bg-[#EF4444] text-white text-[12px] font-bold shadow-sm shrink-0"
              data-testid={testId ? `badge-${testId.replace('card-', '')}` : undefined}
            >
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </div>
        <h3 className="text-[15px] font-semibold text-[#111827] dark:text-white mb-1 group-hover:text-primary transition-colors leading-tight">
          {title}
        </h3>
        <p className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed line-clamp-2 flex-1">
          {description}
        </p>
      </div>
    </BaseAnalyticsCard>
  );
}
