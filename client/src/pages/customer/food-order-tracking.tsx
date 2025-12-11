import { useState, useEffect, useMemo } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { CustomerHomeButton, BackToRestaurantsButton } from "@/components/customer/EatsNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Clock,
  MapPin,
  Phone,
  MessageCircle,
  Star,
  ChefHat,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  Navigation,
  ClipboardCheck,
  UserCheck,
  ShoppingBag,
  Store,
  Loader2,
  RefreshCw,
  Ban,
  Receipt,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/formatCurrency";
import { useLiveFoodTracking } from "@/hooks/useLiveFoodTracking";
import { 
  FOOD_ORDER_STATUS_INFO, 
  isStatusCompleted, 
  isDeliveryPhase as checkDeliveryPhase,
  isActiveOrder,
  type FoodOrderStatus 
} from "@shared/foodOrderStatus";
import { useToast } from "@/hooks/use-toast";
import { ReviewSubmissionDialog } from "@/components/customer/ReviewSubmissionDialog";

const STATUS_ICON_MAP: Record<string, typeof Clock> = {
  ClipboardCheck,
  CheckCircle: CheckCircle2,
  ChefHat,
  Package,
  UserCheck,
  Navigation,
  ShoppingBag,
  Truck,
  CheckCircle2,
  XCircle,
};

const restaurantIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="
    width: 32px; height: 32px; background: #F97316; 
    border: 3px solid white; border-radius: 50%; 
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex; align-items: center; justify-content: center;
  "><svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const deliveryIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="
    width: 32px; height: 32px; background: #10B981; 
    border: 3px solid white; border-radius: 50%; 
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex; align-items: center; justify-content: center;
  "><svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

function createDriverIcon(heading: number): L.DivIcon {
  const arrowRotation = heading - 45;
  return L.divIcon({
    className: "driver-marker",
    html: `<div style="
      position: relative;
      width: 40px; height: 40px;
    ">
      <div style="
        position: absolute;
        width: 40px; height: 40px; background: #3B82F6; 
        border: 4px solid white; border-radius: 50%; 
        box-shadow: 0 3px 12px rgba(0,0,0,0.4);
        display: flex; align-items: center; justify-content: center;
        z-index: 2;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white" style="transform: rotate(${arrowRotation}deg); transition: transform 0.3s ease;">
          <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z"/>
        </svg>
      </div>
      <div style="
        position: absolute;
        width: 40px; height: 40px;
        background: rgba(59, 130, 246, 0.3);
        border-radius: 50%;
        animation: pulse 2s ease-out infinite;
        z-index: 1;
      "></div>
    </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function MapBoundsUpdater({ 
  points 
}: { 
  points: Array<{ lat: number; lng: number } | null> 
}) {
  const map = useMap();
  
  useEffect(() => {
    const validPoints = points.filter((p): p is { lat: number; lng: number } => p !== null && p.lat !== 0 && p.lng !== 0);
    if (validPoints.length >= 2) {
      const bounds = L.latLngBounds(validPoints.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (validPoints.length === 1) {
      map.setView([validPoints[0].lat, validPoints[0].lng], 14);
    }
  }, [map, points]);
  
  return null;
}

interface StatusTimelineItemProps {
  status: FoodOrderStatus;
  currentStatus: FoodOrderStatus;
  timestamp: string | null;
  isLast?: boolean;
}

function StatusTimelineItem({ status, currentStatus, timestamp, isLast }: StatusTimelineItemProps) {
  const info = FOOD_ORDER_STATUS_INFO[status];
  const isCompleted = isStatusCompleted(currentStatus, status);
  const isCurrent = status === currentStatus;
  const Icon = STATUS_ICON_MAP[info.icon] || Clock;

  const colorClasses = isCompleted
    ? "bg-primary text-primary-foreground border-primary"
    : isCurrent
    ? "bg-orange-500 text-white border-orange-500 animate-pulse"
    : "bg-muted text-muted-foreground border-muted";

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className={`h-10 w-10 rounded-full border-2 flex items-center justify-center ${colorClasses}`}>
          <Icon className="h-5 w-5" />
        </div>
        {!isLast && (
          <div className={`w-0.5 flex-1 min-h-[32px] ${isCompleted ? "bg-primary" : "bg-muted"}`} />
        )}
      </div>
      <div className="flex-1 pb-6">
        <p className={`font-medium ${isCompleted || isCurrent ? "text-foreground" : "text-muted-foreground"}`}>
          {info.label}
        </p>
        <p className="text-sm text-muted-foreground">{info.description}</p>
        {timestamp && (
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    </div>
  );
}

export default function FoodOrderTracking() {
  const { id } = useParams<{ id: string }>();
  const [, setLocationPath] = useLocation();
  const { toast } = useToast();
  const [showFullTimeline, setShowFullTimeline] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewPromptDismissed, setReviewPromptDismissed] = useState(false);

  const cancelOrderMutation = useMutation({
    mutationFn: async (reason: string) => {
      const response = await apiRequest(`/api/food-orders/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      return response;
    },
    onSuccess: (response: any) => {
      setShowCancelDialog(false);
      setCancelReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/food-orders", id] });
      toast({
        title: "Order Cancelled",
        description: response.order?.refundAmount 
          ? `Your order has been cancelled. A refund of ${formatCurrency(response.order.refundAmount, "USD")} will be processed.`
          : "Your order has been cancelled.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Cancellation Failed",
        description: error.message || "Could not cancel your order. Please try again.",
        variant: "destructive",
      });
    },
  });

  const isCancellable = (status: string) => {
    return ["placed", "accepted", "preparing"].includes(status);
  };

  const {
    data,
    isLoading,
    error,
    lastUpdated,
    refetch,
    driverPosition,
    driverHeading,
    etaMinutes,
    remainingDistanceMiles,
    isDeliveryPhase,
    isOrderPickedUp,
  } = useLiveFoodTracking({
    orderId: id || null,
    enabled: !!id,
    pollingIntervalMs: 5000,
    onStatusChange: (newStatus, oldStatus) => {
      const info = FOOD_ORDER_STATUS_INFO[newStatus];
      toast({
        title: info.label,
        description: info.description,
      });
    },
  });

  const statusTimeline = useMemo(() => {
    if (!data) return [];
    
    const baseStatuses: FoodOrderStatus[] = [
      "placed",
      "accepted", 
      "preparing",
      "ready_for_pickup",
    ];

    const deliveryStatuses: FoodOrderStatus[] = data.driver ? [
      "driver_assigned",
      "driver_arriving",
      "picked_up",
      "on_the_way",
      "delivered",
    ] : ["delivered"];

    return [...baseStatuses, ...deliveryStatuses];
  }, [data]);

  const getTimestampForStatus = (status: FoodOrderStatus): string | null => {
    if (!data?.timestamps) return null;
    switch (status) {
      case "placed": return data.timestamps.placedAt;
      case "accepted": return data.timestamps.acceptedAt;
      case "preparing": return data.timestamps.preparingAt;
      case "ready_for_pickup": return data.timestamps.readyAt;
      case "picked_up": return data.timestamps.pickedUpAt;
      case "delivered": return data.timestamps.deliveredAt;
      default: return null;
    }
  };

  const mapPoints = useMemo(() => {
    if (!data) return [];
    const points: Array<{ lat: number; lng: number } | null> = [];
    
    if (data.restaurant.location) {
      points.push(data.restaurant.location);
    }
    if (data.deliveryLocation.lat && data.deliveryLocation.lng) {
      points.push({ lat: data.deliveryLocation.lat, lng: data.deliveryLocation.lng });
    }
    if (driverPosition) {
      points.push(driverPosition);
    }
    
    return points;
  }, [data, driverPosition]);

  if (isLoading && !data) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg sticky top-0 z-10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/customer/food/orders">
                <Button variant="ghost" size="icon" className="text-primary-foreground" data-testid="button-back">
                  <ArrowLeft className="h-6 w-6" />
                </Button>
              </Link>
              <Skeleton className="h-8 w-48 bg-primary-foreground/20" />
            </div>
            <CustomerHomeButton 
              variant="ghost" 
              size="sm" 
              className="text-primary-foreground"
            />
          </div>
        </header>
        <div className="p-6 space-y-6">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg sticky top-0 z-10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/customer/food/orders">
                <Button variant="ghost" size="icon" className="text-primary-foreground" data-testid="button-back">
                  <ArrowLeft className="h-6 w-6" />
                </Button>
              </Link>
              <h1 className="text-2xl font-bold">Order Tracking</h1>
            </div>
            <CustomerHomeButton 
              variant="ghost" 
              size="sm" 
              className="text-primary-foreground"
            />
          </div>
        </header>
        <div className="p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Unable to load order</h3>
              <p className="text-muted-foreground mb-6">{error || "Order not found"}</p>
              <Button onClick={() => refetch()} data-testid="button-retry">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const currentStatusInfo = FOOD_ORDER_STATUS_INFO[data.status] || FOOD_ORDER_STATUS_INFO.placed;
  const showMap = isDeliveryPhase || data.status === "delivered";

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/customer/food/orders">
              <Button variant="ghost" size="icon" className="text-primary-foreground" data-testid="button-back">
                <ArrowLeft className="h-6 w-6" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">Order #{data.orderCode || data.orderId.slice(-6)}</h1>
              <p className="text-sm opacity-90">{data.restaurant.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-primary-foreground" 
              onClick={() => refetch()}
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <CustomerHomeButton 
              variant="ghost" 
              size="sm" 
              className="text-primary-foreground"
            />
          </div>
        </div>
      </header>

      <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
        {/* Current Status Banner */}
        <Card className={`border-2 ${data.status === "cancelled" ? "border-destructive" : "border-primary"}`}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`h-16 w-16 rounded-full flex items-center justify-center ${
                data.status === "cancelled" 
                  ? "bg-destructive/10 text-destructive" 
                  : "bg-primary/10 text-primary"
              }`}>
                {data.status === "cancelled" ? (
                  <XCircle className="h-8 w-8" />
                ) : data.status === "delivered" ? (
                  <CheckCircle2 className="h-8 w-8" />
                ) : isDeliveryPhase ? (
                  <Truck className="h-8 w-8" />
                ) : (
                  <ChefHat className="h-8 w-8" />
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold" data-testid="text-current-status">
                  {currentStatusInfo.label}
                </h2>
                <p className="text-muted-foreground">{currentStatusInfo.description}</p>
                {etaMinutes > 0 && isActiveOrder(data.status) && (
                  <div className="flex items-center gap-2 mt-2 text-primary font-medium">
                    <Clock className="h-4 w-4" />
                    <span data-testid="text-eta">
                      {isOrderPickedUp ? "Arriving in" : "Ready in"} ~{etaMinutes} min
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Map (during delivery phase) */}
        {showMap && (mapPoints.length > 0) && (
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Live Tracking
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-64 md:h-80 relative">
                <MapContainer
                  center={[mapPoints[0]?.lat || 40.7128, mapPoints[0]?.lng || -74.006]}
                  zoom={14}
                  style={{ height: "100%", width: "100%" }}
                  zoomControl={false}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapBoundsUpdater points={mapPoints} />
                  
                  {data.restaurant.location && (
                    <Marker 
                      position={[data.restaurant.location.lat, data.restaurant.location.lng]} 
                      icon={restaurantIcon}
                    />
                  )}
                  
                  {data.deliveryLocation.lat && data.deliveryLocation.lng && (
                    <Marker 
                      position={[data.deliveryLocation.lat, data.deliveryLocation.lng]} 
                      icon={deliveryIcon}
                    />
                  )}
                  
                  {driverPosition && (
                    <Marker
                      position={[driverPosition.lat, driverPosition.lng]}
                      icon={createDriverIcon(driverHeading)}
                    />
                  )}
                </MapContainer>

                {/* Map Legend */}
                <div className="absolute bottom-2 left-2 bg-background/90 backdrop-blur-sm rounded-lg p-2 text-xs space-y-1 z-[1000]">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-orange-500" />
                    <span>Restaurant</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-emerald-500" />
                    <span>Delivery</span>
                  </div>
                  {driverPosition && (
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-blue-500" />
                      <span>Driver</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Driver Info Card (when assigned) */}
        {data.driver && isDeliveryPhase && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  {data.driver.photoUrl && <AvatarImage src={data.driver.photoUrl} />}
                  <AvatarFallback className="text-lg">
                    {data.driver.firstName[0]}{data.driver.lastName?.[0] || ""}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg" data-testid="text-driver-name">
                    {data.driver.firstName} {data.driver.lastName}
                  </h3>
                  {data.driver.rating && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span>{data.driver.rating.toFixed(1)}</span>
                    </div>
                  )}
                  {data.driver.vehicle && (
                    <p className="text-sm text-muted-foreground">
                      {data.driver.vehicle.color} {data.driver.vehicle.make} {data.driver.vehicle.model}
                      <span className="ml-2 font-medium">{data.driver.vehicle.plate}</span>
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" data-testid="button-call-driver">
                    <Phone className="h-5 w-5" />
                  </Button>
                  <Button variant="outline" size="icon" data-testid="button-message-driver">
                    <MessageCircle className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              
              {remainingDistanceMiles > 0 && (
                <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Distance</span>
                  <span className="font-medium">{remainingDistanceMiles.toFixed(1)} mi away</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Status Timeline */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Order Progress
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowFullTimeline(!showFullTimeline)}
                data-testid="button-toggle-timeline"
              >
                {showFullTimeline ? "Show Less" : "Show All"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {(showFullTimeline ? statusTimeline : statusTimeline.slice(0, 4)).map((status, index) => (
                <StatusTimelineItem
                  key={status}
                  status={status}
                  currentStatus={data.status}
                  timestamp={getTimestampForStatus(status)}
                  isLast={index === (showFullTimeline ? statusTimeline.length - 1 : 3)}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Order Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              Order Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Restaurant */}
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                {data.restaurant.logoUrl && <AvatarImage src={data.restaurant.logoUrl} />}
                <AvatarFallback>{data.restaurant.name[0]}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium" data-testid="text-restaurant-name">{data.restaurant.name}</p>
                <p className="text-sm text-muted-foreground">{data.restaurant.cuisineType}</p>
              </div>
            </div>

            <Separator />

            {/* Items */}
            <div className="space-y-2">
              <p className="font-medium text-sm text-muted-foreground uppercase">Items</p>
              {data.items.map((item, index) => (
                <div key={index} className="flex justify-between text-sm" data-testid={`order-item-${index}`}>
                  <span>{item.quantity}x {item.name}</span>
                  <span className="font-medium">{formatCurrency(item.quantity * item.price, "USD")}</span>
                </div>
              ))}
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-2 text-sm">
              {data.subtotal && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(parseFloat(data.subtotal), "USD")}</span>
                </div>
              )}
              {data.deliveryFee && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery Fee</span>
                  <span>{formatCurrency(parseFloat(data.deliveryFee), "USD")}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-base pt-2 border-t">
                <span>Total</span>
                <span data-testid="text-order-total">{formatCurrency(parseFloat(data.serviceFare), "USD")}</span>
              </div>
            </div>

            <Separator />

            {/* Delivery Address */}
            <div>
              <p className="font-medium text-sm text-muted-foreground uppercase mb-2">Delivery Address</p>
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-sm" data-testid="text-delivery-address">{data.deliveryLocation.address}</p>
              </div>
            </div>

            {/* Payment */}
            <div>
              <p className="font-medium text-sm text-muted-foreground uppercase mb-2">Payment</p>
              <Badge variant="secondary" data-testid="badge-payment-method">
                {data.paymentMethod === "cash" ? "Cash on Delivery" : "Online Payment"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Cancel Order Button - only for cancellable orders */}
        {isCancellable(data.status) && (
          <Card className="border-orange-200 dark:border-orange-900">
            <CardContent className="p-4">
              <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    data-testid="button-cancel-order"
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Cancel Order
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Your Order?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-3">
                        <p>
                          {data.status === "preparing" 
                            ? "Since the restaurant has started preparing your order, you'll receive an 80% refund."
                            : "You'll receive a full refund for this cancellation."}
                        </p>
                        <div>
                          <label className="text-sm font-medium">Reason (optional)</label>
                          <Textarea
                            placeholder="Tell us why you're cancelling..."
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            className="mt-1"
                            disabled={cancelOrderMutation.isPending}
                            data-testid="input-cancel-reason"
                          />
                        </div>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel 
                      disabled={cancelOrderMutation.isPending}
                      data-testid="button-cancel-dialog-close"
                    >
                      Keep Order
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        if (!cancelOrderMutation.isPending) {
                          cancelOrderMutation.mutate(cancelReason);
                        }
                      }}
                      disabled={cancelOrderMutation.isPending}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      data-testid="button-confirm-cancel"
                    >
                      {cancelOrderMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Cancelling...
                        </>
                      ) : (
                        "Yes, Cancel Order"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <p className="text-xs text-center text-muted-foreground mt-2">
                {data.status === "preparing" 
                  ? "An 80% refund will be issued as preparation has started"
                  : "A full refund will be issued"}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Cancellation Info */}
        {data.cancellation && (
          <Card className="border-destructive">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <XCircle className="h-6 w-6 text-destructive flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-destructive">Order Cancelled</h3>
                  {data.cancellation.cancelledBy && (
                    <p className="text-sm text-muted-foreground">
                      Cancelled by: {data.cancellation.cancelledBy}
                    </p>
                  )}
                  {data.cancellation.reason && (
                    <p className="text-sm mt-1">{data.cancellation.reason}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Review Prompt - Show when order is delivered and not yet reviewed */}
        {data.status === "delivered" && !data.hasReview && !reviewPromptDismissed && (
          <Card className="border-primary bg-primary/5">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Star className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">How was your order?</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Share your experience with {data.restaurant.name} to help others
                  </p>
                  <div className="flex gap-3 mt-4">
                    <Button 
                      onClick={() => setShowReviewDialog(true)}
                      data-testid="button-leave-review"
                    >
                      <Star className="h-4 w-4 mr-2" />
                      Leave a Review
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={() => setReviewPromptDismissed(true)}
                      data-testid="button-dismiss-review-prompt"
                    >
                      Maybe Later
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions for Delivered Orders */}
        {data.status === "delivered" && (
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-3">
                <Link href={`/customer/food-orders/${id}/receipt`} className="flex-1">
                  <Button variant="outline" className="w-full" data-testid="button-view-receipt">
                    <Receipt className="h-4 w-4 mr-2" />
                    View Receipt
                  </Button>
                </Link>
                {!data.hasReview && (
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setShowReviewDialog(true)}
                    data-testid="button-rate-order"
                  >
                    <Star className="h-4 w-4 mr-2" />
                    Rate Order
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Help Section */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Need Help?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Having issues with your order? Our support team is here to help.
            </p>
            <div className="flex gap-2">
              <Link href="/customer/support" className="flex-1">
                <Button variant="outline" className="w-full" data-testid="button-get-help">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Get Support
                </Button>
              </Link>
              {data.driver?.phone && (
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => {
                    const sanitizedPhone = data.driver?.phone?.replace(/[^0-9+]/g, '') || '';
                    if (sanitizedPhone) {
                      window.location.href = `tel:${sanitizedPhone}`;
                    }
                  }}
                  data-testid="button-call-driver"
                >
                  <Phone className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Last Updated */}
        {lastUpdated && (
          <p className="text-xs text-center text-muted-foreground">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Pulse animation CSS */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.3); opacity: 0.3; }
          100% { transform: scale(1); opacity: 0.7; }
        }
      `}</style>

      {/* Review Submission Dialog */}
      <ReviewSubmissionDialog
        open={showReviewDialog}
        onOpenChange={setShowReviewDialog}
        orderId={id || ""}
        restaurantName={data?.restaurant.name || "Restaurant"}
        onSuccess={() => {
          refetch();
          setReviewPromptDismissed(true);
        }}
      />
    </div>
  );
}
