import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Bell, 
  BellOff, 
  Mail, 
  MessageSquare, 
  Smartphone,
  Moon,
  Car,
  UtensilsCrossed,
  Package,
  Megaphone,
  DollarSign,
  Shield,
  Clock,
  Save,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface NotificationPreferences {
  pushEnabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
  rideUpdatesEnabled: boolean;
  foodUpdatesEnabled: boolean;
  parcelUpdatesEnabled: boolean;
  promotionsEnabled: boolean;
  earningsEnabled: boolean;
  safetyAlertsEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  minIntervalMinutes: number;
}

interface SmartNotificationPreferencesProps {
  userType: "customer" | "driver";
}

const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, "0");
  return { value: `${hour}:00`, label: `${hour}:00` };
});

export function SmartNotificationPreferences({ userType }: SmartNotificationPreferencesProps) {
  const { toast } = useToast();
  const [hasChanges, setHasChanges] = useState(false);
  const [localPrefs, setLocalPrefs] = useState<Partial<NotificationPreferences>>({});

  const { data: preferences, isLoading } = useQuery<NotificationPreferences>({
    queryKey: ["/api/phase5/notifications/preferences"],
    staleTime: 30000,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<NotificationPreferences>) => {
      return apiRequest("/api/phase5/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/phase5/notifications/preferences"] });
      setHasChanges(false);
      setLocalPrefs({});
      toast({ title: "Preferences saved", description: "Your notification settings have been updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save preferences",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const currentPrefs = { ...preferences, ...localPrefs };

  const handleChange = (key: keyof NotificationPreferences, value: any) => {
    setLocalPrefs(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMutation.mutate(localPrefs);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Notification Channels
          </CardTitle>
          <CardDescription>Choose how you want to receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="push-enabled">Push Notifications</Label>
                <p className="text-sm text-muted-foreground">Instant alerts on your device</p>
              </div>
            </div>
            <Switch
              id="push-enabled"
              checked={currentPrefs.pushEnabled ?? true}
              onCheckedChange={(checked) => handleChange("pushEnabled", checked)}
              data-testid="switch-push-notifications"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="sms-enabled">SMS Notifications</Label>
                <p className="text-sm text-muted-foreground">Text messages for important updates</p>
              </div>
            </div>
            <Switch
              id="sms-enabled"
              checked={currentPrefs.smsEnabled ?? false}
              onCheckedChange={(checked) => handleChange("smsEnabled", checked)}
              data-testid="switch-sms-notifications"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="email-enabled">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">Summaries and receipts by email</p>
              </div>
            </div>
            <Switch
              id="email-enabled"
              checked={currentPrefs.emailEnabled ?? true}
              onCheckedChange={(checked) => handleChange("emailEnabled", checked)}
              data-testid="switch-email-notifications"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Categories
          </CardTitle>
          <CardDescription>Select which types of notifications you want to receive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Car className="h-5 w-5 text-blue-500" />
              <div>
                <Label htmlFor="ride-updates">Ride Updates</Label>
                <p className="text-sm text-muted-foreground">
                  {userType === "driver" ? "New ride requests and trip updates" : "Driver arrival and trip status"}
                </p>
              </div>
            </div>
            <Switch
              id="ride-updates"
              checked={currentPrefs.rideUpdatesEnabled ?? true}
              onCheckedChange={(checked) => handleChange("rideUpdatesEnabled", checked)}
              data-testid="switch-ride-updates"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UtensilsCrossed className="h-5 w-5 text-orange-500" />
              <div>
                <Label htmlFor="food-updates">Food Delivery Updates</Label>
                <p className="text-sm text-muted-foreground">
                  {userType === "driver" ? "New delivery requests and restaurant alerts" : "Order preparation and delivery status"}
                </p>
              </div>
            </div>
            <Switch
              id="food-updates"
              checked={currentPrefs.foodUpdatesEnabled ?? true}
              onCheckedChange={(checked) => handleChange("foodUpdatesEnabled", checked)}
              data-testid="switch-food-updates"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-purple-500" />
              <div>
                <Label htmlFor="parcel-updates">Parcel Updates</Label>
                <p className="text-sm text-muted-foreground">
                  {userType === "driver" ? "New parcel pickup requests" : "Parcel delivery tracking"}
                </p>
              </div>
            </div>
            <Switch
              id="parcel-updates"
              checked={currentPrefs.parcelUpdatesEnabled ?? true}
              onCheckedChange={(checked) => handleChange("parcelUpdatesEnabled", checked)}
              data-testid="switch-parcel-updates"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Megaphone className="h-5 w-5 text-green-500" />
              <div>
                <Label htmlFor="promotions">Promotions & Offers</Label>
                <p className="text-sm text-muted-foreground">
                  {userType === "driver" ? "Bonus opportunities and surge alerts" : "Discounts and special deals"}
                </p>
              </div>
            </div>
            <Switch
              id="promotions"
              checked={currentPrefs.promotionsEnabled ?? true}
              onCheckedChange={(checked) => handleChange("promotionsEnabled", checked)}
              data-testid="switch-promotions"
            />
          </div>

          {userType === "driver" && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-emerald-500" />
                <div>
                  <Label htmlFor="earnings">Earnings Updates</Label>
                  <p className="text-sm text-muted-foreground">Daily and weekly earnings summaries</p>
                </div>
              </div>
              <Switch
                id="earnings"
                checked={currentPrefs.earningsEnabled ?? true}
                onCheckedChange={(checked) => handleChange("earningsEnabled", checked)}
                data-testid="switch-earnings"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-red-500" />
              <div>
                <Label htmlFor="safety-alerts">Safety Alerts</Label>
                <p className="text-sm text-muted-foreground">Critical safety notifications (always recommended)</p>
              </div>
            </div>
            <Switch
              id="safety-alerts"
              checked={currentPrefs.safetyAlertsEnabled ?? true}
              onCheckedChange={(checked) => handleChange("safetyAlertsEnabled", checked)}
              data-testid="switch-safety-alerts"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5" />
            Quiet Hours
          </CardTitle>
          <CardDescription>Pause non-urgent notifications during specific hours</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BellOff className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="quiet-hours">Enable Quiet Hours</Label>
                <p className="text-sm text-muted-foreground">Silence non-urgent notifications</p>
              </div>
            </div>
            <Switch
              id="quiet-hours"
              checked={currentPrefs.quietHoursEnabled ?? false}
              onCheckedChange={(checked) => handleChange("quietHoursEnabled", checked)}
              data-testid="switch-quiet-hours"
            />
          </div>

          {(currentPrefs.quietHoursEnabled ?? false) && (
            <div className="grid grid-cols-2 gap-4 pl-8">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Select
                  value={currentPrefs.quietHoursStart ?? "22:00"}
                  onValueChange={(value) => handleChange("quietHoursStart", value)}
                  data-testid="select-quiet-start"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select start time" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((time) => (
                      <SelectItem key={time.value} value={time.value}>
                        {time.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Select
                  value={currentPrefs.quietHoursEnd ?? "07:00"}
                  onValueChange={(value) => handleChange("quietHoursEnd", value)}
                  data-testid="select-quiet-end"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select end time" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((time) => (
                      <SelectItem key={time.value} value={time.value}>
                        {time.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="col-span-2 text-xs text-muted-foreground">
                Safety alerts will still be delivered during quiet hours
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Smart Throttling
          </CardTitle>
          <CardDescription>Control how often you receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Minimum interval between notifications</Label>
              <span className="text-sm font-medium">
                {currentPrefs.minIntervalMinutes ?? 5} min
              </span>
            </div>
            <Slider
              value={[currentPrefs.minIntervalMinutes ?? 5]}
              onValueChange={([value]) => handleChange("minIntervalMinutes", value)}
              min={0}
              max={60}
              step={5}
              className="w-full"
              data-testid="slider-min-interval"
            />
            <p className="text-xs text-muted-foreground">
              Set to 0 for instant notifications. Higher values reduce notification frequency.
            </p>
          </div>
        </CardContent>
      </Card>

      {hasChanges && (
        <div className="sticky bottom-4 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="shadow-lg"
            data-testid="button-save-preferences"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
