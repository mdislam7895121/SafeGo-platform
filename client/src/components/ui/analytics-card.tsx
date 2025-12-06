import { ReactNode, useEffect, useState, useRef } from "react";
import { LucideIcon, TrendingUp, TrendingDown, Minus, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnimatedNumberProps {
  value: number;
  format?: "number" | "percent" | "currency";
  duration?: number;
}

export function AnimatedNumber({ value, format = "number", duration = 250 }: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);
  const animationRef = useRef<number>();

  useEffect(() => {
    const startValue = previousValue.current;
    const endValue = value;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValue + (endValue - startValue) * easeOut;
      
      setDisplayValue(currentValue);
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        previousValue.current = endValue;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  const formatValue = (val: number) => {
    switch (format) {
      case "percent":
        return `${val.toFixed(1)}%`;
      case "currency":
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(Math.round(val));
      default:
        return new Intl.NumberFormat("en-US", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(Math.round(val));
    }
  };

  return <>{formatValue(displayValue)}</>;
}

interface BaseAnalyticsCardProps {
  children: ReactNode;
  className?: string;
  testId?: string;
  icon?: LucideIcon;
  iconClassName?: string;
}

export function BaseAnalyticsCard({
  children,
  className,
  testId,
  icon: Icon,
  iconClassName,
}: BaseAnalyticsCardProps) {
  return (
    <div
      className={cn(
        "relative",
        "bg-white dark:bg-[#1C1C1E]",
        "p-6",
        "rounded-[14px]",
        "shadow-[0_4px_16px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.2)]",
        "min-h-[140px]",
        "transition-all duration-200 ease-out",
        "hover:scale-[1.01] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_6px_20px_rgba(0,0,0,0.3)]",
        "overflow-hidden",
        className
      )}
      data-testid={testId}
    >
      {Icon && (
        <Icon
          className={cn(
            "absolute top-4 right-4 w-9 h-9 text-[#111827] dark:text-white opacity-[0.10] dark:opacity-[0.12]",
            iconClassName
          )}
          strokeWidth={1.5}
        />
      )}
      {children}
    </div>
  );
}

interface AnalyticsCardProps {
  label: string;
  value: number;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  format?: "number" | "percent" | "currency";
  isLoading?: boolean;
  testId?: string;
  className?: string;
}

export function AnalyticsCard({
  label,
  value,
  change,
  changeLabel = "vs last period",
  icon,
  format = "number",
  isLoading = false,
  testId,
  className,
}: AnalyticsCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;

  const getTrendIcon = () => {
    if (isPositive) return TrendingUp;
    if (isNegative) return TrendingDown;
    return Minus;
  };

  const TrendIcon = getTrendIcon();

  const getChangeColor = () => {
    if (isPositive) return "text-[#22C55E]";
    if (isNegative) return "text-[#EF4444]";
    return "text-[#9CA3AF]";
  };

  return (
    <BaseAnalyticsCard icon={icon} testId={testId} className={className}>
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
              data-testid={testId ? `value-${testId}` : undefined}
            >
              <AnimatedNumber value={value} format={format} />
            </p>
          )}
        </div>

        {change !== undefined && (
          <div className="flex items-center gap-1">
            <TrendIcon className={cn("w-3 h-3", getChangeColor())} />
            <span className={cn("text-xs font-normal", getChangeColor())}>
              {Math.abs(change).toFixed(1)}%
            </span>
            <span className="text-xs text-[#9CA3AF] dark:text-[#6B7280]">
              {changeLabel}
            </span>
          </div>
        )}
      </div>
    </BaseAnalyticsCard>
  );
}

interface AnalyticsStatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  isLoading?: boolean;
  testId?: string;
  className?: string;
}

export function AnalyticsStatCard({
  label,
  value,
  icon,
  iconColor,
  isLoading = false,
  testId,
  className,
}: AnalyticsStatCardProps) {
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
              data-testid={testId ? `value-${testId}` : undefined}
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

interface AnalyticsManagementCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  badge?: number;
  testId?: string;
  className?: string;
}

export function AnalyticsManagementCard({
  title,
  description,
  icon: Icon,
  iconColor = "text-primary",
  iconBgColor = "bg-primary/10",
  badge,
  testId,
  className,
}: AnalyticsManagementCardProps) {
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
            data-testid={testId ? `badge-${testId}` : undefined}
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

interface ConnectionBadgeProps {
  isConnected: boolean;
  className?: string;
}

export function ConnectionBadge({ isConnected, className }: ConnectionBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5",
        "px-3 py-1.5",
        "rounded-md",
        "text-xs font-medium",
        isConnected
          ? "bg-[#DCFCE7] text-[#166534] dark:bg-[#14532D] dark:text-[#86EFAC]"
          : "bg-[#FEF3C7] text-[#92400E] dark:bg-[#78350F] dark:text-[#FEF3C7]",
        className
      )}
    >
      {isConnected ? (
        <>
          <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
          Live
        </>
      ) : (
        <>
          <WifiOff className="w-3 h-3" />
          Reconnecting...
        </>
      )}
    </div>
  );
}

interface AnalyticsGridProps {
  children: ReactNode;
  className?: string;
}

export function AnalyticsGrid({ children, className }: AnalyticsGridProps) {
  return (
    <div
      className={cn(
        "grid gap-4",
        "grid-cols-2",
        "md:grid-cols-3",
        "lg:grid-cols-5",
        className
      )}
    >
      {children}
    </div>
  );
}
