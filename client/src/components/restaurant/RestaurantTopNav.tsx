import { useState } from "react";
import { Link } from "wouter";
import { Bell, Globe, ChevronDown, Search, Menu, ShieldCheck, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { RestaurantReceivingOrdersButton } from "./RestaurantReceivingOrdersButton";
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
      className="fixed top-0 right-0 bg-card border-b z-30 transition-all duration-300 shadow-sm"
      style={{
        left: isDesktop ? (sidebarCollapsed ? "4rem" : "16rem") : "0"
      }}
      data-testid="header-restaurant-topnav"
    >
      {/* R-ENHANCE: 3-ROW CLEAN STRUCTURE */}
      
      {/* ROW 1: TOP BAR - Brand + Notifications + Profile */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-border/40">
        <div className="flex items-center gap-3">
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
          <div className="flex items-center gap-1">
            <span className="text-base font-bold text-primary">SafeGo</span>
            <span className="text-base font-bold">Eats</span>
          </div>
        </div>

        {/* Right: Notifications + Language + Profile */}
        <div className="flex items-center gap-1">
          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                data-testid="button-notifications"
              >
                <Bell className="h-4 w-4" />
                {notificationCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-0.5 -right-0.5 h-4 w-4 p-0 flex items-center justify-center text-[10px] rounded-full"
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
                <Globe className="h-4 w-4" />
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
                className="gap-1.5 px-2 h-9"
                data-testid="button-profile-menu"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                    {restaurantName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="h-3.5 w-3.5 hidden sm:block" />
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

      {/* ROW 2: RESTAURANT IDENTITY + STATUS */}
      <div className="h-14 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 py-2">
        {/* Left: Restaurant Name + Verified Badge + ID/Location */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <h1 
              className="font-bold text-base md:text-lg truncate" 
              data-testid="text-restaurant-name-topnav"
            >
              {restaurantName}
            </h1>
            <Badge
              variant="outline"
              className="text-xs gap-1 px-1.5 py-0.5 border-green-500/50 text-green-700 dark:text-green-400"
              data-testid="badge-verified"
            >
              <ShieldCheck className="h-3 w-3" />
              Verified
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {restaurantId && (
              <span className="truncate max-w-[200px] sm:max-w-none" data-testid="text-restaurant-id">
                ID: {restaurantId}
              </span>
            )}
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1 hidden sm:flex">
              <MapPin className="h-3 w-3" />
              New York, USA
            </span>
          </div>
        </div>

        {/* Right: Capsule-Style Receiving Orders Button */}
        <div className="shrink-0">
          <RestaurantReceivingOrdersButton
            isReceivingOrders={isOpen}
            onToggle={onToggleStatus || (() => {})}
          />
        </div>
      </div>

      {/* ROW 3: SEARCH BAR */}
      <div className="h-12 px-4 flex items-center border-t border-border/40">
        <div className="relative w-full max-w-3xl mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search orders, menu items, customers..."
            className="pl-10 h-9 bg-background w-full"
            disabled
            data-testid="input-global-search"
          />
        </div>
      </div>
    </header>
  );
}
