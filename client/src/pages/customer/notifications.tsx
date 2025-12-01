import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bell, CheckCircle, AlertCircle, Info, Clock, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function CustomerNotifications() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/customer/notifications"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const notifications = data?.notifications || [];

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "ride_update":
      case "food_update":
      case "parcel_update":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "kyc_update":
        return <AlertCircle className="h-5 w-5 text-blue-600" />;
      default:
        return <Info className="h-5 w-5 text-gray-600" />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/customer">
              <Button
                variant="ghost"
                size="icon"
                className="text-primary-foreground"
                data-testid="button-back"
              >
                <ArrowLeft className="h-6 w-6" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Notifications</h1>
          </div>
          <div className="flex items-center gap-2">
            {notifications.filter((n: any) => !n.isRead).length > 0 && (
              <Badge variant="secondary">
                {notifications.filter((n: any) => !n.isRead).length} new
              </Badge>
            )}
            <Link href="/customer/notification-settings">
              <Button
                variant="ghost"
                size="icon"
                className="text-primary-foreground hover:bg-primary-foreground/10"
                data-testid="button-notification-settings"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {notifications.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Bell className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No notifications yet</h3>
              <p className="text-muted-foreground text-sm">
                You'll see updates about your rides, orders, and account here
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {notifications.map((notification: any) => (
              <Card
                key={notification.id}
                className={`${!notification.isRead ? "border-primary/50 bg-primary/5" : ""}`}
                data-testid={`notification-${notification.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">{getNotificationIcon(notification.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-semibold">{notification.title}</h4>
                        {!notification.isRead && (
                          <Badge variant="default" className="flex-shrink-0">
                            New
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{notification.body}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(notification.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
