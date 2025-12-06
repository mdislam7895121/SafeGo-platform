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
    <BaseAnalyticsCard icon={icon} iconClassName={iconColor} testId={testId} className={className}>
      <div className="flex flex-col justify-between h-full min-h-[92px]">
        <p className="text-sm font-medium text-[#6B7280] dark:text-[#9CA3AF]">
          {label}
        </p>

        <div className="flex-1 flex items-center">
          {isLoading ? (
            <div className="h-8 w-24 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
          ) : (
            <p
              className="text-[32px] font-semibold text-[#111827] dark:text-white tracking-tight"
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
    <BaseAnalyticsCard testId={testId} className={cn("group cursor-pointer", className)}>
      <div className="flex items-start justify-between mb-4 gap-3">
        <div 
          className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
            "transition-transform duration-200 group-hover:scale-105",
            iconBgColor
          )}
        >
          <Icon className={cn("h-6 w-6", iconColor)} />
        </div>
        {badge !== undefined && badge > 0 && (
          <span 
            className="min-w-[1.5rem] h-6 px-2 flex items-center justify-center rounded-full bg-[#EF4444] text-white text-xs font-bold shadow-sm shrink-0"
            data-testid={testId ? `badge-${testId.replace('card-', '')}` : undefined}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
      <h3 className="font-semibold text-base text-[#111827] dark:text-white mb-1 group-hover:text-primary transition-colors leading-tight">
        {title}
      </h3>
      <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed line-clamp-2">
        {description}
      </p>
    </BaseAnalyticsCard>
  );
}
