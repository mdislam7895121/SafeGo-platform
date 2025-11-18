import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Car, DollarSign, TrendingUp, Settings, User, Power } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function DriverHome() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(false);

  const { data: driverData, isLoading } = useQuery({
    queryKey: ["/api/driver/home"],
    refetchInterval: 5000,
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (online: boolean) => {
      const res = await apiRequest("PATCH", "/api/driver/status", { isOnline: online });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.vehicle) {
        setIsOnline(data.vehicle.isOnline);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
      toast({
        title: data.message,
        description: data.vehicle?.isOnline ? "You can now receive ride requests" : "You won't receive new requests",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Status update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const profile = (driverData as any)?.profile;
  const vehicle = (driverData as any)?.vehicle;
  const stats = (driverData as any)?.stats;
  const wallet = (driverData as any)?.wallet;

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Driver Dashboard</h1>
            <p className="text-sm opacity-90">{user?.email}</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={logout}
            className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground"
            data-testid="button-logout"
          >
            Logout
          </Button>
        </div>

        {/* Online/Offline Toggle */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Power className={`h-6 w-6 ${vehicle?.isOnline ? "text-green-600" : "text-gray-400"}`} />
                <div>
                  <p className="font-semibold">{vehicle?.isOnline ? "Online" : "Offline"}</p>
                  <p className="text-sm text-muted-foreground">
                    {vehicle?.isOnline ? "Ready for requests" : "Not accepting requests"}
                  </p>
                </div>
              </div>
              <Switch
                checked={vehicle?.isOnline || false}
                onCheckedChange={(checked) => toggleStatusMutation.mutate(checked)}
                disabled={toggleStatusMutation.isPending || !vehicle}
                data-testid="switch-online-status"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="p-6 space-y-6">
        {/* Verification Status */}
        {!profile?.isVerified && (
          <Card className="border-orange-500">
            <CardContent className="p-4">
              <p className="text-sm">
                ⚠️ Your account is pending verification. You can't go online until approved.
              </p>
            </CardContent>
          </Card>
        )}

        {!vehicle && (
          <Card className="border-orange-500">
            <CardContent className="p-4">
              <p className="text-sm mb-3">
                🚗 You need to register a vehicle before going online
              </p>
              <Link href="/driver/vehicle">
                <Button size="sm" data-testid="button-register-vehicle">Register Vehicle</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Balance</p>
                  <p className="text-2xl font-bold" data-testid="text-balance">
                    ${wallet?.balance != null ? Number(wallet.balance).toFixed(2) : "0.00"}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Owed</p>
                  <p className="text-2xl font-bold text-red-600" data-testid="text-negative-balance">
                    ${wallet?.negativeBalance != null ? Number(wallet.negativeBalance).toFixed(2) : "0.00"}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-red-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Trips</p>
                  <p className="text-2xl font-bold" data-testid="text-total-trips">
                    {stats?.totalTrips || 0}
                  </p>
                </div>
                <Car className="h-8 w-8 text-blue-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Rating</p>
                  <p className="text-2xl font-bold" data-testid="text-rating">
                    {stats?.rating?.toFixed(1) || "N/A"}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-yellow-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Vehicle Info */}
        {vehicle && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Vehicle Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <Badge>{vehicle.vehicleType}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Model</span>
                <span className="font-medium">{vehicle.vehicleModel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plate</span>
                <span className="font-medium">{vehicle.vehiclePlate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Earnings</span>
                <span className="font-bold">${vehicle.totalEarnings?.toFixed(2) || "0.00"}</span>
              </div>
              <Link href="/driver/vehicle">
                <Button variant="outline" className="w-full mt-2" data-testid="button-edit-vehicle">
                  Edit Vehicle
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-4">
          <Link href="/driver/profile">
            <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-profile">
              <User className="h-4 w-4" />
              Profile
            </Button>
          </Link>
          <Link href="/driver/vehicle">
            <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-vehicle">
              <Settings className="h-4 w-4" />
              Vehicle
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
