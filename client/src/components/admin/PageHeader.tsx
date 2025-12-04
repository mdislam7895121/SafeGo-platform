import { ReactNode } from "react";
import { Link } from "wouter";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconColor?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  iconColor = "text-primary",
  breadcrumbs,
  actions,
  className,
  children,
}: PageHeaderProps) {
  return (
    <div className={cn("border-b bg-background", className)}>
      <div className="px-4 py-4 sm:px-6 lg:px-8">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
            {breadcrumbs.map((item, index) => (
              <div key={item.label} className="flex items-center gap-1">
                {index > 0 && <ChevronRight className="h-3.5 w-3.5" />}
                {item.href ? (
                  <Link href={item.href}>
                    <span className="hover:text-foreground transition-colors cursor-pointer">
                      {item.label}
                    </span>
                  </Link>
                ) : (
                  <span className="text-foreground font-medium">{item.label}</span>
                )}
              </div>
            ))}
          </nav>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            {Icon && (
              <div className={cn("p-2 rounded-lg bg-primary/10 shrink-0", iconColor)}>
                <Icon className="h-5 w-5" />
              </div>
            )}
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight" data-testid="page-title">
                {title}
              </h1>
              {description && (
                <p className="text-sm text-muted-foreground mt-0.5" data-testid="page-description">
                  {description}
                </p>
              )}
            </div>
          </div>

          {actions && (
            <div className="flex items-center gap-2 shrink-0" data-testid="page-actions">
              {actions}
            </div>
          )}
        </div>

        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
}

interface PageHeaderTabsProps {
  tabs: {
    id: string;
    label: string;
    count?: number;
    icon?: LucideIcon;
  }[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function PageHeaderTabs({ tabs, activeTab, onTabChange }: PageHeaderTabsProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <Button
            key={tab.id}
            variant={isActive ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "gap-1.5 shrink-0",
              isActive && "bg-secondary font-medium"
            )}
            data-testid={`tab-${tab.id}`}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={cn(
                  "ml-1 text-[10px] px-1.5 py-0.5 rounded-full",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {tab.count}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
