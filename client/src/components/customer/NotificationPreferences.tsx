import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Bell,
  BellOff,
  Clock,
  MapPin,
  Package,
  Car,
  UtensilsCrossed,
  DollarSign,
  MessageCircle,
  Shield,
  Megaphone,
  Moon,
  Sun,
  Volume2,
  Vibrate,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface NotificationChannel {
  id: string;
  name: string;
  description: string;
  icon: any;
  enabled: boolean;
  category: "trip" | "promo" | "safety" | "account";
}

interface NotificationPreferences {
  channels: {
    push: boolean;
    email: boolean;
    sms: boolean;
  };
  categories: {
    tripUpdates: boolean;
    orderStatus: boolean;
    promotions: boolean;
    safetyAlerts: boolean;
    accountUpdates: boolean;
    driverMessages: boolean;
  };
  quietHours: {
    enabled: boolean;
    startHour: number;
    endHour: number;
  };
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

const defaultPreferences: NotificationPreferences = {
  channels: {
    push: true,
    email: true,
    sms: false,
  },
  categories: {
    tripUpdates: true,
    orderStatus: true,
    promotions: true,
    safetyAlerts: true,
    accountUpdates: true,
    driverMessages: true,
  },
  quietHours: {
    enabled: false,
    startHour: 22,
    endHour: 7,
  },
  soundEnabled: true,
  vibrationEnabled: true,
};

const NOTIFICATION_CATEGORIES: NotificationChannel[] = [
  {
    id: "tripUpdates",
    name: "Trip Updates",
    description: "Driver arrival, pickup, and dropoff notifications",
    icon: Car,
    enabled: true,
    category: "trip",
  },
  {
    id: "orderStatus",
    name: "Order Status",
    description: "Food order preparation and delivery updates",
    icon: UtensilsCrossed,
    enabled: true,
    category: "trip",
  },
  {
    id: "driverMessages",
    name: "Driver Messages",
    description: "Chat messages from your driver",
    icon: MessageCircle,
    enabled: true,
    category: "trip",
  },
  {
    id: "safetyAlerts",
    name: "Safety Alerts",
    description: "Emergency and safety-related notifications",
    icon: Shield,
    enabled: true,
    category: "safety",
  },
  {
    id: "promotions",
    name: "Promotions & Offers",
    description: "Discounts, rewards, and special offers",
    icon: Megaphone,
    enabled: true,
    category: "promo",
  },
  {
    id: "accountUpdates",
    name: "Account Updates",
    description: "Payment confirmations and account changes",
    icon: DollarSign,
    enabled: true,
    category: "account",
  },
];

function formatHour(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:00 ${period}`;
}

export function NotificationPreferences() {
  const { toast } = useToast();
  
  const { data, isLoading } = useQuery<{ preferences: NotificationPreferences }>({
    queryKey: ["/api/phase5/notifications/preferences"],
  });

  const preferences = data?.preferences || defaultPreferences;

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      return apiRequest("/api/phase5/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/phase5/notifications/preferences"] });
      toast({ title: "Preferences saved" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Failed to save preferences" });
    },
  });

  const handleChannelToggle = useCallback((channel: keyof NotificationPreferences["channels"]) => {
    updateMutation.mutate({
      channels: {
        ...preferences.channels,
        [channel]: !preferences.channels[channel],
      },
    });
  }, [preferences.channels, updateMutation]);

  const handleCategoryToggle = useCallback((category: string) => {
    updateMutation.mutate({
      categories: {
        ...preferences.categories,
        [category]: !preferences.categories[category as keyof NotificationPreferences["categories"]],
      },
    });
  }, [preferences.categories, updateMutation]);

  const handleQuietHoursToggle = useCallback(() => {
    updateMutation.mutate({
      quietHours: {
        ...preferences.quietHours,
        enabled: !preferences.quietHours.enabled,
      },
    });
  }, [preferences.quietHours, updateMutation]);

  const handleQuietHoursChange = useCallback((values: number[]) => {
    updateMutation.mutate({
      quietHours: {
        ...preferences.quietHours,
        startHour: values[0],
        endHour: values[1],
      },
    });
  }, [preferences.quietHours, updateMutation]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="notification-preferences">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Channels
          </CardTitle>
          <CardDescription>
            Choose how you want to receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Bell className="h-4 w-4 text-primary" />
              </div>
              <div>
                <Label htmlFor="push-notifications">Push Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive alerts on your device
                </p>
              </div>
            </div>
            <Switch
              id="push-notifications"
              checked={preferences.channels.push}
              onCheckedChange={() => handleChannelToggle("push")}
              data-testid="switch-push"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                <MessageCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <Label htmlFor="email-notifications">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive updates via email
                </p>
              </div>
            </div>
            <Switch
              id="email-notifications"
              checked={preferences.channels.email}
              onCheckedChange={() => handleChannelToggle("email")}
              data-testid="switch-email"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                <MessageCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <Label htmlFor="sms-notifications">SMS Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive text messages for important updates
                </p>
              </div>
            </div>
            <Switch
              id="sms-notifications"
              checked={preferences.channels.sms}
              onCheckedChange={() => handleChannelToggle("sms")}
              data-testid="switch-sms"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Types</CardTitle>
          <CardDescription>
            Select which notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {NOTIFICATION_CATEGORIES.map((category) => {
            const Icon = category.icon;
            const isEnabled = preferences.categories[category.id as keyof NotificationPreferences["categories"]];
            
            return (
              <div key={category.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    category.category === "safety" && "bg-red-100 dark:bg-red-900/20",
                    category.category === "trip" && "bg-blue-100 dark:bg-blue-900/20",
                    category.category === "promo" && "bg-yellow-100 dark:bg-yellow-900/20",
                    category.category === "account" && "bg-green-100 dark:bg-green-900/20"
                  )}>
                    <Icon className={cn(
                      "h-4 w-4",
                      category.category === "safety" && "text-red-600 dark:text-red-400",
                      category.category === "trip" && "text-blue-600 dark:text-blue-400",
                      category.category === "promo" && "text-yellow-600 dark:text-yellow-400",
                      category.category === "account" && "text-green-600 dark:text-green-400"
                    )} />
                  </div>
                  <div>
                    <Label htmlFor={`category-${category.id}`}>{category.name}</Label>
                    <p className="text-sm text-muted-foreground">
                      {category.description}
                    </p>
                  </div>
                </div>
                <Switch
                  id={`category-${category.id}`}
                  checked={isEnabled}
                  onCheckedChange={() => handleCategoryToggle(category.id)}
                  disabled={category.category === "safety"}
                  data-testid={`switch-category-${category.id}`}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5" />
            Quiet Hours
          </CardTitle>
          <CardDescription>
            Pause notifications during specific hours
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="quiet-hours">Enable Quiet Hours</Label>
              <p className="text-sm text-muted-foreground">
                Silence non-urgent notifications
              </p>
            </div>
            <Switch
              id="quiet-hours"
              checked={preferences.quietHours.enabled}
              onCheckedChange={handleQuietHoursToggle}
              data-testid="switch-quiet-hours"
            />
          </div>

          {preferences.quietHours.enabled && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Moon className="h-4 w-4" />
                  {formatHour(preferences.quietHours.startHour)}
                </span>
                <span className="flex items-center gap-2">
                  <Sun className="h-4 w-4" />
                  {formatHour(preferences.quietHours.endHour)}
                </span>
              </div>
              <Slider
                value={[preferences.quietHours.startHour, preferences.quietHours.endHour]}
                min={0}
                max={23}
                step={1}
                onValueChange={handleQuietHoursChange}
                className="w-full"
                data-testid="slider-quiet-hours"
              />
              <p className="text-xs text-muted-foreground text-center">
                Safety alerts will still be delivered during quiet hours
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sound & Vibration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="sound">Notification Sounds</Label>
            </div>
            <Switch
              id="sound"
              checked={preferences.soundEnabled}
              onCheckedChange={() => updateMutation.mutate({ soundEnabled: !preferences.soundEnabled })}
              data-testid="switch-sound"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Vibrate className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="vibration">Vibration</Label>
            </div>
            <Switch
              id="vibration"
              checked={preferences.vibrationEnabled}
              onCheckedChange={() => updateMutation.mutate({ vibrationEnabled: !preferences.vibrationEnabled })}
              data-testid="switch-vibration"
            />
          </div>
        </CardContent>
      </Card>

      {updateMutation.isPending && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving...
        </div>
      )}
    </div>
  );
}

export default NotificationPreferences;
