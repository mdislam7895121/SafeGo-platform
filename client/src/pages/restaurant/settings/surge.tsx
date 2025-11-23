import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Save, Info, AlertCircle, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SurgeSettings {
  id: string;
  restaurantId: string;
  surgeEnabled: boolean;
  surgeMultiplier: number | null;
  peakHoursStart: string | null;
  peakHoursEnd: string | null;
  weekendEnabled: boolean;
  weekendMultiplier: number | null;
}

interface ProfileData {
  ownerRole?: string;
  canViewAnalytics?: boolean;
}

export default function SurgePricingPage() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<SurgeSettings>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch profile to determine RBAC
  const { data: homeData } = useQuery<{ profile: ProfileData }>({
    queryKey: ["/api/restaurant/home"],
  });

  const userRole = homeData?.profile?.ownerRole || "OWNER";
  const canEdit = userRole === "OWNER";
  const canView = userRole === "OWNER" || homeData?.profile?.canViewAnalytics;

  // Fetch surge settings
  const { data, isLoading } = useQuery<{ settings: SurgeSettings }>({
    queryKey: ["/api/restaurant/settings/surge"],
    enabled: canView,
  });

  const settings = data?.settings;

  // Initialize form data when settings load
  useEffect(() => {
    if (settings) {
      setFormData({
        surgeEnabled: settings.surgeEnabled ?? false,
        surgeMultiplier: settings.surgeMultiplier,
        peakHoursStart: settings.peakHoursStart,
        peakHoursEnd: settings.peakHoursEnd,
        weekendEnabled: settings.weekendEnabled ?? false,
        weekendMultiplier: settings.weekendMultiplier,
      });
      setHasChanges(false);
    }
  }, [settings]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updateData: Partial<SurgeSettings>) => {
      const res = await apiRequest("PATCH", "/api/restaurant/settings/surge", updateData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/settings/surge"] });
      setHasChanges(false);
      toast({
        title: "Success",
        description: "Surge pricing settings updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update surge pricing settings",
        variant: "destructive",
      });
    },
  });

  const handleChange = (field: keyof SurgeSettings, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleCancel = () => {
    if (settings) {
      setFormData({
        surgeEnabled: settings.surgeEnabled ?? false,
        surgeMultiplier: settings.surgeMultiplier,
        peakHoursStart: settings.peakHoursStart,
        peakHoursEnd: settings.peakHoursEnd,
        weekendEnabled: settings.weekendEnabled ?? false,
        weekendMultiplier: settings.weekendMultiplier,
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
          <TrendingUp className="h-8 w-8" />
          Surge Pricing
        </h1>
        <p className="text-muted-foreground mt-2">
          Configure dynamic pricing during peak hours and weekends
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
          <CardTitle>Surge Pricing Controls</CardTitle>
          <CardDescription>
            Enable surge pricing to adjust prices during high-demand periods
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="surge-enabled" className="text-base font-medium">
                Enable Surge Pricing
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically increase prices during peak hours
              </p>
            </div>
            <Switch
              id="surge-enabled"
              checked={formData.surgeEnabled ?? false}
              onCheckedChange={(checked) => handleChange("surgeEnabled", checked)}
              disabled={!canEdit}
              data-testid="switch-surge-enabled"
            />
          </div>
        </CardContent>
      </Card>

      {formData.surgeEnabled && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Peak Hours Settings</CardTitle>
              <CardDescription>
                Define peak hours when surge pricing applies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="peak-start">Peak Hours Start</Label>
                  <input
                    id="peak-start"
                    type="time"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                    value={formData.peakHoursStart || ""}
                    onChange={(e) => handleChange("peakHoursStart", e.target.value || null)}
                    disabled={!canEdit}
                    data-testid="input-peak-start"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="peak-end">Peak Hours End</Label>
                  <input
                    id="peak-end"
                    type="time"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                    value={formData.peakHoursEnd || ""}
                    onChange={(e) => handleChange("peakHoursEnd", e.target.value || null)}
                    disabled={!canEdit}
                    data-testid="input-peak-end"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="surge-multiplier">Surge Multiplier (1.0 - 2.0)</Label>
                <Input
                  id="surge-multiplier"
                  type="number"
                  min="1.0"
                  max="2.0"
                  step="0.1"
                  placeholder="e.g., 1.5"
                  value={formData.surgeMultiplier || ""}
                  onChange={(e) => handleChange("surgeMultiplier", e.target.value ? parseFloat(e.target.value) : null)}
                  disabled={!canEdit}
                  data-testid="input-surge-multiplier"
                />
                <p className="text-xs text-muted-foreground">
                  Multiply base prices by this factor during peak hours (e.g., 1.5 = 50% increase)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Weekend Pricing</CardTitle>
              <CardDescription>
                Apply different pricing on weekends (Saturday & Sunday)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="weekend-enabled" className="text-base font-medium">
                    Weekend Surge Pricing
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Apply surge pricing on Saturdays and Sundays
                  </p>
                </div>
                <Switch
                  id="weekend-enabled"
                  checked={formData.weekendEnabled ?? false}
                  onCheckedChange={(checked) => handleChange("weekendEnabled", checked)}
                  disabled={!canEdit}
                  data-testid="switch-weekend-enabled"
                />
              </div>

              {formData.weekendEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="weekend-multiplier">Weekend Multiplier (1.0 - 2.0)</Label>
                  <Input
                    id="weekend-multiplier"
                    type="number"
                    min="1.0"
                    max="2.0"
                    step="0.1"
                    placeholder="e.g., 1.3"
                    value={formData.weekendMultiplier || ""}
                    onChange={(e) => handleChange("weekendMultiplier", e.target.value ? parseFloat(e.target.value) : null)}
                    disabled={!canEdit}
                    data-testid="input-weekend-multiplier"
                  />
                  <p className="text-xs text-muted-foreground">
                    Multiply base prices by this factor on weekends
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

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
