import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Bell, 
  Send, 
  Users, 
  MapPin,
  History,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface NotificationHistory {
  id: string;
  title: string;
  sentAt: string;
  delivered: number;
  failed: number;
  targetType: string;
}

export default function PushNotifications() {
  const [notification, setNotification] = useState({
    title: "",
    body: "",
    targetType: "all",
    geoTargeting: "",
    roleTargeting: [] as string[],
  });
  const { toast } = useToast();

  const { data: history, isLoading } = useQuery<{ notifications: NotificationHistory[]; total: number }>({
    queryKey: ["/api/admin/phase3a/notifications/history"],
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/admin/phase3a/notifications/send", {
        method: "POST",
        body: JSON.stringify(notification),
      });
    },
    onSuccess: () => {
      toast({ title: "Notification Sent", description: "Push notification has been queued for delivery." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phase3a/notifications/history"] });
      setNotification({ title: "", body: "", targetType: "all", geoTargeting: "", roleTargeting: [] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send notification.", variant: "destructive" });
    },
  });

  const toggleRole = (role: string) => {
    setNotification(prev => ({
      ...prev,
      roleTargeting: prev.roleTargeting.includes(role)
        ? prev.roleTargeting.filter(r => r !== role)
        : [...prev.roleTargeting, role]
    }));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Admin Push Notification Tool</h1>
          <p className="text-muted-foreground">Send targeted push notifications to users</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Compose Notification
            </CardTitle>
            <CardDescription>Create and send push notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                placeholder="Notification title"
                value={notification.title}
                onChange={(e) => setNotification({ ...notification, title: e.target.value })}
                maxLength={50}
                data-testid="input-title"
              />
              <p className="text-xs text-muted-foreground">{notification.title.length}/50 characters</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Message</label>
              <Textarea
                placeholder="Notification message"
                value={notification.body}
                onChange={(e) => setNotification({ ...notification, body: e.target.value })}
                maxLength={200}
                rows={3}
                data-testid="input-body"
              />
              <p className="text-xs text-muted-foreground">{notification.body.length}/200 characters</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Target Audience</label>
              <Select
                value={notification.targetType}
                onValueChange={(v) => setNotification({ ...notification, targetType: v })}
              >
                <SelectTrigger data-testid="select-target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="customers">Customers Only</SelectItem>
                  <SelectItem value="drivers">Drivers Only</SelectItem>
                  <SelectItem value="restaurants">Restaurants Only</SelectItem>
                  <SelectItem value="custom">Custom Targeting</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {notification.targetType === "custom" && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Geo Targeting (City/Region)</label>
                  <Input
                    placeholder="e.g., New York, Los Angeles"
                    value={notification.geoTargeting}
                    onChange={(e) => setNotification({ ...notification, geoTargeting: e.target.value })}
                    data-testid="input-geo"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Role Targeting</label>
                  <div className="grid grid-cols-2 gap-2">
                    {["CUSTOMER", "DRIVER", "RESTAURANT", "SHOP_PARTNER", "TICKET_OPERATOR"].map((role) => (
                      <div key={role} className="flex items-center gap-2">
                        <Checkbox
                          id={role}
                          checked={notification.roleTargeting.includes(role)}
                          onCheckedChange={() => toggleRole(role)}
                        />
                        <label htmlFor={role} className="text-sm">{role}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Button
              className="w-full"
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending || !notification.title || !notification.body}
              data-testid="button-send"
            >
              {sendMutation.isPending ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Notification
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Recent Notifications
            </CardTitle>
            <CardDescription>History of sent notifications</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {history?.notifications.map((notif) => (
                    <Card key={notif.id} className="hover-elevate" data-testid={`notif-${notif.id}`}>
                      <CardContent className="pt-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{notif.title}</span>
                            <Badge variant="outline" className="capitalize">{notif.targetType}</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(notif.sentAt), "MMM dd, HH:mm")}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-3 w-3" />
                              {notif.delivered} delivered
                            </span>
                            <span className="flex items-center gap-1 text-red-600">
                              <XCircle className="h-3 w-3" />
                              {notif.failed} failed
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {history?.notifications.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No notifications sent yet
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notification Statistics</CardTitle>
          <CardDescription>Overview of notification delivery performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 border rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Total Sent</p>
              <p className="text-2xl font-bold">{history?.total || 0}</p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Total Delivered</p>
              <p className="text-2xl font-bold text-green-600">
                {history?.notifications.reduce((sum, n) => sum + n.delivered, 0) || 0}
              </p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Total Failed</p>
              <p className="text-2xl font-bold text-red-600">
                {history?.notifications.reduce((sum, n) => sum + n.failed, 0) || 0}
              </p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Delivery Rate</p>
              <p className="text-2xl font-bold">
                {history?.notifications.length ? (
                  (history.notifications.reduce((sum, n) => sum + n.delivered, 0) /
                    (history.notifications.reduce((sum, n) => sum + n.delivered + n.failed, 0) || 1) * 100
                  ).toFixed(1)
                ) : 0}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
