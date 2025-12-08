import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Power, 
  DollarSign, 
  UtensilsCrossed, 
  Package, 
  Bell, 
  User,
  Wallet,
  Settings,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  MapPin,
  Radio,
  TrendingUp,
  Ban
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useEffect, useCallback } from "react";

interface DeliveryDriverDashboardData {
  driver: {
    id: string;
    fullName: string;
    countryCode: string;
    verificationStatus: string;
    rejectionReason: string | null;
    isVerified: boolean;
    driverStatus: string;
    isOnline: boolean;
    deliveryMethod: string | null;
    profilePhotoUrl: string | null;
    canFoodDelivery: boolean;
    canParcelDelivery: boolean;
  };
  earnings: {
    todayEarnings: number;
    weeklyEarnings: number;
    negativeBalance: number;
    totalEarnings: number;
  };
  tasks: {
    pendingFoodTasks: number;
    activeFoodTasks: number;
    pendingParcelTasks: number;
    activeParcelTasks: number;
  };
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    type: string;
    createdAt: string;
    isRead: boolean;
  }>;
}

export default function DeliveryDriverDashboard() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [locationWatchId, setLocationWatchId] = useState<number | null>(null);

  const { data: dashboardData, isLoading, refetch } = useQuery<DeliveryDriverDashboardData>({
    queryKey: ["/api/driver/delivery/dashboard"],
    refetchInterval: 30000,
  });

  const driver = dashboardData?.driver;
  const earnings = dashboardData?.earnings;
  const tasks = dashboardData?.tasks;
  const notifications = dashboardData?.notifications || [];
  const unreadNotifications = notifications.filter(n => !n.isRead);

  const goOnlineMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/driver/delivery/go-online", {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "You are now online",
        description: "You can now receive delivery requests",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/delivery/dashboard"] });
      setIsUpdatingStatus(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to go online",
        description: error.message || "Please try again",
        variant: "destructive",
      });
      setIsUpdatingStatus(false);
    },
  });

  const goOfflineMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/driver/delivery/go-offline", {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "You are now offline",
        description: "You will not receive new delivery requests",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/delivery/dashboard"] });
      setIsUpdatingStatus(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to go offline",
        description: error.message || "Please try again",
        variant: "destructive",
      });
      setIsUpdatingStatus(false);
    },
  });

  const sendLocationUpdate = useCallback(async (position: GeolocationPosition) => {
    try {
      await apiRequest("/api/driver/delivery/update-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      });
    } catch (error) {
      console.error("Failed to update location:", error);
    }
  }, []);

  useEffect(() => {
    const isOnline = driver?.isOnline;

    if (isOnline && !locationWatchId) {
      if (navigator.geolocation) {
        const watchId = navigator.geolocation.watchPosition(
          sendLocationUpdate,
          (error) => console.error("Location error:", error),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
        );
        setLocationWatchId(watchId);
      }
    } else if (!isOnline && locationWatchId) {
      navigator.geolocation.clearWatch(locationWatchId);
      setLocationWatchId(null);
    }

    return () => {
      if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
      }
    };
  }, [driver?.isOnline, locationWatchId, sendLocationUpdate]);

  const handleToggleStatus = () => {
    if (!driver?.isVerified) {
      toast({
        title: "Cannot go online",
        description: "Your account must be verified before you can go online",
        variant: "destructive",
      });
      return;
    }
    
    setIsUpdatingStatus(true);
    if (driver?.isOnline) {
      goOfflineMutation.mutate();
    } else {
      goOnlineMutation.mutate();
    }
  };

  const getVerificationStatusBadge = () => {
    if (!driver) return null;
    
    switch (driver.verificationStatus) {
      case "approved":
        return (
          <Badge className="gap-1 bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400" data-testid="badge-verification-approved">
            <CheckCircle2 className="h-3 w-3" />
            Verified
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="gap-1" data-testid="badge-verification-rejected">
            <XCircle className="h-3 w-3" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1" data-testid="badge-verification-pending">
            <Clock className="h-3 w-3" />
            Pending Verification
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  const isPending = driver?.verificationStatus === "pending";
  const isRejected = driver?.verificationStatus === "rejected";
  const isApproved = driver?.verificationStatus === "approved" && driver?.isVerified;

  return (
    <div className="min-h-screen bg-background pb-6">
      <div className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Delivery Dashboard</h1>
            <p className="text-sm opacity-90">{driver?.fullName || user?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            {getVerificationStatusBadge()}
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
        </div>
      </div>

      <div className="p-6 space-y-6">
        {isPending && (
          <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20" data-testid="card-pending-verification">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800 dark:text-amber-400">Account Pending Verification</p>
                  <p className="text-sm text-amber-700 dark:text-amber-500">
                    Your application is being reviewed. You will be notified once approved.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isRejected && (
          <Card className="border-red-500 bg-red-50 dark:bg-red-950/20" data-testid="card-rejected-verification">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Ban className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-800 dark:text-red-400">Application Rejected</p>
                  <p className="text-sm text-red-700 dark:text-red-500">
                    {driver?.rejectionReason || "Your application was not approved. Please contact support for more details."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isApproved && (
          <Card className={`border-2 ${driver.isOnline ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "border-gray-300 dark:border-gray-700"}`} data-testid="card-online-toggle">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center ${driver.isOnline ? "bg-green-500" : "bg-gray-400"}`}>
                    <Power className={`h-6 w-6 text-white ${driver.isOnline ? "animate-pulse" : ""}`} />
                  </div>
                  <div>
                    <p className="font-semibold text-lg" data-testid="text-online-status">
                      {driver.isOnline ? "Online" : "Offline"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {driver.isOnline ? (
                        <span className="flex items-center gap-1">
                          <Radio className="h-3 w-3 text-green-500 animate-pulse" />
                          Accepting delivery requests
                        </span>
                      ) : "Tap to go online and start earning"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={driver.isOnline}
                  onCheckedChange={handleToggleStatus}
                  disabled={isUpdatingStatus || !isApproved}
                  className="scale-125"
                  data-testid="switch-online-toggle"
                />
              </div>
            </CardContent>
          </Card>
        )}

        <div>
          <h2 className="text-lg font-semibold mb-3">Earnings Summary</h2>
          <div className="grid grid-cols-2 gap-4">
            <Card data-testid="card-today-earnings">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Today</p>
                    <p className="text-2xl font-bold text-green-600" data-testid="text-today-earnings">
                      ${(earnings?.todayEarnings || 0).toFixed(2)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-weekly-earnings">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">This Week</p>
                    <p className="text-2xl font-bold text-blue-600" data-testid="text-weekly-earnings">
                      ${(earnings?.weeklyEarnings || 0).toFixed(2)}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-600 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-negative-balance">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Commission Owed</p>
                    <p className="text-2xl font-bold text-red-600" data-testid="text-negative-balance">
                      ${(earnings?.negativeBalance || 0).toFixed(2)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-red-600 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-total-earnings">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Earnings</p>
                    <p className="text-2xl font-bold text-purple-600" data-testid="text-total-earnings">
                      ${(earnings?.totalEarnings || 0).toFixed(2)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-purple-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Delivery Tasks</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {driver?.canFoodDelivery && (
              <Card className="border-2 border-orange-200 dark:border-orange-800" data-testid="card-food-delivery-tasks">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UtensilsCrossed className="h-5 w-5 text-orange-500" />
                    Food Delivery
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-amber-600" data-testid="text-pending-food-tasks">
                        {tasks?.pendingFoodTasks || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-blue-600" data-testid="text-active-food-tasks">
                        {tasks?.activeFoodTasks || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Active</p>
                    </div>
                  </div>
                  <Link href="/driver/food-deliveries">
                    <Button variant="outline" className="w-full" size="sm" disabled={!isApproved} data-testid="button-view-food-tasks">
                      View Food Tasks
                      <ChevronRight className="h-4 w-4 ml-auto" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {driver?.canParcelDelivery && (
              <Card className="border-2 border-blue-200 dark:border-blue-800" data-testid="card-parcel-delivery-tasks">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-5 w-5 text-blue-500" />
                    Parcel Delivery
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-amber-600" data-testid="text-pending-parcel-tasks">
                        {tasks?.pendingParcelTasks || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-blue-600" data-testid="text-active-parcel-tasks">
                        {tasks?.activeParcelTasks || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Active</p>
                    </div>
                  </div>
                  <Link href="/driver/parcel-deliveries">
                    <Button variant="outline" className="w-full" size="sm" disabled={!isApproved} data-testid="button-view-parcel-tasks">
                      View Parcel Tasks
                      <ChevronRight className="h-4 w-4 ml-auto" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <Card data-testid="card-notifications">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              {unreadNotifications.length > 0 && (
                <Badge variant="secondary">{unreadNotifications.length} new</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No notifications yet</p>
            ) : (
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {notifications.slice(0, 5).map((notification) => (
                  <div 
                    key={notification.id} 
                    className={`p-3 rounded-lg border ${!notification.isRead ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800" : ""}`}
                    data-testid={`notification-item-${notification.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{notification.title}</p>
                        <p className="text-xs text-muted-foreground">{notification.message}</p>
                      </div>
                      {!notification.isRead && (
                        <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <Link href="/driver/notifications">
              <Button variant="ghost" className="w-full mt-2" size="sm" data-testid="button-view-all-notifications">
                View All Notifications
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <Link href="/driver/profile">
            <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-profile">
              <User className="h-4 w-4" />
              Profile
            </Button>
          </Link>
          <Link href="/driver/wallet">
            <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-wallet">
              <Wallet className="h-4 w-4" />
              Wallet
            </Button>
          </Link>
          <Link href="/driver/earnings">
            <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-earnings">
              <DollarSign className="h-4 w-4" />
              Earnings
            </Button>
          </Link>
          <Link href="/driver/settings">
            <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-settings">
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
