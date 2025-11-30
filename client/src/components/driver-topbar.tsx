import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, Globe, ChevronDown, Check, ExternalLink, Settings, DollarSign, Car, Gift, MessageSquare, Shield, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { ProfileAvatarButton } from "@/components/ProfileAvatarButton";

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
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "bn", label: "বাংলা", flag: "🇧🇩" },
  { value: "es", label: "Español", flag: "🇪🇸" },
  { value: "fr", label: "Français", flag: "🇫🇷" },
];

interface DriverTopBarProps {
  pageTitle?: string;
}

export function DriverTopBar({ pageTitle = "Dashboard" }: DriverTopBarProps) {
  const { user } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);

  // Fetch notifications from API
  const { data: notificationsData } = useQuery<NotificationsResponse>({
    queryKey: ["/api/driver/notifications"],
    refetchInterval: 60000, // Refetch every minute
  });

  // Fetch driver preferences for language
  const { data: preferences } = useQuery({
    queryKey: ["/api/driver/preferences"],
  });

  const currentLanguage = (preferences as any)?.preferredLanguage || "en";

  // Mark notification as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest(`/api/driver/notifications/${notificationId}/read`, {
        method: "PATCH",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/notifications"] });
    },
  });

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/driver/notifications/read-all", {
        method: "PATCH",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/notifications"] });
    },
  });

  // Update language preference mutation
  const updateLanguageMutation = useMutation({
    mutationFn: async (preferredLanguage: string) => {
      return apiRequest("/api/driver/preferences/language", {
        method: "PATCH",
        body: JSON.stringify({ preferredLanguage }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/preferences"] });
      setLanguageOpen(false);
    },
  });

  const notifications = notificationsData?.notifications || [];
  const unreadCount = notificationsData?.unreadCount || 0;

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
    }
  };

  const NotificationIcon = ({ type }: { type: string }) => {
    const iconClass = "h-4 w-4 text-muted-foreground";
    switch (type) {
      case "earnings":
        return <DollarSign className={iconClass} />;
      case "trip":
        return <Car className={iconClass} />;
      case "promo":
        return <Gift className={iconClass} />;
      case "support":
        return <MessageSquare className={iconClass} />;
      case "safety":
        return <Shield className={iconClass} />;
      default:
        return <Megaphone className={iconClass} />;
    }
  };

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
          {/* Notifications Dropdown */}
          <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative" 
                data-testid="button-notifications"
                aria-label="View notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    data-testid="badge-notification-count"
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0" data-testid="notifications-dropdown">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h3 className="font-semibold">Notifications</h3>
                {unreadCount > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 text-xs"
                    onClick={() => markAllReadMutation.mutate()}
                    disabled={markAllReadMutation.isPending}
                    data-testid="button-mark-all-read"
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
                        data-testid={`notification-item-${notification.id}`}
                      >
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            <NotificationIcon type={notification.type} />
                          </div>
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
                <Link href="/driver/account/notifications" onClick={() => setNotificationsOpen(false)}>
                  <Button variant="ghost" className="w-full justify-center text-sm" data-testid="link-all-notifications">
                    <Settings className="h-4 w-4 mr-2" />
                    Notification Settings
                  </Button>
                </Link>
              </div>
            </PopoverContent>
          </Popover>

          {/* Language/Region Dropdown */}
          <DropdownMenu open={languageOpen} onOpenChange={setLanguageOpen}>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                data-testid="button-language-toggle"
                aria-label="Language and region settings"
              >
                <Globe className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48" data-testid="language-dropdown">
              <DropdownMenuLabel>Language</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {LANGUAGES.map((lang) => (
                <DropdownMenuItem 
                  key={lang.value}
                  onClick={() => updateLanguageMutation.mutate(lang.value)}
                  className="flex items-center justify-between"
                  data-testid={`language-option-${lang.value}`}
                >
                  <span>{lang.label}</span>
                  {currentLanguage === lang.value && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <Link href="/driver/settings" onClick={() => setLanguageOpen(false)}>
                <DropdownMenuItem data-testid="link-language-settings">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  All Settings
                </DropdownMenuItem>
              </Link>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Profile Dropdown - Uses shared ProfileAvatarButton for consistent behavior */}
          <ProfileAvatarButton 
            overrideRole="driver"
            showName={true}
            size="md"
          />
        </div>
      </div>
    </header>
  );
}
