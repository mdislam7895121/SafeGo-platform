import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Clock,
  MapPin,
  TrendingUp,
  Settings as SettingsIcon,
  ShieldAlert,
  History,
  AlertCircle,
  CheckCircle,
  XCircle,
  Store,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

interface RestaurantHours {
  id: string;
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
  hasSecondShift: boolean;
  secondOpenTime: string | null;
  secondCloseTime: string | null;
}

interface OperationalSettings {
  id: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  avgPreparationMinutes: number | null;
  autoAcceptOrders: boolean;
  minOrderAmount: number | null;
  maxConcurrentOrders: number | null;
  temporarilyClosed: boolean;
  temporaryCloseReason: string | null;
}

interface DeliveryZone {
  id: string;
  zoneName: string;
  radiusKm: number | null;
  baseFee: number | null;
  feePerKm: number | null;
  estimatedMinutes: number | null;
}

interface SurgeSettings {
  id: string;
  surgeEnabled: boolean;
  surgeMultiplier: number | null;
  peakHoursStart: string | null;
  peakHoursEnd: string | null;
  weekendEnabled: boolean;
  weekendMultiplier: number | null;
}

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  changes: any;
  performedBy: string;
  performedAt: Date;
}

interface SettingsData {
  restaurant: {
    id: string;
    restaurantName: string;
    isVerified: boolean;
  };
  hours: RestaurantHours[];
  operational: OperationalSettings;
  zones: DeliveryZone[];
  surge: SurgeSettings;
  auditLogs: AuditLog[];
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function AdminRestaurantSettings() {
  const [, params] = useRoute("/admin/restaurants/:id/settings");
  const restaurantId = params?.id;
  const { toast } = useToast();
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideType, setOverrideType] = useState<"open" | "close">("close");
  const [overrideReason, setOverrideReason] = useState("");

  // Fetch all settings
  const { data, isLoading } = useQuery<SettingsData>({
    queryKey: [`/api/admin/restaurants/${restaurantId}/settings`],
    enabled: !!restaurantId,
  });

  // Override mutation
  const overrideMutation = useMutation({
    mutationFn: async ({ action, reason }: { action: string; reason: string }) => {
      return await apiRequest(`/api/admin/restaurants/${restaurantId}/settings/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/restaurants/${restaurantId}/settings`] });
      setOverrideDialogOpen(false);
      setOverrideReason("");
      toast({
        title: "Success",
        description: "Restaurant override applied successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to apply override",
        variant: "destructive",
      });
    },
  });

  const handleOverride = () => {
    if (!overrideReason.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide a reason for the override",
        variant: "destructive",
      });
      return;
    }
    overrideMutation.mutate({
      action: overrideType === "close" ? "FORCE_CLOSE" : "FORCE_OPEN",
      reason: overrideReason,
    });
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

  if (!data) {
    return (
      <div className="p-8">
        <Alert variant="destructive" data-testid="alert-not-found">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Restaurant settings not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  const { restaurant, hours, operational, zones, surge, auditLogs } = data;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <SettingsIcon className="h-8 w-8" />
            Operational Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            {restaurant.restaurantName}
            {restaurant.isVerified && (
              <Badge className="ml-2" variant="default">
                <CheckCircle className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            )}
          </p>
        </div>
        <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2" data-testid="button-override">
              <ShieldAlert className="h-4 w-4" />
              Override Controls
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Restaurant Override</DialogTitle>
              <DialogDescription>
                Force open or close this restaurant temporarily
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="override-type" className="text-base font-medium">
                    Override Action
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {overrideType === "close" ? "Force close restaurant" : "Force open restaurant"}
                  </p>
                </div>
                <Switch
                  id="override-type"
                  checked={overrideType === "open"}
                  onCheckedChange={(checked) => setOverrideType(checked ? "open" : "close")}
                  data-testid="switch-override-type"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason *</Label>
                <textarea
                  id="reason"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                  placeholder="Provide a reason for this override..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  data-testid="input-reason"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setOverrideDialogOpen(false)}
                disabled={overrideMutation.isPending}
                data-testid="button-cancel-override"
              >
                Cancel
              </Button>
              <Button
                onClick={handleOverride}
                disabled={overrideMutation.isPending}
                variant={overrideType === "close" ? "destructive" : "default"}
                data-testid="button-confirm-override"
              >
                {overrideMutation.isPending ? "Applying..." : "Apply Override"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Status Alert */}
      {operational.temporarilyClosed && (
        <Alert variant="destructive" data-testid="alert-temporarily-closed">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            Restaurant is temporarily closed
            {operational.temporaryCloseReason && `: ${operational.temporaryCloseReason}`}
          </AlertDescription>
        </Alert>
      )}

      {/* Settings Tabs */}
      <Tabs defaultValue="operational" className="space-y-4">
        <TabsList>
          <TabsTrigger value="operational" data-testid="tab-operational">
            <Store className="h-4 w-4 mr-2" />
            Operational
          </TabsTrigger>
          <TabsTrigger value="hours" data-testid="tab-hours">
            <Clock className="h-4 w-4 mr-2" />
            Hours
          </TabsTrigger>
          <TabsTrigger value="zones" data-testid="tab-zones">
            <MapPin className="h-4 w-4 mr-2" />
            Delivery Zones
          </TabsTrigger>
          <TabsTrigger value="surge" data-testid="tab-surge">
            <TrendingUp className="h-4 w-4 mr-2" />
            Surge Pricing
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <History className="h-4 w-4 mr-2" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* Operational Settings Tab */}
        <TabsContent value="operational" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Operational Settings</CardTitle>
              <CardDescription>Current operational configuration (read-only)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">Delivery Enabled</span>
                  <Badge variant={operational.deliveryEnabled ? "default" : "secondary"}>
                    {operational.deliveryEnabled ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">Pickup Enabled</span>
                  <Badge variant={operational.pickupEnabled ? "default" : "secondary"}>
                    {operational.pickupEnabled ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">Auto Accept Orders</span>
                  <Badge variant={operational.autoAcceptOrders ? "default" : "secondary"}>
                    {operational.autoAcceptOrders ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">Prep Time</span>
                  <span>{operational.avgPreparationMinutes || "N/A"} min</span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">Min Order Amount</span>
                  <span>${operational.minOrderAmount?.toFixed(2) || "N/A"}</span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">Max Concurrent Orders</span>
                  <span>{operational.maxConcurrentOrders || "Unlimited"}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Business Hours Tab */}
        <TabsContent value="hours" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Business Hours</CardTitle>
              <CardDescription>Weekly operating schedule (read-only)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {DAYS.map((day, index) => {
                  const dayHours = hours.find((h) => h.dayOfWeek === index);
                  return (
                    <div
                      key={day}
                      className="flex items-center justify-between p-3 border rounded-lg"
                      data-testid={`day-${index}`}
                    >
                      <span className="font-medium w-24">{day}</span>
                      {dayHours?.isOpen ? (
                        <div className="flex-1 text-sm">
                          <span className="text-muted-foreground">
                            {dayHours.openTime} - {dayHours.closeTime}
                          </span>
                          {dayHours.hasSecondShift && dayHours.secondOpenTime && dayHours.secondCloseTime && (
                            <span className="ml-4 text-muted-foreground">
                              | {dayHours.secondOpenTime} - {dayHours.secondCloseTime}
                            </span>
                          )}
                        </div>
                      ) : (
                        <Badge variant="secondary">Closed</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Delivery Zones Tab */}
        <TabsContent value="zones" className="space-y-4">
          {zones.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MapPin className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No delivery zones configured</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {zones.map((zone) => (
                <Card key={zone.id} data-testid={`zone-${zone.id}`}>
                  <CardHeader>
                    <CardTitle className="text-lg">{zone.zoneName}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {zone.radiusKm && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Radius:</span>
                        <span>{zone.radiusKm} km</span>
                      </div>
                    )}
                    {zone.baseFee !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Base Fee:</span>
                        <span>${zone.baseFee.toFixed(2)}</span>
                      </div>
                    )}
                    {zone.feePerKm !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Per Km:</span>
                        <span>${zone.feePerKm.toFixed(2)}/km</span>
                      </div>
                    )}
                    {zone.estimatedMinutes && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ETA:</span>
                        <span>{zone.estimatedMinutes} min</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Surge Pricing Tab */}
        <TabsContent value="surge" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Surge Pricing Settings</CardTitle>
              <CardDescription>Dynamic pricing configuration (read-only)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">Surge Enabled</span>
                  <Badge variant={surge.surgeEnabled ? "default" : "secondary"}>
                    {surge.surgeEnabled ? "Yes" : "No"}
                  </Badge>
                </div>
                {surge.surgeEnabled && (
                  <>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="font-medium">Surge Multiplier</span>
                      <span>{surge.surgeMultiplier || "N/A"}x</span>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="font-medium">Peak Hours</span>
                      <span>
                        {surge.peakHoursStart && surge.peakHoursEnd
                          ? `${surge.peakHoursStart} - ${surge.peakHoursEnd}`
                          : "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="font-medium">Weekend Surge</span>
                      <Badge variant={surge.weekendEnabled ? "default" : "secondary"}>
                        {surge.weekendEnabled ? "Yes" : "No"}
                      </Badge>
                    </div>
                    {surge.weekendEnabled && (
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <span className="font-medium">Weekend Multiplier</span>
                        <span>{surge.weekendMultiplier || "N/A"}x</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit Log</CardTitle>
              <CardDescription>History of all settings changes</CardDescription>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No audit logs available
                </div>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="border rounded-lg p-4" data-testid={`audit-${log.id}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <Badge variant="outline" className="mb-1">
                            {log.action}
                          </Badge>
                          <p className="text-sm font-medium">{log.entityType}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.performedAt), "MMM d, yyyy HH:mm")}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">By: {log.performedBy}</p>
                      {log.changes && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground">View changes</summary>
                          <pre className="mt-2 p-2 bg-accent rounded overflow-x-auto">
                            {JSON.stringify(log.changes, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
