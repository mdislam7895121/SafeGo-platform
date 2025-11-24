import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DriverPreviewCard } from "@/components/DriverPreviewCard";
import { ArrowLeft, MapPin, CheckCircle2, Clock, DollarSign, Package } from "lucide-react";

type DriverPublicProfile = {
  name: string;
  pronouns: string | null;
  profilePhotoUrl: string | null;
  vehicle: {
    type: string;
    model: string;
    color: string;
    plateNumber: string;
  } | null;
  stats: {
    totalRides: number;
    rating: number;
    yearsActive: number;
  };
};

export default function OrderConfirmation() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/customer/order-confirmation/:id");
  const id = params?.id;

  // Fetch food order details
  const { data: orderData, isLoading: isLoadingOrder } = useQuery<{ order: any }>({
    queryKey: [`/api/food-orders/${id}`],
    refetchInterval: 5000, // Refresh every 5 seconds for live updates
  });

  const order = orderData?.order;
  const driverProfileId = order?.driver?.id;

  // Fetch driver public profile when driver is assigned
  const { data: driverProfile, isLoading: isLoadingDriver } = useQuery<DriverPublicProfile>({
    queryKey: [`/api/driver/public-profile/${driverProfileId}`],
    enabled: !!driverProfileId,
  });

  if (isLoadingOrder) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-6">
            <p className="text-muted-foreground">Order not found</p>
            <Button onClick={() => setLocation("/customer")} className="mt-4" data-testid="button-home">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "CONFIRMED":
      case "PREPARING":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "READY_FOR_PICKUP":
      case "PICKED_UP":
      case "OUT_FOR_DELIVERY":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "DELIVERED":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, " ");
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/customer/food/orders")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Order Confirmed!</h1>
            <p className="text-sm text-muted-foreground">Track your delivery below</p>
          </div>
          <Badge className={getStatusColor(order.status)} data-testid="badge-status">
            {getStatusLabel(order.status)}
          </Badge>
        </div>

        {/* Order Confirmation Message */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-6 w-6" />
              <div>
                <p className="font-semibold">Your order has been placed</p>
                <p className="text-sm text-muted-foreground">
                  Order #{order.id.slice(0, 8)}...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Driver Profile Card - Only when driver is assigned */}
        {driverProfileId && (
          <>
            {isLoadingDriver ? (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-20 w-20 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-4 w-64" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : driverProfile ? (
              <DriverPreviewCard profile={driverProfile} />
            ) : null}
          </>
        )}

        {/* Order Details */}
        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Package className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Restaurant</p>
                <p className="font-medium" data-testid="text-restaurant">
                  {order.restaurant?.name || "Restaurant"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Delivery Address</p>
                <p className="font-medium" data-testid="text-address">
                  {order.deliveryAddress}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-lg font-bold" data-testid="text-total">
                  ${Number(order.serviceFare).toFixed(2)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Ordered</p>
                <p className="font-medium" data-testid="text-time">
                  {new Date(order.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={() => setLocation("/customer/food/orders")}
          className="w-full"
          data-testid="button-view-orders"
        >
          View All Orders
        </Button>
      </div>
    </div>
  );
}
