import { useState } from "react";
import { Link } from "wouter";
import { Bell, Globe, ChevronDown, Search, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { RestaurantSidebar } from "./RestaurantSidebar";
import type { UserRole } from "@/config/restaurant-nav";

interface RestaurantTopNavProps {
  restaurantName?: string;
  isOpen?: boolean;
  onToggleStatus?: (status: boolean) => void;
  sidebarCollapsed?: boolean;
  isDesktop?: boolean;
  userRole?: UserRole;
}

export function RestaurantTopNav({
  restaurantName = "My Restaurant",
  isOpen = true,
  onToggleStatus,
  sidebarCollapsed = false,
  isDesktop = true,
  userRole = "OWNER"
}: RestaurantTopNavProps) {
  const { logout, user } = useAuth();
  const [language, setLanguage] = useState("en");
  const [notificationCount] = useState(3); // Mock notification count
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header
      className="fixed top-0 right-0 h-16 bg-card border-b z-30 transition-all duration-300"
      style={{
        left: isDesktop ? (sidebarCollapsed ? "4rem" : "16rem") : "0"
      }}
    >
      <div className="h-full px-4 flex items-center justify-between gap-4">
        {/* Left Section */}
        <div className="flex items-center gap-2 lg:gap-4">
          {/* Mobile Menu Button (visible on mobile/tablet only) */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden hover-elevate active-elevate-2"
                data-testid="button-mobile-menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <RestaurantSidebar 
                userRole={userRole} 
                isMobileDrawer 
                onNavigate={() => setMobileMenuOpen(false)}
              />
            </SheetContent>
          </Sheet>
          
          {/* SafeGo Eats Branding */}
          <div className="flex items-center gap-2 pr-4 border-r">
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold text-primary">SafeGo</span>
              <span className="text-lg font-bold">Eats</span>
            </div>
          </div>
          
          {/* Restaurant Info */}
          <div>
            <h1 className="font-semibold text-base" data-testid="text-restaurant-name-topnav">
              {restaurantName}
            </h1>
            <div className="flex items-center gap-2">
              <Badge
                variant={isOpen ? "default" : "secondary"}
                className="text-xs"
                data-testid="badge-store-status"
              >
                {isOpen ? "Open" : "Closed"}
              </Badge>
            </div>
          </div>

          {/* Status Toggle */}
          <div className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-background">
            <span className="text-sm font-medium">
              {isOpen ? "Open" : "Closed"}
            </span>
            <Switch
              checked={isOpen}
              onCheckedChange={onToggleStatus}
              data-testid="switch-store-status"
            />
          </div>
        </div>

        {/* Center Section - Search (Placeholder) */}
        <div className="flex-1 max-w-md hidden lg:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search orders, menu items..."
              className="pl-9"
              disabled
              data-testid="input-global-search"
            />
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative hover-elevate active-elevate-2"
                data-testid="button-notifications"
              >
                <Bell className="h-5 w-5" />
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center">
                    {notificationCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="p-4 text-sm text-muted-foreground text-center">
                <p>No new notifications</p>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Language Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hover-elevate active-elevate-2"
                data-testid="button-language"
              >
                <Globe className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Language</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setLanguage("en")}
                className={language === "en" ? "bg-accent" : ""}
                data-testid="menu-item-lang-en"
              >
                English
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setLanguage("bn")}
                className={language === "bn" ? "bg-accent" : ""}
                data-testid="menu-item-lang-bn"
              >
                Bangla
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Profile Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="gap-2 hover-elevate active-elevate-2"
                data-testid="button-profile-menu"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {restaurantName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div>
                  <p className="font-medium">{restaurantName}</p>
                  <p className="text-xs text-muted-foreground">{user?.email || "restaurant@safego.com"}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/restaurant/settings/profile">
                  Restaurant Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/restaurant/payouts/overview">
                  Payouts & Statements
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/restaurant/settings/hours">
                  Store Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/restaurant/support/help">
                  Help & Support
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={logout}
                className="text-red-600"
                data-testid="menu-item-logout"
              >
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
