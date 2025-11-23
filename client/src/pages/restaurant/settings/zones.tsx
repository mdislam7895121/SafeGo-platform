import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Plus, Save, Trash2, Info, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface DeliveryZone {
  id: string;
  restaurantId: string;
  zoneName: string;
  radiusKm: number | null;
  baseFee: number | null;
  feePerKm: number | null;
  estimatedMinutes: number | null;
}

interface ProfileData {
  ownerRole?: string;
  canViewAnalytics?: boolean;
}

export default function DeliveryZonesPage() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newZone, setNewZone] = useState<Partial<DeliveryZone>>({});

  // Fetch profile to determine RBAC
  const { data: homeData } = useQuery<{ profile: ProfileData }>({
    queryKey: ["/api/restaurant/home"],
  });

  const userRole = homeData?.profile?.ownerRole || "OWNER";
  const canEdit = userRole === "OWNER";
  const canView = userRole === "OWNER" || homeData?.profile?.canViewAnalytics;

  // Fetch delivery zones
  const { data, isLoading } = useQuery<{ zones: DeliveryZone[] }>({
    queryKey: ["/api/restaurant/settings/zones"],
    enabled: canView,
  });

  const zones = data?.zones || [];

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (zoneData: Partial<DeliveryZone>) => {
      const res = await apiRequest("POST", "/api/restaurant/settings/zones", zoneData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/settings/zones"] });
      setIsCreateDialogOpen(false);
      setNewZone({});
      toast({
        title: "Success",
        description: "Delivery zone created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create delivery zone",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (zoneId: string) => {
      const res = await apiRequest("DELETE", `/api/restaurant/settings/zones/${zoneId}`, undefined);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/settings/zones"] });
      toast({
        title: "Success",
        description: "Delivery zone deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete delivery zone",
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    if (!newZone.zoneName) {
      toast({
        title: "Validation Error",
        description: "Zone name is required",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(newZone);
  };

  const handleDelete = (zoneId: string) => {
    if (confirm("Are you sure you want to delete this delivery zone?")) {
      deleteMutation.mutate(zoneId);
    }
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
    <div className="p-4 md:p-8 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <MapPin className="h-8 w-8" />
            Delivery Zones
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage delivery areas, fees, and estimated delivery times
          </p>
        </div>
        {canEdit && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-create-zone">
                <Plus className="h-4 w-4" />
                Add Zone
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Delivery Zone</DialogTitle>
                <DialogDescription>
                  Define a new delivery area with custom fees and estimated delivery time
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="zone-name">Zone Name *</Label>
                  <Input
                    id="zone-name"
                    placeholder="e.g., Downtown"
                    value={newZone.zoneName || ""}
                    onChange={(e) => setNewZone({ ...newZone, zoneName: e.target.value })}
                    data-testid="input-zone-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="radius">Radius (km)</Label>
                  <Input
                    id="radius"
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="e.g., 5.0"
                    value={newZone.radiusKm || ""}
                    onChange={(e) => setNewZone({ ...newZone, radiusKm: e.target.value ? parseFloat(e.target.value) : null })}
                    data-testid="input-radius"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="base-fee">Base Fee ($)</Label>
                    <Input
                      id="base-fee"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g., 2.50"
                      value={newZone.baseFee || ""}
                      onChange={(e) => setNewZone({ ...newZone, baseFee: e.target.value ? parseFloat(e.target.value) : null })}
                      data-testid="input-base-fee"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fee-per-km">Fee Per Km ($)</Label>
                    <Input
                      id="fee-per-km"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g., 0.50"
                      value={newZone.feePerKm || ""}
                      onChange={(e) => setNewZone({ ...newZone, feePerKm: e.target.value ? parseFloat(e.target.value) : null })}
                      data-testid="input-fee-per-km"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eta">Estimated Delivery Time (minutes)</Label>
                  <Input
                    id="eta"
                    type="number"
                    min="1"
                    placeholder="e.g., 30"
                    value={newZone.estimatedMinutes || ""}
                    onChange={(e) => setNewZone({ ...newZone, estimatedMinutes: e.target.value ? parseInt(e.target.value) : null })}
                    data-testid="input-eta"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={createMutation.isPending}
                  data-testid="button-cancel-create"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  className="gap-2"
                  data-testid="button-save-zone"
                >
                  <Save className="h-4 w-4" />
                  {createMutation.isPending ? "Creating..." : "Create Zone"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!canEdit && (
        <Alert data-testid="alert-view-only">
          <Info className="h-4 w-4" />
          <AlertDescription>
            You have read-only access to these settings. Only the restaurant owner can make changes.
          </AlertDescription>
        </Alert>
      )}

      {zones.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MapPin className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No delivery zones configured</p>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Create delivery zones to define areas where you offer delivery service
            </p>
            {canEdit && (
              <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2" data-testid="button-create-first-zone">
                <Plus className="h-4 w-4" />
                Create First Zone
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map((zone) => (
            <Card key={zone.id} data-testid={`card-zone-${zone.id}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg">{zone.zoneName}</CardTitle>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(zone.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-${zone.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                {zone.radiusKm && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Radius:</span>
                    <span className="font-medium">{zone.radiusKm} km</span>
                  </div>
                )}
                {zone.baseFee !== null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Base Fee:</span>
                    <span className="font-medium">${zone.baseFee.toFixed(2)}</span>
                  </div>
                )}
                {zone.feePerKm !== null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Per Km:</span>
                    <span className="font-medium">${zone.feePerKm.toFixed(2)}/km</span>
                  </div>
                )}
                {zone.estimatedMinutes && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">ETA:</span>
                    <span className="font-medium">{zone.estimatedMinutes} min</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
