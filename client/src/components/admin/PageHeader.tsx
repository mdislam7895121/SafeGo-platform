import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BackButtonConfig {
  label: string;
  href: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconColor?: string;
  breadcrumbs?: BreadcrumbItem[];
  backButton?: BackButtonConfig;
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
  backButton,
  actions,
  className,
  children,
}: PageHeaderProps) {
  const [, setLocation] = useLocation();

  const handleBack = () => {
    if (backButton?.href) {
      setLocation(backButton.href);
    }
  };

  return (
    <div className={cn(
      "border-b border-[#E5E7EB] dark:border-slate-700",
      "bg-[#F1F5F9] dark:bg-slate-800",
      "sticky top-0 z-10",
      className
    )}>
      <div className="px-4 sm:px-6 py-3">
        {/* Back Button - always shown if provided */}
        {backButton && (
          <div className="mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
              data-testid="button-back"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{backButton.label}</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </div>
        )}

        {/* Breadcrumbs - shown if no back button */}
        {!backButton && breadcrumbs && breadcrumbs.length > 0 && (
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

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <div className="p-1.5 bg-primary/10 dark:bg-primary/20 rounded-md shrink-0">
                <Icon className={cn("h-4 w-4", iconColor)} />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold tracking-tight truncate text-[#0F172A] dark:text-white" data-testid="page-title">
                {title}
              </h1>
              {description && (
                <p className="text-[11px] text-[#475569] dark:text-slate-400 truncate" data-testid="page-description">
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

        {children && <div className="mt-3">{children}</div>}
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
