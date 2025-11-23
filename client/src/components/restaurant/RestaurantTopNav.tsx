import { useState } from "react";
import { Link } from "wouter";
import { Bell, Globe, ChevronDown, Search, Menu, ShieldCheck } from "lucide-react";
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
  restaurantId?: string;
  isOpen?: boolean;
  onToggleStatus?: (status: boolean) => void;
  sidebarCollapsed?: boolean;
  isDesktop?: boolean;
  userRole?: UserRole;
}

export function RestaurantTopNav({
  restaurantName = "My Restaurant",
  restaurantId,
  isOpen = true,
  onToggleStatus,
  sidebarCollapsed = false,
  isDesktop = true,
  userRole = "OWNER"
}: RestaurantTopNavProps) {
  const { logout, user } = useAuth();
  const [language, setLanguage] = useState("en");
  const [notificationCount] = useState(3);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header
      className="fixed top-0 right-0 min-h-16 bg-card border-b z-30 transition-all duration-300 shadow-sm"
      style={{
        left: isDesktop ? (sidebarCollapsed ? "4rem" : "16rem") : "0"
      }}
      data-testid="header-restaurant-topnav"
    >
      <div className="min-h-16 px-4 flex flex-wrap items-center gap-3 md:gap-4 lg:gap-6 py-2">
        {/* LEFT SECTION: Mobile Menu + Branding + Restaurant Info */}
        <div className="flex items-center gap-3 md:gap-4">
          {/* Mobile Menu Button */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
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
          <div className="hidden md:flex items-center gap-2 pr-4 lg:pr-6 border-r">
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold text-primary">SafeGo</span>
              <span className="text-lg font-bold">Eats</span>
            </div>
          </div>
          
          {/* Restaurant Info - R-ENHANCE: Redesigned layout */}
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <h1 
                className="font-semibold text-sm md:text-base truncate" 
                data-testid="text-restaurant-name-topnav"
              >
                {restaurantName}
              </h1>
              <Badge
                variant="outline"
                className="text-xs gap-1 px-1.5 py-0 border-green-500/50 text-green-700 dark:text-green-400 hidden sm:flex"
                data-testid="badge-verified"
              >
                <ShieldCheck className="h-3 w-3" />
                Verified
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {restaurantId && (
                <span className="hidden sm:inline" data-testid="text-restaurant-id">
                  ID: {restaurantId}
                </span>
              )}
              <Badge
                variant={isOpen ? "default" : "secondary"}
                className="text-xs px-1.5 py-0"
                data-testid="badge-store-status"
              >
                {isOpen ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </div>

        {/* CENTER SECTION: Search Bar - R-ENHANCE: Full-width on larger screens */}
        <div className="flex-1 max-w-2xl hidden lg:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search orders, menu items, customers..."
              className="pl-10 h-9 bg-background"
              disabled
              data-testid="input-global-search"
            />
          </div>
        </div>

        {/* RIGHT SECTION: Toggle + Notifications + Language + Profile */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* R-ENHANCE: Redesigned Order Receiving Toggle (Bigger, Clearer) */}
          <div className="flex items-center gap-2.5 px-3 py-1.5 border rounded-lg bg-background shadow-sm">
            <span className="text-sm font-medium whitespace-nowrap hidden sm:inline">
              {isOpen ? "Accepting Orders" : "Not Accepting"}
            </span>
            <Switch
              checked={isOpen}
              onCheckedChange={onToggleStatus}
              data-testid="switch-store-status"
              className="scale-110"
            />
          </div>

          {/* R-ENHANCE: Notifications with Improved Badge Positioning */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                data-testid="button-notifications"
              >
                <Bell className="h-5 w-5" />
                {notificationCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs rounded-full"
                    data-testid="badge-notification-count"
                  >
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Notifications</span>
                <Badge variant="secondary" className="text-xs">
                  {notificationCount} new
                </Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="p-8 text-sm text-muted-foreground text-center">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-20" />
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
                className="hidden md:flex"
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

          {/* R-ENHANCE: Modern Profile Menu Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="gap-2 px-2"
                data-testid="button-profile-menu"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                    {restaurantName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="h-4 w-4 hidden sm:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <div className="space-y-1">
                  <p className="font-semibold text-sm">{restaurantName}</p>
                  <p className="text-xs text-muted-foreground font-normal">
                    {user?.email || "restaurant@safego.com"}
                  </p>
                  <div className="flex items-center gap-1.5 pt-1">
                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                      {userRole}
                    </Badge>
                    <Badge variant="outline" className="text-xs px-1.5 py-0 border-green-500/50 text-green-700 dark:text-green-400">
                      Verified
                    </Badge>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/restaurant/settings/profile" data-testid="menu-item-profile">
                  Restaurant Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/restaurant/payouts/overview" data-testid="menu-item-payouts">
                  Payouts & Statements
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/restaurant/settings/hours" data-testid="menu-item-settings">
                  Store Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/restaurant/support/help" data-testid="menu-item-support">
                  Help & Support
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={logout}
                className="text-destructive focus:text-destructive"
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
