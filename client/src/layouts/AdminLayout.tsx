/**
 * AdminLayout Component
 * Provides a consistent layout for admin pages with a header containing
 * profile navigation and logout functionality.
 * ADD-ONLY implementation for SafeGo profile avatar navigation fix.
 */

import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  Shield, 
  Home, 
  Settings, 
  LogOut, 
  Bell,
  ChevronDown,
  Menu,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useQuery } from "@tanstack/react-query";

interface AdminLayoutProps {
  children: ReactNode;
  pageTitle?: string;
}

export function AdminLayout({ children, pageTitle = "Admin Dashboard" }: AdminLayoutProps) {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    setMobileMenuOpen(false);
    setLocation(route);
  };

  const handleLogout = () => {
    setMobileMenuOpen(false);
    logout();
  };

  return (
    <div className="min-h-screen w-full bg-background">
      {/* Header - Professional modern design with soft shadow */}
      <header className="sticky top-0 z-[9999] w-full border-b bg-background/98 backdrop-blur-md supports-[backdrop-filter]:bg-background/85 shadow-sm">
        <div className="flex h-[4.5rem] items-center gap-4 px-4 md:px-8 lg:px-10">
          {/* Logo & Mobile Menu */}
          <div className="flex items-center gap-3">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="md:hidden"
                  data-testid="button-admin-mobile-menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                      <Shield className="h-4 w-4 text-primary-foreground" />
                    </div>
                    SafeGo Admin
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-8 flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-11"
                    onClick={() => handleNavigation("/admin")}
                    data-testid="button-mobile-nav-dashboard"
                  >
                    <Home className="h-4 w-4" />
                    Dashboard
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-11"
                    onClick={() => handleNavigation("/admin/settings")}
                    data-testid="button-mobile-nav-settings"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Button>
                  <div className="border-t my-4" />
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-11 text-destructive"
                    onClick={handleLogout}
                    data-testid="button-mobile-nav-logout"
                  >
                    <LogOut className="h-4 w-4" />
                    Log Out
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>

            <Link href="/admin" className="flex items-center gap-3" data-testid="link-admin-home">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-sm">
                <Shield className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="hidden md:flex flex-col">
                <span className="font-bold text-base leading-tight">
                  SafeGo
                </span>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  Admin Console
                </span>
              </div>
            </Link>

            {/* Environment Badge */}
            <Badge 
              variant="secondary" 
              className="hidden lg:flex ml-2 text-[10px] font-semibold uppercase tracking-wide px-2.5 py-0.5 bg-primary/10 text-primary border-0"
              data-testid="badge-admin-environment"
            >
              Admin Panel
            </Badge>
          </div>

          {/* Page Title - with separator */}
          <div className="hidden md:flex items-center gap-4">
            <div className="h-6 w-px bg-border" />
            <h1 className="text-base font-medium text-foreground/80" data-testid="text-admin-page-title">
              {pageTitle}
            </h1>
          </div>

          <div className="flex-1" />

          {/* Right Side Actions */}
          <div className="flex items-center gap-1 md:gap-2">
            {/* Notifications with improved badge */}
            <Link href="/admin/notifications">
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative h-10 w-10" 
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

            {/* Separator */}
            <div className="hidden sm:block h-6 w-px bg-border mx-1" />

            {/* Theme Toggle */}
            <ThemeToggle variant="dropdown" />

            {/* Profile Dropdown - Enhanced styling */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="gap-2 h-10 px-2 md:px-3"
                  data-testid="button-admin-profile"
                >
                  <Avatar className="h-8 w-8 border-2 border-primary/20 ring-2 ring-background">
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:flex flex-col items-start">
                    <span className="text-sm font-medium leading-tight">{adminName}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">Administrator</span>
                  </div>
                  <ChevronDown className="h-4 w-4 hidden md:block text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border-2 border-primary/20">
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-sm font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-0.5">
                      <p className="text-sm font-semibold truncate" data-testid="text-admin-email">
                        {user?.email || "Admin"}
                      </p>
                      <p className="text-xs text-muted-foreground font-normal">
                        Administrator Account
                      </p>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onSelect={() => handleNavigation("/admin")}
                  className="py-2.5"
                  data-testid="menu-item-admin-dashboard"
                >
                  <Home className="h-4 w-4 mr-3" />
                  Dashboard
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={() => handleNavigation("/admin/settings")}
                  className="py-2.5"
                  data-testid="menu-item-admin-settings"
                >
                  <Settings className="h-4 w-4 mr-3" />
                  Settings
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onSelect={handleLogout}
                  className="py-2.5 text-destructive focus:text-destructive"
                  data-testid="menu-item-admin-logout"
                >
                  <LogOut className="h-4 w-4 mr-3" />
                  Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full">
        {children}
      </main>
    </div>
  );
}
