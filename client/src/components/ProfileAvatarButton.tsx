/**
 * ProfileAvatarButton Component
 * A reusable, role-aware profile avatar button that navigates to the correct profile
 * based on the authenticated user's role.
 * 
 * Features:
 * - Role-aware navigation (customer, driver, restaurant, admin)
 * - Desktop: Direct dropdown menu with profile options
 * - Mobile: Opens drawer with profile options (configurable)
 * - Keyboard accessible
 * - Secure: Only shows current role's profile options
 * - Strict role validation with error handling
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { User, Wallet, Settings, LogOut, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import {
  profileNavConfig,
  isValidRole,
  PROFILE_ROUTES,
  WALLET_ROUTES,
  SETTINGS_ROUTES,
  type UserRole,
} from "@/config/profileNavConfig";

interface ProfileAvatarButtonProps {
  variant?: "default" | "compact";
  showName?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  avatarUrl?: string;
  overrideRole?: UserRole;
}

export function ProfileAvatarButton({
  variant = "default",
  showName = false,
  size = "md",
  className = "",
  avatarUrl,
  overrideRole,
}: ProfileAvatarButtonProps) {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < profileNavConfig.mobileBreakpoint);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const rawRole = overrideRole || user?.role;
  
  if (!rawRole || !isValidRole(rawRole)) {
    console.error(`[ProfileAvatarButton] Invalid or missing role: "${rawRole}"`);
    return null;
  }
  
  const currentRole = rawRole.toLowerCase() as UserRole;
  const profileRoute = PROFILE_ROUTES[currentRole];
  const walletRoute = WALLET_ROUTES[currentRole];
  const settingsRoute = SETTINGS_ROUTES[currentRole];

  const userName = user?.email?.split("@")[0] || "User";
  const initials = userName
    .split(/[\s._-]/)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const sizeClasses = {
    sm: "h-7 w-7",
    md: "h-8 w-8",
    lg: "h-10 w-10",
  };

  const handleNavigation = (route: string) => {
    setIsOpen(false);
    setLocation(route);
  };

  const handleLogout = () => {
    setIsOpen(false);
    logout();
  };

  const MenuContent = () => (
    <>
      <div className="px-3 py-2 border-b">
        <p className="text-sm font-medium truncate" data-testid="text-profile-email">
          {user?.email || "Guest"}
        </p>
        <p className="text-xs text-muted-foreground capitalize">
          {currentRole} Account
        </p>
      </div>

      <div className="py-1 flex flex-col gap-1">
        <button
          onClick={() => handleNavigation(profileRoute)}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm hover-elevate rounded-sm"
          data-testid="button-profile-menu-profile"
        >
          <User className="h-4 w-4" />
          Profile
        </button>

        {walletRoute && (
          <button
            onClick={() => handleNavigation(walletRoute)}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover-elevate rounded-sm"
            data-testid="button-profile-menu-wallet"
          >
            <Wallet className="h-4 w-4" />
            {currentRole === "restaurant" ? "Payouts" : "Wallet"}
          </button>
        )}

        {currentRole !== "customer" && (
          <button
            onClick={() => handleNavigation(settingsRoute)}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover-elevate rounded-sm"
            data-testid="button-profile-menu-settings"
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
        )}
      </div>

      <div className="border-t py-1">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover-elevate rounded-sm"
          data-testid="button-profile-menu-logout"
        >
          <LogOut className="h-4 w-4" />
          Log Out
        </button>
      </div>
    </>
  );

  if (!profileNavConfig.enableHeaderAvatarProfileNavigation) {
    return (
      <Avatar className={`${sizeClasses[size]} ${className}`}>
        <AvatarImage src={avatarUrl} alt={userName} />
        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>
    );
  }

  if (isMobile && profileNavConfig.mobileOpensDrawer) {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`rounded-full ${className}`}
            aria-label="Open profile menu"
            data-testid="button-profile-avatar"
          >
            <Avatar className={`${sizeClasses[size]} border-2 border-border`}>
              <AvatarImage src={avatarUrl} alt={userName} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-72">
          <SheetHeader className="text-left">
            <SheetTitle>Account</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <MenuContent />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-2 rounded-md px-3 py-2 hover-elevate active-elevate-2 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${variant === "compact" ? "px-2" : ""} ${className}`}
          aria-label="Open profile menu"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          data-testid="button-profile-avatar"
        >
          <Avatar className={`${sizeClasses[size]} border-2 border-border`}>
            <AvatarImage src={avatarUrl} alt={userName} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {showName && (
            <>
              <span className="hidden md:inline-block text-sm">{userName}</span>
              <ChevronDown className="h-4 w-4 hidden md:block" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium truncate" data-testid="text-profile-dropdown-email">
              {user?.email || "Guest"}
            </p>
            <p className="text-xs text-muted-foreground font-normal capitalize">
              {currentRole} Account
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onSelect={() => handleNavigation(profileRoute)}
          data-testid="menu-item-profile"
        >
          <User className="h-4 w-4 mr-2" />
          Profile
        </DropdownMenuItem>

        {walletRoute && (
          <DropdownMenuItem
            onSelect={() => handleNavigation(walletRoute)}
            data-testid="menu-item-wallet"
          >
            <Wallet className="h-4 w-4 mr-2" />
            {currentRole === "restaurant" ? "Payouts" : "Wallet"}
          </DropdownMenuItem>
        )}

        {currentRole !== "customer" && (
          <DropdownMenuItem
            onSelect={() => handleNavigation(settingsRoute)}
            data-testid="menu-item-settings"
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onSelect={handleLogout}
          className="text-destructive focus:text-destructive"
          data-testid="menu-item-logout"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Log Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
