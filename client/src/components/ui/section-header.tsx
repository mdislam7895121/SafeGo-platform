import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  icon?: LucideIcon;
  iconColor?: string;
  description?: string;
  className?: string;
  testId?: string;
}

export function SectionHeader({
  title,
  icon: Icon,
  iconColor = "text-primary",
  description,
  className,
  testId,
}: SectionHeaderProps) {
  return (
    <div className={cn("pt-1 sm:pt-2 pb-3 sm:pb-4", className)} data-testid={testId}>
      <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
        {Icon && (
          <div className="flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-muted/60 dark:bg-muted/40 shrink-0">
            <Icon className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", iconColor)} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate">
            {title}
          </h2>
          {description && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-1">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-border via-border/60 to-transparent" />
    </div>
  );
}
