import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Save, Info, AlertCircle, MapPin, Package } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface OperationalSettings {
  id: string;
  restaurantId: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  avgPreparationTime: number | null;
  minOrderAmount: number | null;
  maxOrderAmount: number | null;
  autoAcceptOrders: boolean;
  orderThrottleLimit: number | null;
}

interface ProfileData {
  ownerRole?: string;
  canViewAnalytics?: boolean;
}

export default function DeliverySettingsPage() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<OperationalSettings>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch profile to determine RBAC
  const { data: homeData } = useQuery<{ profile: ProfileData }>({
    queryKey: ["/api/restaurant/home"],
  });

  const userRole = homeData?.profile?.ownerRole || "OWNER";
  const canEdit = userRole === "OWNER";
  const canView = userRole === "OWNER" || homeData?.profile?.canViewAnalytics;

  // Fetch operational settings
  const { data, isLoading } = useQuery<{ settings: OperationalSettings }>({
    queryKey: ["/api/restaurant/settings/operational"],
    enabled: canView,
  });

  const settings = data?.settings;

  // Initialize form data when settings load
  useEffect(() => {
    if (settings) {
      setFormData({
        deliveryEnabled: settings.deliveryEnabled ?? true,
        pickupEnabled: settings.pickupEnabled ?? true,
        avgPreparationTime: settings.avgPreparationTime,
        minOrderAmount: settings.minOrderAmount,
        maxOrderAmount: settings.maxOrderAmount,
        autoAcceptOrders: settings.autoAcceptOrders ?? false,
        orderThrottleLimit: settings.orderThrottleLimit,
      });
      setHasChanges(false);
    }
  }, [settings]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updateData: Partial<OperationalSettings>) => {
      const res = await apiRequest("PATCH", "/api/restaurant/settings/operational", updateData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/settings/operational"] });
      setHasChanges(false);
      toast({
        title: "Success",
        description: "Delivery & pickup settings updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  const handleChange = (field: keyof OperationalSettings, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleCancel = () => {
    if (settings) {
      setFormData({
        deliveryEnabled: settings.deliveryEnabled ?? true,
        pickupEnabled: settings.pickupEnabled ?? true,
        avgPreparationTime: settings.avgPreparationTime,
        minOrderAmount: settings.minOrderAmount,
        maxOrderAmount: settings.maxOrderAmount,
        autoAcceptOrders: settings.autoAcceptOrders ?? false,
        orderThrottleLimit: settings.orderThrottleLimit,
      });
    }
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-accent rounded w-64"></div>
          <div className="h-32 bg-accent rounded"></div>
        </div>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="p-8">
        <Alert variant="destructive" data-testid="alert-no-permission">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to view operational settings.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <MapPin className="h-8 w-8" />
          Delivery & Pickup Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Configure delivery and pickup options for your restaurant
        </p>
      </div>

      {!canEdit && (
        <Alert data-testid="alert-view-only">
          <Info className="h-4 w-4" />
          <AlertDescription>
            You have read-only access to these settings. Only the restaurant owner can make changes.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Service Options
          </CardTitle>
          <CardDescription>
            Enable or disable delivery and pickup services
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="delivery-enabled" className="text-base font-medium">
                Delivery Service
              </Label>
              <p className="text-sm text-muted-foreground">
                Accept delivery orders from customers
              </p>
            </div>
            <Switch
              id="delivery-enabled"
              checked={formData.deliveryEnabled ?? true}
              onCheckedChange={(checked) => handleChange("deliveryEnabled", checked)}
              disabled={!canEdit}
              data-testid="switch-delivery-enabled"
            />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="pickup-enabled" className="text-base font-medium">
                Pickup Service
              </Label>
              <p className="text-sm text-muted-foreground">
                Accept pickup orders from customers
              </p>
            </div>
            <Switch
              id="pickup-enabled"
              checked={formData.pickupEnabled ?? true}
              onCheckedChange={(checked) => handleChange("pickupEnabled", checked)}
              disabled={!canEdit}
              data-testid="switch-pickup-enabled"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Order Settings</CardTitle>
          <CardDescription>
            Configure preparation time and order limits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prep-time">Average Preparation Time (minutes)</Label>
              <Input
                id="prep-time"
                type="number"
                min="1"
                max="120"
                placeholder="e.g., 15"
                value={formData.avgPreparationTime || ""}
                onChange={(e) => handleChange("avgPreparationTime", e.target.value ? parseInt(e.target.value) : null)}
                disabled={!canEdit}
                data-testid="input-prep-time"
              />
              <p className="text-xs text-muted-foreground">
                Estimated time to prepare orders
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="throttle-limit">Order Throttle Limit</Label>
              <Input
                id="throttle-limit"
                type="number"
                min="1"
                max="100"
                placeholder="e.g., 10"
                value={formData.orderThrottleLimit || ""}
                onChange={(e) => handleChange("orderThrottleLimit", e.target.value ? parseInt(e.target.value) : null)}
                disabled={!canEdit}
                data-testid="input-throttle-limit"
              />
              <p className="text-xs text-muted-foreground">
                Maximum concurrent orders
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min-order">Minimum Order Amount ($)</Label>
              <Input
                id="min-order"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g., 10.00"
                value={formData.minOrderAmount || ""}
                onChange={(e) => handleChange("minOrderAmount", e.target.value ? parseFloat(e.target.value) : null)}
                disabled={!canEdit}
                data-testid="input-min-order"
              />
              <p className="text-xs text-muted-foreground">
                Minimum order value required
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-order">Maximum Order Amount ($)</Label>
              <Input
                id="max-order"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g., 500.00"
                value={formData.maxOrderAmount || ""}
                onChange={(e) => handleChange("maxOrderAmount", e.target.value ? parseFloat(e.target.value) : null)}
                disabled={!canEdit}
                data-testid="input-max-order"
              />
              <p className="text-xs text-muted-foreground">
                Maximum order value allowed
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automation</CardTitle>
          <CardDescription>
            Configure automatic order acceptance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="auto-accept" className="text-base font-medium">
                Auto-Accept Orders
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically accept incoming orders without manual review
              </p>
            </div>
            <Switch
              id="auto-accept"
              checked={formData.autoAcceptOrders ?? false}
              onCheckedChange={(checked) => handleChange("autoAcceptOrders", checked)}
              disabled={!canEdit}
              data-testid="switch-auto-accept"
            />
          </div>
        </CardContent>
      </Card>

      {canEdit && hasChanges && (
        <div className="flex items-center justify-end gap-4">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={updateMutation.isPending}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="gap-2"
            data-testid="button-save"
          >
            <Save className="h-4 w-4" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      )}
    </div>
  );
}
