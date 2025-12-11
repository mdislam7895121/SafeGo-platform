import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Bell,
  ShoppingCart,
  Package,
  Wallet,
  CheckCircle,
  AlertCircle,
  Info,
  Check,
} from "lucide-react";
import { format } from "date-fns";
import { bn } from "date-fns/locale";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsData {
  notifications: Notification[];
  unreadCount: number;
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "shop_order_new":
    case "shop_order_placed":
      return <ShoppingCart className="h-5 w-5 text-blue-500" />;
    case "shop_order_completed":
    case "shop_order_delivered":
      return <Package className="h-5 w-5 text-green-500" />;
    case "shop_payout_approved":
    case "shop_payout_completed":
      return <Wallet className="h-5 w-5 text-emerald-500" />;
    case "shop_payout_rejected":
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    case "shop_approved":
    case "shop_verified":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    default:
      return <Info className="h-5 w-5 text-blue-500" />;
  }
};

const getNotificationBg = (type: string, isRead: boolean) => {
  if (isRead) return "bg-muted/30";
  
  switch (type) {
    case "shop_order_new":
    case "shop_order_placed":
      return "bg-blue-50 dark:bg-blue-950/30";
    case "shop_order_completed":
    case "shop_order_delivered":
      return "bg-green-50 dark:bg-green-950/30";
    case "shop_payout_approved":
    case "shop_payout_completed":
      return "bg-emerald-50 dark:bg-emerald-950/30";
    case "shop_payout_rejected":
      return "bg-red-50 dark:bg-red-950/30";
    default:
      return "bg-muted/50";
  }
};

export default function ShopPartnerNotifications() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<NotificationsData>({
    queryKey: ["/api/shop-partner/notifications"],
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest(`/api/shop-partner/notifications/${notificationId}/read`, {
        method: "PATCH",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop-partner/notifications"] });
    },
    onError: () => {
      toast({
        title: "ত্রুটি",
        description: "নোটিফিকেশন আপডেট করা যায়নি।",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-40" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">নোটিফিকেশন</h1>
          {(data?.unreadCount || 0) > 0 && (
            <Badge variant="destructive" className="px-2 py-0.5" data-testid="badge-unread-count">
              {data?.unreadCount} নতুন
            </Badge>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5" />
            সকল নোটিফিকেশন
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data?.notifications && data.notifications.length > 0 ? (
            <div className="space-y-3">
              {data.notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg transition-colors ${getNotificationBg(notification.type, notification.isRead)}`}
                  data-testid={`notification-item-${notification.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-background flex items-center justify-center shrink-0">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={`font-medium ${!notification.isRead ? "text-foreground" : "text-muted-foreground"}`}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {notification.body}
                          </p>
                        </div>
                        {!notification.isRead && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            onClick={() => markAsReadMutation.mutate(notification.id)}
                            disabled={markAsReadMutation.isPending}
                            data-testid={`button-mark-read-${notification.id}`}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(notification.createdAt), "dd MMM yyyy, hh:mm a", { locale: bn })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">কোন নোটিফিকেশন নেই।</p>
              <p className="text-sm text-muted-foreground mt-1">
                নতুন অর্ডার বা আপডেট আসলে এখানে দেখাবে।
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
