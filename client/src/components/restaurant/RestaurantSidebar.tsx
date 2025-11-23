import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { restaurantNavigation, filterNavByRole, type NavItem, type UserRole } from "@/config/restaurant-nav";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RestaurantSidebarProps {
  userRole?: UserRole;
  onCollapsedChange?: (collapsed: boolean) => void;
  isMobileDrawer?: boolean;
  onNavigate?: () => void;
  isTabletOrLarger?: boolean;
  isDesktop?: boolean;
}

export function RestaurantSidebar({ 
  userRole = "OWNER", 
  onCollapsedChange, 
  isMobileDrawer = false, 
  onNavigate,
  isTabletOrLarger = true,
  isDesktop = true 
}: RestaurantSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(["Orders", "Menu Management"]);
  const [location] = useLocation();

  const navigation = filterNavByRole(restaurantNavigation, userRole);

  const handleToggleCollapsed = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    onCollapsedChange?.(newCollapsed);
  };

  const toggleExpand = (label: string) => {
    setExpandedItems(prev =>
      prev.includes(label)
        ? prev.filter(item => item !== label)
        : [...prev, label]
    );
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    return location === path || location.startsWith(path + "/");
  };

  const isParentActive = (item: NavItem) => {
    if (item.path && isActive(item.path)) return true;
    if (item.children) {
      return item.children.some(child => isActive(child.path));
    }
    return false;
  };

  const renderNavItem = (item: NavItem, level = 0) => {
    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.label);
    const active = isParentActive(item);

    if (collapsed && level === 0) {
      // Collapsed mode - show only icons with tooltips
      return (
        <TooltipProvider key={item.label}>
          <Tooltip>
            <TooltipTrigger asChild>
              {item.path ? (
                <Link href={item.path}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "w-full h-10 justify-center hover-elevate active-elevate-2",
                      active && "bg-accent"
                    )}
                    onClick={() => onNavigate?.()}
                    data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Icon className="h-5 w-5" />
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-full h-10 justify-center hover-elevate active-elevate-2"
                  onClick={() => hasChildren && toggleExpand(item.label)}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <Icon className="h-5 w-5" />
                </Button>
              )}
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{item.label}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    // Expanded mode
    return (
      <div key={item.label}>
        {item.path ? (
          <Link href={item.path}>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3 h-10 hover-elevate active-elevate-2",
                level > 0 && "pl-10",
                active && "bg-accent"
              )}
              onClick={() => onNavigate?.()}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1 text-left text-sm">{item.label}</span>
            </Button>
          </Link>
        ) : (
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 h-10 hover-elevate active-elevate-2",
              active && "bg-accent"
            )}
            onClick={() => hasChildren && toggleExpand(item.label)}
            data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1 text-left text-sm">{item.label}</span>
            {hasChildren && (
              isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        )}

        {/* Render children if expanded */}
        {hasChildren && isExpanded && !collapsed && (
          <div className="space-y-1">
            {item.children!.map(child => renderNavItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // If this is a mobile drawer, don't show collapse button or fixed positioning
  if (isMobileDrawer) {
    return (
      <div className="h-full bg-card flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <div>
            <h2 className="font-bold text-lg">SafeGo Eats</h2>
            <p className="text-xs text-muted-foreground">Restaurant Portal</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {navigation.map((item) => renderNavItem(item, 0))}
        </nav>
      </div>
    );
  }

  // Calculate sidebar width: Desktop 256px (w-64), Tablet 192px (w-48), Collapsed 64px (w-16)
  const sidebarWidth = collapsed ? "w-16" : (isDesktop ? "w-64" : "w-48");

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-card border-r flex flex-col transition-all duration-300 z-40",
        // R-ENHANCE Task 3: Visible on tablet+ (≥768px), hidden on mobile (<768px)
        isTabletOrLarger ? "flex" : "hidden",
        sidebarWidth
      )}
    >
      {/* Header */}
      <div className={cn(
        "p-4 border-b flex items-center",
        collapsed ? "justify-center" : "justify-between"
      )}>
        {!collapsed && (
          <div>
            <h2 className="font-bold text-lg">SafeGo Eats</h2>
            <p className="text-xs text-muted-foreground">Restaurant Portal</p>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleCollapsed}
          className="hover-elevate active-elevate-2 shrink-0"
          data-testid="button-toggle-sidebar"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {navigation.map(item => renderNavItem(item))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            {userRole === "OWNER" ? "Owner Account" : "Staff Account"}
          </p>
        </div>
      )}
    </aside>
  );
}
