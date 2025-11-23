import { Bell, Package, AlertCircle, MessageSquare, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  type: "order" | "system" | "support";
  title: string;
  message: string;
  time: string;
  unread: boolean;
  link?: string;
}

interface RestaurantNotificationDropdownProps {
  notifications?: NotificationItem[];
  unreadCount?: number;
  onNotificationClick?: (notificationId: string) => void;
  className?: string;
}

export function RestaurantNotificationDropdown({
  notifications = [],
  unreadCount = 0,
  onNotificationClick,
  className
}: RestaurantNotificationDropdownProps) {
  
  // Group notifications by type
  const orderNotifications = notifications.filter(n => n.type === "order");
  const systemNotifications = notifications.filter(n => n.type === "system");
  const supportNotifications = notifications.filter(n => n.type === "support");

  const getNotificationIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "order":
        return <Package className="h-4 w-4 text-blue-500" />;
      case "system":
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case "support":
        return <MessageSquare className="h-4 w-4 text-purple-500" />;
    }
  };

  const handleNotificationClick = (notification: NotificationItem) => {
    onNotificationClick?.(notification.id);
    // Navigate to link if provided
    if (notification.link) {
      window.location.href = notification.link;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative hover-elevate active-elevate-2", className)}
          aria-label="Restaurant notifications"
          data-testid="restaurant-notification-icon"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-0.5 -right-0.5 h-4 w-4 p-0 flex items-center justify-center text-[10px] rounded-full"
              aria-label={`${unreadCount} unread notifications`}
              data-testid="restaurant-notification-badge"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="end" 
        className="w-[360px] p-0"
        data-testid="restaurant-notification-dropdown"
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {unreadCount} new
            </Badge>
          )}
        </div>

        {/* Notification List */}
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            // No notifications state
            <div className="p-8 text-center">
              <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-20" />
              <p className="text-sm font-medium mb-1">No notifications yet</p>
              <p className="text-xs text-muted-foreground">
                You'll see order alerts, system updates, and support messages here
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {/* Order Alerts Section */}
              {orderNotifications.length > 0 && (
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-3.5 w-3.5 text-blue-500" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Order Alerts
                    </p>
                  </div>
                  <div className="space-y-2">
                    {orderNotifications.map((notification) => (
                      <button
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={cn(
                          "w-full text-left p-2 rounded-md hover-elevate active-elevate-2 transition-colors",
                          notification.unread && "bg-accent/30"
                        )}
                        data-testid={`notification-item-${notification.id}`}
                      >
                        <div className="flex items-start gap-2">
                          {getNotificationIcon(notification.type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium mb-0.5 truncate">
                              {notification.title}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {notification.time}
                            </p>
                          </div>
                          {notification.unread && (
                            <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* System Updates Section */}
              {systemNotifications.length > 0 && (
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      System Updates
                    </p>
                  </div>
                  <div className="space-y-2">
                    {systemNotifications.map((notification) => (
                      <button
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={cn(
                          "w-full text-left p-2 rounded-md hover-elevate active-elevate-2 transition-colors",
                          notification.unread && "bg-accent/30"
                        )}
                        data-testid={`notification-item-${notification.id}`}
                      >
                        <div className="flex items-start gap-2">
                          {getNotificationIcon(notification.type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium mb-0.5 truncate">
                              {notification.title}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {notification.time}
                            </p>
                          </div>
                          {notification.unread && (
                            <div className="h-2 w-2 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Support/Issues Section */}
              {supportNotifications.length > 0 && (
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-3.5 w-3.5 text-purple-500" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Support & Issues
                    </p>
                  </div>
                  <div className="space-y-2">
                    {supportNotifications.map((notification) => (
                      <button
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={cn(
                          "w-full text-left p-2 rounded-md hover-elevate active-elevate-2 transition-colors",
                          notification.unread && "bg-accent/30"
                        )}
                        data-testid={`notification-item-${notification.id}`}
                      >
                        <div className="flex items-start gap-2">
                          {getNotificationIcon(notification.type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium mb-0.5 truncate">
                              {notification.title}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {notification.time}
                            </p>
                          </div>
                          {notification.unread && (
                            <div className="h-2 w-2 rounded-full bg-purple-500 shrink-0 mt-1.5" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Placeholder sections when no notifications */}
              {orderNotifications.length === 0 && (
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Order Alerts
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">
                    No new order alerts
                  </p>
                </div>
              )}

              {systemNotifications.length === 0 && (
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      System Updates
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">
                    No system notifications
                  </p>
                </div>
              )}

              {supportNotifications.length === 0 && (
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Support & Issues
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">
                    No support updates
                  </p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Footer with Quick Links */}
        <Separator />
        <div className="p-3 space-y-1">
          <Link href="/restaurant/orders/live">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between hover-elevate active-elevate-2"
              data-testid="notification-link-orders"
            >
              <span className="text-xs">View all orders</span>
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
          <Link href="/restaurant/support/help">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between hover-elevate active-elevate-2"
              data-testid="notification-link-support"
            >
              <span className="text-xs">Help Center</span>
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
