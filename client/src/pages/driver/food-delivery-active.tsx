import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { format } from "date-fns";
import {
  UtensilsCrossed,
  MapPin,
  DollarSign,
  Clock,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  Navigation,
  Phone,
  Store,
  User,
  Package,
  ArrowRight,
  AlertTriangle,
  ExternalLink,
  MessageSquare,
  Banknote,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface DeliveryItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  modifiers?: Array<{ name: string; price: number }>;
  specialInstructions?: string;
}

interface DeliveryDetail {
  id: string;
  orderId: string | null;
  orderCode: string | null;
  status: string;
  restaurant: {
    id: string;
    name: string;
    address: string;
    phone: string | null;
  } | null;
  pickupAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffAddress: string;
  dropoffLat: number | null;
  dropoffLng: number | null;
  estimatedPayout: number;
  customer: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
  acceptedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  deliveryNotesForDriver: string | null;
  items: DeliveryItem[];
  paymentMethod?: string;
}

const statusConfig: Record<string, { 
  label: string; 
  sublabel: string; 
  progress: number; 
  nextAction: string;
  nextStatus: "picked_up" | "on_the_way" | "delivered" | null;
}> = {
  accepted: { 
    label: "Head to Restaurant", 
    sublabel: "Pick up the order", 
    progress: 25,
    nextAction: "Mark as Picked Up",
    nextStatus: "picked_up"
  },
  picked_up: { 
    label: "Order Picked Up", 
    sublabel: "Navigate to customer", 
    progress: 50,
    nextAction: "Start Delivery",
    nextStatus: "on_the_way"
  },
  on_the_way: { 
    label: "On the Way", 
    sublabel: "Deliver to customer", 
    progress: 75,
    nextAction: "Mark as Delivered",
    nextStatus: "delivered"
  },
  delivered: { 
    label: "Delivered", 
    sublabel: "Order complete", 
    progress: 100,
    nextAction: "",
    nextStatus: null
  },
};

const deliveryKeys = {
  detail: (id: string) => ["/api/driver/food-delivery", id],
  active: ["/api/driver/food-delivery/active"],
  history: ["/api/driver/food-delivery/history"],
};

export default function DriverFoodDeliveryActive() {
  const { deliveryId } = useParams<{ deliveryId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    status: "picked_up" | "on_the_way" | "delivered";
    label: string;
  } | null>(null);
  const [locationWatchId, setLocationWatchId] = useState<number | null>(null);

  const { data: delivery, isLoading, error } = useQuery<DeliveryDetail>({
    queryKey: deliveryKeys.detail(deliveryId || ""),
    enabled: !!deliveryId,
    refetchInterval: 15000,
  });

  const statusMutation = useMutation({
    mutationFn: async (newStatus: "picked_up" | "on_the_way" | "delivered") => {
      return apiRequest("/api/driver/food-delivery/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryId, status: newStatus }),
      });
    },
    onSuccess: (_, newStatus) => {
      const messages: Record<string, { title: string; description: string }> = {
        picked_up: { title: "Order Picked Up", description: "Navigate to the customer location" },
        on_the_way: { title: "On the Way", description: "Drive safely to the customer" },
        delivered: { title: "Delivery Complete!", description: "Earnings added to your wallet" },
      };
      toast(messages[newStatus]);
      queryClient.invalidateQueries({ queryKey: deliveryKeys.detail(deliveryId || "") });
      queryClient.invalidateQueries({ queryKey: deliveryKeys.active });
      
      if (newStatus === "delivered") {
        queryClient.invalidateQueries({ 
          predicate: (query) => 
            typeof query.queryKey[0] === 'string' && 
            query.queryKey[0].startsWith('/api/driver/food-delivery/history')
        });
        setTimeout(() => navigate("/driver/food-deliveries"), 2000);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const locationMutation = useMutation({
    mutationFn: async ({ lat, lng }: { lat: number; lng: number }) => {
      return apiRequest("/api/driver/food-delivery/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      });
    },
  });

  const sendLocationUpdate = useCallback((position: GeolocationPosition) => {
    locationMutation.mutate({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    });
  }, [locationMutation]);

  useEffect(() => {
    if (delivery && ["accepted", "picked_up", "on_the_way"].includes(delivery.status)) {
      if (!locationWatchId && navigator.geolocation) {
        const watchId = navigator.geolocation.watchPosition(
          sendLocationUpdate,
          (error) => console.error("Location error:", error),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
        );
        setLocationWatchId(watchId);
      }
    }

    return () => {
      if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
      }
    };
  }, [delivery?.status, locationWatchId, sendLocationUpdate]);

  const handleStatusUpdate = (newStatus: "picked_up" | "on_the_way" | "delivered") => {
    const labels: Record<string, string> = {
      picked_up: "picked up the order",
      on_the_way: "started delivery",
      delivered: "completed the delivery",
    };
    setConfirmDialog({ open: true, status: newStatus, label: labels[newStatus] });
  };

  const confirmStatusUpdate = () => {
    if (confirmDialog) {
      statusMutation.mutate(confirmDialog.status);
      setConfirmDialog(null);
    }
  };

  const openNavigation = (lat: number | null, lng: number | null, address: string) => {
    if (lat && lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
    } else {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, "_blank");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error || !delivery) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h3 className="font-medium mb-2">Delivery Not Found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This delivery may have been cancelled or reassigned.
            </p>
            <Link href="/driver/food-deliveries">
              <Button>Back to Deliveries</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStatus = statusConfig[delivery.status] || statusConfig.accepted;
  const isComplete = delivery.status === "delivered";

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="p-4">
          <div className="flex items-center gap-3">
            <Link href="/driver/food-deliveries">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="font-semibold" data-testid="text-delivery-title">
                {delivery.restaurant?.name || "Food Delivery"}
              </h1>
              <p className="text-sm text-muted-foreground">
                Order #{delivery.orderCode || delivery.id.slice(0, 8)}
              </p>
            </div>
            <Badge variant={isComplete ? "default" : "secondary"}>
              {currentStatus.label}
            </Badge>
          </div>
        </div>

        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium">{currentStatus.sublabel}</span>
          </div>
          <Progress value={currentStatus.progress} className="h-2" />
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-4 w-4 text-orange-500" />
              Restaurant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium" data-testid="text-restaurant-name">
                  {delivery.restaurant?.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {delivery.pickupAddress || delivery.restaurant?.address}
                </p>
              </div>
              <div className="flex gap-2">
                {delivery.restaurant?.phone && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(`tel:${delivery.restaurant?.phone}`, "_self")}
                    data-testid="button-call-restaurant"
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => openNavigation(delivery.pickupLat, delivery.pickupLng, delivery.pickupAddress)}
                  data-testid="button-navigate-restaurant"
                >
                  <Navigation className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-blue-500" />
              Customer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>
                    {delivery.customer?.name?.charAt(0) || "C"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium" data-testid="text-customer-name">
                    {delivery.customer?.name || "Customer"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {delivery.dropoffAddress}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {delivery.customer?.phone && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(`tel:${delivery.customer?.phone}`, "_self")}
                    data-testid="button-call-customer"
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => openNavigation(delivery.dropoffLat, delivery.dropoffLng, delivery.dropoffAddress)}
                  data-testid="button-navigate-customer"
                >
                  <Navigation className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {delivery.deliveryNotesForDriver && (
              <div className="bg-muted p-3 rounded-md">
                <div className="flex items-center gap-2 text-sm font-medium mb-1">
                  <MessageSquare className="h-4 w-4" />
                  Delivery Instructions
                </div>
                <p className="text-sm text-muted-foreground" data-testid="text-delivery-notes">
                  {delivery.deliveryNotesForDriver}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {delivery.items && delivery.items.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-purple-500" />
                Order Items ({delivery.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {delivery.items.map((item, index) => (
                  <div 
                    key={item.id || index} 
                    className="flex items-start justify-between py-2 border-b last:border-0"
                    data-testid={`item-${item.id || index}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="font-medium text-sm bg-muted px-2 py-0.5 rounded">
                        {item.quantity}x
                      </span>
                      <div>
                        <p className="font-medium text-sm">{item.name}</p>
                        {item.modifiers && item.modifiers.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {item.modifiers.map(m => m.name).join(", ")}
                          </p>
                        )}
                        {item.specialInstructions && (
                          <p className="text-xs text-orange-600 mt-0.5">
                            Note: {item.specialInstructions}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {delivery.paymentMethod === "cash" ? (
                  <>
                    <Banknote className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Cash Payment</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">Paid Online</span>
                  </>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Your Earnings</p>
                <p className="text-xl font-bold text-green-600" data-testid="text-earnings">
                  ${delivery.estimatedPayout.toFixed(2)}
                </p>
              </div>
            </div>
            {delivery.paymentMethod === "cash" && (
              <p className="text-sm text-orange-600 mt-2 bg-orange-50 dark:bg-orange-900/20 p-2 rounded">
                Customer will pay cash on delivery
              </p>
            )}
          </CardContent>
        </Card>

        {delivery.status === "delivered" && (
          <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-600 mb-3" />
              <h3 className="font-semibold text-green-700 dark:text-green-400">
                Delivery Complete!
              </h3>
              <p className="text-sm text-green-600 dark:text-green-500 mb-4">
                ${delivery.estimatedPayout.toFixed(2)} added to your earnings
              </p>
              <Link href="/driver/food-deliveries">
                <Button variant="outline" data-testid="button-back-to-deliveries">
                  Back to Deliveries
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {!isComplete && currentStatus.nextStatus && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
          <Button
            className="w-full h-12 text-base"
            onClick={() => handleStatusUpdate(currentStatus.nextStatus!)}
            disabled={statusMutation.isPending}
            data-testid="button-next-status"
          >
            {statusMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <ArrowRight className="h-5 w-5 mr-2" />
            )}
            {currentStatus.nextAction}
          </Button>
        </div>
      )}

      <AlertDialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Status Update</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark that you have {confirmDialog?.label}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-status">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusUpdate} data-testid="button-confirm-status">
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
