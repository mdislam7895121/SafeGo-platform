import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, Globe, ChevronDown, LogOut, User as UserIcon, Check, ExternalLink, Settings, Car, UtensilsCrossed, Package, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useLogout } from "@/hooks/use-logout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
  totalCount: number;
  hasMore: boolean;
}

const LANGUAGES = [
  { value: "en", label: "English", flag: "US" },
  { value: "bn", label: "Bengali", flag: "BD" },
  { value: "es", label: "Spanish", flag: "ES" },
  { value: "fr", label: "French", flag: "FR" },
];

type ServiceType = "ride" | "food" | "parcel";

interface RiderTopBarProps {
  pageTitle?: string;
}

export function RiderTopBar({ pageTitle = "Home" }: RiderTopBarProps) {
  const { user } = useAuth();
  const { performLogout } = useLogout();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [activeService, setActiveService] = useState<ServiceType>("ride");
  const [location, setLocation] = useLocation();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const handleLogout = () => {
    performLogout();
  };

  const handleServiceClick = (type: ServiceType) => {
    setActiveService(type);
    const routes: Record<ServiceType, string> = {
      ride: "/rider/home",
      food: "/customer/food",
      parcel: "/rider/parcels",
    };
    setLocation(routes[type]);
  };

  const { data: notificationsData } = useQuery<NotificationsResponse>({
    queryKey: ["/api/customer/notifications"],
    refetchInterval: 60000,
  });

  const { data: preferences } = useQuery({
    queryKey: ["/api/customer/preferences"],
  });

  const currentLanguage = (preferences as any)?.preferredLanguage || "en";

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest(`/api/customer/notifications/${notificationId}/read`, {
        method: "PATCH",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/customer/notifications/read-all", {
        method: "PATCH",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/notifications"] });
    },
  });

  const notifications = notificationsData?.notifications || [];
  const unreadCount = notificationsData?.unreadCount || 0;
  const riderName = user?.email?.split('@')[0] || "Rider";
  const riderInitials = riderName
    .split(/[\s._-]/)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleProfileNavigation = (route: string) => {
    setProfileOpen(false);
    setLocation(route);
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
    }
  };

  const serviceButtons: { type: ServiceType; icon: typeof Car; label: string }[] = [
    { type: "ride", icon: Car, label: "Ride" },
    { type: "food", icon: UtensilsCrossed, label: "Food" },
    { type: "parcel", icon: Package, label: "Parcel" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center gap-4 px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden" data-testid="button-rider-sidebar-trigger" />
          <Link href="/rider/home" className="flex items-center gap-2" data-testid="link-rider-logo">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">SG</span>
            </div>
            <span className="hidden md:inline-block font-bold text-lg">SafeGo</span>
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-1 bg-muted rounded-full p-1">
          {serviceButtons.map(({ type, icon: Icon, label }) => (
            <Button
              key={type}
              variant={activeService === type ? "default" : "ghost"}
              size="sm"
              className={`rounded-full px-4 ${activeService === type ? "" : "text-muted-foreground"}`}
              onClick={() => handleServiceClick(type)}
              data-testid={`button-service-${type}`}
            >
              <Icon className="h-4 w-4 mr-2" />
              {label}
            </Button>
          ))}
        </div>

        <h1 className="text-xl font-semibold hidden lg:block" data-testid="text-rider-page-title">
          {pageTitle}
        </h1>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative" 
                data-testid="button-rider-notifications"
                aria-label="View notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    data-testid="badge-rider-notification-count"
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0" data-testid="rider-notifications-dropdown">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h3 className="font-semibold">Notifications</h3>
                {unreadCount > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 text-xs"
                    onClick={() => markAllReadMutation.mutate()}
                    disabled={markAllReadMutation.isPending}
                    data-testid="button-rider-mark-all-read"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Mark all read
                  </Button>
                )}
              </div>
              <ScrollArea className="h-[300px]">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Bell className="h-10 w-10 mb-2 opacity-50" />
                    <p className="text-sm">No notifications yet</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {notifications.slice(0, 10).map((notification) => (
                      <button
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`w-full text-left px-4 py-3 hover-elevate transition-colors ${
                          !notification.isRead ? "bg-primary/5" : ""
                        }`}
                        data-testid={`rider-notification-item-${notification.id}`}
                      >
                        <div className="flex gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm font-medium truncate ${
                                !notification.isRead ? "text-foreground" : "text-muted-foreground"
                              }`}>
                                {notification.title}
                              </p>
                              {!notification.isRead && (
                                <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                              {notification.body}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
              <div className="border-t p-2">
                <Link href="/rider/settings" onClick={() => setNotificationsOpen(false)}>
                  <Button variant="ghost" className="w-full justify-center text-sm" data-testid="link-rider-notification-settings">
                    <Settings className="h-4 w-4 mr-2" />
                    Notification Settings
                  </Button>
                </Link>
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu open={languageOpen} onOpenChange={setLanguageOpen}>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                data-testid="button-rider-language"
                aria-label="Language settings"
              >
                <Globe className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48" data-testid="rider-language-dropdown">
              <DropdownMenuLabel>Language</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {LANGUAGES.map((lang) => (
                <DropdownMenuItem 
                  key={lang.value}
                  className="flex items-center justify-between"
                  data-testid={`rider-language-option-${lang.value}`}
                >
                  <span>{lang.label}</span>
                  {currentLanguage === lang.value && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <Link href="/rider/settings" onClick={() => setLanguageOpen(false)}>
                <DropdownMenuItem data-testid="link-rider-language-settings">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  All Settings
                </DropdownMenuItem>
              </Link>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu open={profileOpen} onOpenChange={setProfileOpen}>
            <DropdownMenuTrigger asChild>
              <button 
                type="button"
                className="flex items-center gap-2 rounded-md px-3 py-2 hover-elevate active-elevate-2 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" 
                data-testid="button-profile-avatar"
                aria-label="Open profile menu"
                aria-haspopup="menu"
                aria-expanded={profileOpen}
              >
                <Avatar className="h-8 w-8 border-2 border-border">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {riderInitials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:inline-block text-sm">{riderName}</span>
                <ChevronDown className="h-4 w-4 hidden md:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium truncate" data-testid="text-rider-email">
                    {user?.email || "Rider"}
                  </p>
                  <p className="text-xs text-muted-foreground font-normal">
                    Customer Account
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onSelect={() => handleProfileNavigation("/customer/profile")}
                data-testid="menu-item-customer-profile"
              >
                <UserIcon className="h-4 w-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem 
                onSelect={() => handleProfileNavigation("/customer/wallet")}
                data-testid="menu-item-customer-wallet"
              >
                <Wallet className="h-4 w-4 mr-2" />
                Wallet
              </DropdownMenuItem>
              <DropdownMenuItem 
                onSelect={() => handleProfileNavigation("/rider/settings")}
                data-testid="menu-item-customer-settings"
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onSelect={() => {
                  setProfileOpen(false);
                  setLogoutDialogOpen(true);
                }} 
                className="text-destructive focus:text-destructive"
                data-testid="menu-item-customer-logout"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent data-testid="logout-confirmation-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Log Out?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to sign out of your SafeGo account?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-logout-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleLogout}
              data-testid="button-logout-confirm"
            >
              Log Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
