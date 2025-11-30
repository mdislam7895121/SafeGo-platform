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
      {/* Header - very high z-index for sticky positioning */}
      <header className="sticky top-0 z-[9999] w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center gap-4 px-4 md:px-6">
          {/* Logo & Mobile Menu */}
          <div className="flex items-center gap-2">
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
              <SheetContent side="left" className="w-64">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    SafeGo Admin
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2"
                    onClick={() => handleNavigation("/admin")}
                    data-testid="button-mobile-nav-dashboard"
                  >
                    <Home className="h-4 w-4" />
                    Dashboard
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2"
                    onClick={() => handleNavigation("/admin/settings")}
                    data-testid="button-mobile-nav-settings"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Button>
                  <div className="border-t my-4" />
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 text-destructive"
                    onClick={handleLogout}
                    data-testid="button-mobile-nav-logout"
                  >
                    <LogOut className="h-4 w-4" />
                    Log Out
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>

            <Link href="/admin" className="flex items-center gap-2" data-testid="link-admin-home">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Shield className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="hidden md:inline-block font-bold text-lg">
                SafeGo Admin
              </span>
            </Link>
          </div>

          {/* Page Title */}
          <h1 className="text-lg font-semibold hidden md:block" data-testid="text-admin-page-title">
            {pageTitle}
          </h1>

          <div className="flex-1" />

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <Link href="/admin/notifications">
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative" 
                data-testid="button-admin-notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount?.count && unreadCount.count > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                  >
                    {unreadCount.count > 9 ? "9+" : unreadCount.count}
                  </Badge>
                )}
              </Button>
            </Link>

            {/* Theme Toggle */}
            <ThemeToggle variant="dropdown" />

            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="gap-2"
                  data-testid="button-admin-profile"
                >
                  <Avatar className="h-8 w-8 border-2 border-border">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline-block text-sm">{adminName}</span>
                  <ChevronDown className="h-4 w-4 hidden md:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium truncate" data-testid="text-admin-email">
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
                  data-testid="menu-item-admin-dashboard"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Dashboard
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={() => handleNavigation("/admin/settings")}
                  data-testid="menu-item-admin-settings"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onSelect={handleLogout}
                  className="text-destructive focus:text-destructive"
                  data-testid="menu-item-admin-logout"
                >
                  <LogOut className="h-4 w-4 mr-2" />
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
