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
    <div className={cn("pt-2 pb-4", className)} data-testid={testId}>
      <div className="flex items-center gap-3 mb-3">
        {Icon && (
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/60 dark:bg-muted/40">
            <Icon className={cn("h-4 w-4", iconColor)} />
          </div>
        )}
        <div className="flex-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-border via-border/60 to-transparent" />
    </div>
  );
}
