/**
 * AdminLayout Component
 * Provides a consistent layout for admin pages with sidebar navigation,
 * header with profile navigation and logout functionality.
 * Modern enterprise-grade design with collapsible sidebar.
 */

import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  Bell,
  ChevronDown,
  PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { GlobalSearch } from "@/components/admin/GlobalSearch";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useQuery } from "@tanstack/react-query";
import { Separator } from "@/components/ui/separator";

interface AdminLayoutProps {
  children: ReactNode;
  pageTitle?: string;
}

export function AdminLayout({ children, pageTitle = "Admin Dashboard" }: AdminLayoutProps) {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/notifications/unread-count"],
    refetchInterval: 30000,
  });

  const adminName = user?.email?.split("@")[0] || "Admin";
  const initials = adminName
    .split(/[\s._-]/)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleNavigation = (route: string) => {
    setLocation(route);
  };

  const handleLogout = () => {
    logout();
  };

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex min-h-screen w-full">
        <AdminSidebar />
        
        <SidebarInset className="flex flex-col flex-1">
          {/* Header - Mobile optimized with larger tap targets */}
          <header className="sticky top-0 z-[100] flex h-14 sm:h-16 items-center gap-2 sm:gap-4 border-b bg-background/98 backdrop-blur-md supports-[backdrop-filter]:bg-background/85 shadow-sm px-3 sm:px-4 md:px-6">
            {/* Sidebar Toggle - 44px minimum tap target */}
            <SidebarTrigger className="-ml-1 min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9" data-testid="button-sidebar-toggle">
              <PanelLeft className="h-5 w-5" />
            </SidebarTrigger>

            <Separator orientation="vertical" className="hidden sm:block h-6" />

            {/* Page Title - Responsive typography */}
            <h1 className="text-sm sm:text-base font-semibold text-foreground/90 truncate max-w-[120px] xs:max-w-[180px] sm:max-w-none" data-testid="text-admin-page-title">
              {pageTitle}
            </h1>

            {/* Environment Badge */}
            <Badge 
              variant="secondary" 
              className="hidden md:flex text-[10px] font-semibold uppercase tracking-wide px-2.5 py-0.5 bg-primary/10 text-primary border-0"
              data-testid="badge-admin-environment"
            >
              Admin Panel
            </Badge>

            <div className="flex-1" />

            {/* Global Search - Desktop only */}
            <div className="hidden md:flex flex-1 max-w-md mx-4">
              <GlobalSearch />
            </div>

            <div className="flex-1 hidden md:block" />

            {/* Right Side Actions - Larger tap targets on mobile */}
            <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2">
              {/* Notifications - 44px tap target on mobile */}
              <Link href="/admin/notifications">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="relative min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9 h-11 w-11 sm:h-9 sm:w-9" 
                  data-testid="button-admin-notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount?.count && unreadCount.count > 0 && (
                    <span 
                      className="absolute -top-0.5 -right-0.5 min-w-[1.25rem] h-5 flex items-center justify-center px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold shadow-sm ring-2 ring-background"
                      data-testid="badge-notification-count"
                    >
                      {unreadCount.count > 99 ? "99+" : unreadCount.count}
                    </span>
                  )}
                </Button>
              </Link>

              <Separator orientation="vertical" className="hidden sm:block h-6 mx-1" />

              {/* Theme Toggle */}
              <ThemeToggle variant="dropdown" />

              {/* Profile Dropdown - 44px tap target on mobile */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="gap-1.5 sm:gap-2 min-h-[44px] sm:min-h-9 h-11 sm:h-9 px-2 sm:px-2 md:px-3"
                    data-testid="button-admin-profile"
                  >
                    <Avatar className="h-8 w-8 sm:h-7 sm:w-7 border-2 border-primary/20">
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-xs font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden lg:flex flex-col items-start">
                      <span className="text-sm font-medium leading-tight">{adminName}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 hidden lg:block text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="py-2">
                    <div className="flex flex-col gap-0.5">
                      <p className="text-sm font-semibold truncate" data-testid="text-admin-email">
                        {user?.email || "Admin"}
                      </p>
                      <p className="text-xs text-muted-foreground font-normal">
                        Administrator Account
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onSelect={() => handleNavigation("/admin")}
                    className="min-h-[44px] sm:min-h-[32px]"
                    data-testid="menu-item-admin-dashboard"
                  >
                    Dashboard
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onSelect={() => handleNavigation("/admin/settings")}
                    className="min-h-[44px] sm:min-h-[32px]"
                    data-testid="menu-item-admin-settings"
                  >
                    Settings
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onSelect={handleLogout}
                    className="text-destructive focus:text-destructive min-h-[44px] sm:min-h-[32px]"
                    data-testid="menu-item-admin-logout"
                  >
                    Log Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
