import { useState } from "react";
import { Link } from "wouter";
import { Bell, Globe, ChevronDown, LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";

interface DriverTopBarProps {
  pageTitle?: string;
}

export function DriverTopBar({ pageTitle = "Dashboard" }: DriverTopBarProps) {
  const { user, logout } = useAuth();
  const [language, setLanguage] = useState<"en" | "bn">("en");

  const toggleLanguage = () => {
    setLanguage(prev => prev === "en" ? "bn" : "en");
  };

  const driverName = user?.email?.split('@')[0] || "Driver";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center gap-4 px-4">
        {/* Mobile Menu Trigger + Logo */}
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden" data-testid="button-sidebar-trigger" />
          <Link href="/driver" className="flex items-center gap-2" data-testid="link-logo">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">SG</span>
            </div>
            <span className="hidden md:inline-block font-bold text-lg">SafeGo</span>
          </Link>
        </div>

        {/* Page Title */}
        <h1 className="text-xl font-semibold hidden sm:block" data-testid="text-page-title">
          {pageTitle}
        </h1>

        <div className="flex-1" />

        {/* Right Side Actions */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
            <Bell className="h-5 w-5" />
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              data-testid="badge-notification-count"
            >
              3
            </Badge>
          </Button>

          {/* Language Toggle */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleLanguage}
            data-testid="button-language-toggle"
            title={language === "en" ? "Switch to Bangla" : "Switch to English"}
          >
            <Globe className="h-5 w-5" />
          </Button>

          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2" data-testid="button-profile-dropdown">
                <UserIcon className="h-5 w-5" />
                <span className="hidden md:inline-block">{driverName}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <Link href="/driver/profile">
                <DropdownMenuItem data-testid="menu-profile">
                  <UserIcon className="h-4 w-4 mr-2" />
                  Profile
                </DropdownMenuItem>
              </Link>
              <Link href="/driver/account">
                <DropdownMenuItem data-testid="menu-settings">
                  <UserIcon className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} data-testid="menu-logout">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
