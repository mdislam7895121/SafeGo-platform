import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import {
  UtensilsCrossed,
  MapPin,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  RefreshCw,
  Navigation,
  User,
  Store,
  AlertCircle,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

interface FoodDelivery {
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
  customerName?: string;
  customer?: {
    id: string;
    name: string;
    phone: string | null;
  };
  createdAt: string;
  acceptedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  deliveryNotesForDriver?: string | null;
}

interface PendingDeliveriesResponse {
  deliveries: FoodDelivery[];
  count: number;
}

interface ActiveDeliveriesResponse {
  deliveries: FoodDelivery[];
  count: number;
}

interface HistoryDeliveriesResponse {
  deliveries: FoodDelivery[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const deliveryKeys = {
  pending: ["/api/driver/food-delivery/pending"],
  active: ["/api/driver/food-delivery/active"],
  history: ["/api/driver/food-delivery/history"],
};

export default function DriverFoodDeliveries() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("new");
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "accept" | "reject";
    deliveryId: string;
    restaurantName: string;
  } | null>(null);

  const { data: pendingData, isLoading: pendingLoading, refetch: refetchPending } = useQuery<PendingDeliveriesResponse>({
    queryKey: deliveryKeys.pending,
    refetchInterval: 5000,
  });

  const { data: activeData, isLoading: activeLoading, refetch: refetchActive } = useQuery<ActiveDeliveriesResponse>({
    queryKey: deliveryKeys.active,
    refetchInterval: 3000,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery<HistoryDeliveriesResponse>({
    queryKey: deliveryKeys.history,
  });

  const acceptMutation = useMutation({
    mutationFn: async (deliveryId: string) => {
      return apiRequest("/api/driver/food-delivery/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryId }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Delivery Accepted",
        description: "Navigate to the restaurant for pickup",
      });
      queryClient.invalidateQueries({ queryKey: deliveryKeys.pending });
      queryClient.invalidateQueries({ queryKey: deliveryKeys.active });
      setActiveTab("active");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Accept",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (deliveryId: string) => {
      return apiRequest("/api/driver/food-delivery/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryId }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Delivery Rejected",
        description: "The delivery has been passed to another driver",
      });
      queryClient.invalidateQueries({ queryKey: deliveryKeys.pending });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Reject",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleAccept = (deliveryId: string, restaurantName: string) => {
    setConfirmDialog({ open: true, type: "accept", deliveryId, restaurantName });
  };

  const handleReject = (deliveryId: string, restaurantName: string) => {
    setConfirmDialog({ open: true, type: "reject", deliveryId, restaurantName });
  };

  const confirmAction = () => {
    if (!confirmDialog) return;
    
    if (confirmDialog.type === "accept") {
      acceptMutation.mutate(confirmDialog.deliveryId);
    } else {
      rejectMutation.mutate(confirmDialog.deliveryId);
    }
    setConfirmDialog(null);
  };

  const renderDeliveryCard = (delivery: FoodDelivery, showActions: boolean = false, isActive: boolean = false) => (
    <Card 
      key={delivery.id} 
      className="hover-elevate cursor-pointer"
      data-testid={`card-delivery-${delivery.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-orange-500" />
              <span className="font-medium" data-testid={`text-restaurant-${delivery.id}`}>
                {delivery.restaurant?.name || "Restaurant"}
              </span>
              {delivery.orderCode && (
                <Badge variant="outline" className="text-xs">
                  #{delivery.orderCode}
                </Badge>
              )}
            </div>

            <div className="space-y-1.5 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span className="line-clamp-1" data-testid={`text-pickup-${delivery.id}`}>
                  {delivery.pickupAddress || delivery.restaurant?.address}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Navigation className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <span className="line-clamp-1" data-testid={`text-dropoff-${delivery.id}`}>
                  {delivery.dropoffAddress}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="font-semibold text-green-600" data-testid={`text-payout-${delivery.id}`}>
                  ${delivery.estimatedPayout.toFixed(2)}
                </span>
              </div>
              {delivery.createdAt && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{format(new Date(delivery.createdAt), "h:mm a")}</span>
                </div>
              )}
            </div>
          </div>

          {isActive && (
            <Badge 
              variant={delivery.status === "accepted" ? "default" : delivery.status === "picked_up" ? "secondary" : "outline"}
              data-testid={`badge-status-${delivery.id}`}
            >
              {delivery.status === "accepted" ? "Go to Restaurant" :
               delivery.status === "picked_up" ? "Picked Up" :
               delivery.status === "on_the_way" ? "On the Way" : delivery.status}
            </Badge>
          )}
        </div>

        {showActions && (
          <div className="flex gap-2 mt-4 pt-3 border-t">
            <Button
              variant="outline"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                handleReject(delivery.id, delivery.restaurant?.name || "Restaurant");
              }}
              disabled={rejectMutation.isPending}
              data-testid={`button-reject-${delivery.id}`}
            >
              {rejectMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </>
              )}
            </Button>
            <Button
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                handleAccept(delivery.id, delivery.restaurant?.name || "Restaurant");
              }}
              disabled={acceptMutation.isPending}
              data-testid={`button-accept-${delivery.id}`}
            >
              {acceptMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Accept
                </>
              )}
            </Button>
          </div>
        )}

        {isActive && (
          <div className="mt-4 pt-3 border-t">
            <Link href={`/driver/food-delivery/${delivery.id}`}>
              <Button className="w-full" data-testid={`button-view-delivery-${delivery.id}`}>
                <UtensilsCrossed className="h-4 w-4 mr-2" />
                View Delivery Details
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderSkeleton = () => (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="flex gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="h-6 w-6 text-orange-500" />
              <h1 className="text-xl font-semibold" data-testid="text-page-title">Food Deliveries</h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                refetchPending();
                refetchActive();
              }}
              data-testid="button-refresh"
            >
              <RefreshCw className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3 mx-4 mb-4" style={{ width: 'calc(100% - 2rem)' }}>
            <TabsTrigger value="new" className="relative" data-testid="tab-new-requests">
              New Requests
              {(pendingData?.count || 0) > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {pendingData?.count}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="active" className="relative" data-testid="tab-active">
              Active
              {(activeData?.count || 0) > 0 && (
                <Badge variant="secondary" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {activeData?.count}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed">
              Completed
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="p-4 space-y-4">
        {activeTab === "new" && (
          <>
            {pendingLoading ? (
              renderSkeleton()
            ) : (pendingData?.deliveries?.length || 0) === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">No New Requests</h3>
                  <p className="text-sm text-muted-foreground">
                    New delivery requests will appear here when available
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3" data-testid="list-pending-deliveries">
                {pendingData?.deliveries.map((delivery) => renderDeliveryCard(delivery, true))}
              </div>
            )}
          </>
        )}

        {activeTab === "active" && (
          <>
            {activeLoading ? (
              renderSkeleton()
            ) : (activeData?.deliveries?.length || 0) === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <UtensilsCrossed className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">No Active Deliveries</h3>
                  <p className="text-sm text-muted-foreground">
                    Accept a delivery request to get started
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3" data-testid="list-active-deliveries">
                {activeData?.deliveries.map((delivery) => renderDeliveryCard(delivery, false, true))}
              </div>
            )}
          </>
        )}

        {activeTab === "completed" && (
          <>
            {historyLoading ? (
              renderSkeleton()
            ) : (historyData?.deliveries?.length || 0) === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">No Completed Deliveries</h3>
                  <p className="text-sm text-muted-foreground">
                    Your completed deliveries will appear here
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3" data-testid="list-completed-deliveries">
                {historyData?.deliveries.map((delivery) => (
                  <Card key={delivery.id} className="hover-elevate">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Store className="h-4 w-4 text-orange-500" />
                            <span className="font-medium">{delivery.restaurantName || "Restaurant"}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {delivery.deliveredAt && format(new Date(delivery.deliveredAt), "MMM d, yyyy h:mm a")}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-green-600">
                            ${delivery.earnings?.toFixed(2) || delivery.estimatedPayout?.toFixed(2)}
                          </div>
                          <Badge variant={delivery.status === "delivered" ? "default" : "destructive"}>
                            {delivery.status === "delivered" ? "Delivered" : "Cancelled"}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            
            {historyData && historyData.pagination.totalPages > 1 && (
              <div className="flex justify-center">
                <Link href="/driver/food-delivery/history">
                  <Button variant="outline" data-testid="button-view-all-history">
                    View All History
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            )}
          </>
        )}
      </div>

      <AlertDialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog?.type === "accept" ? "Accept Delivery?" : "Reject Delivery?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog?.type === "accept" 
                ? `You will pick up the order from ${confirmDialog?.restaurantName} and deliver it to the customer.`
                : `Are you sure you want to reject the delivery from ${confirmDialog?.restaurantName}? It will be offered to another driver.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-dialog">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmAction}
              className={confirmDialog?.type === "reject" ? "bg-destructive hover:bg-destructive/90" : ""}
              data-testid="button-confirm-dialog"
            >
              {confirmDialog?.type === "accept" ? "Accept" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
