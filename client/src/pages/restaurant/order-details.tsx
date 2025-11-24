import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { ArrowLeft, Clock, MapPin, User, Package, DollarSign, Check, X, ChefHat, Truck, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ordersKeys } from "@/lib/queryKeys";
import { format } from "date-fns";
import { useState } from "react";

const STATUS_COLORS: Record<string, string> = {
  placed: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  accepted: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
  preparing: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  ready_for_pickup: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  picked_up: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
  on_the_way: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800",
  delivered: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  cancelled_restaurant: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
  cancelled_customer: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
  cancelled_admin: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  placed: "Order Placed",
  accepted: "Accepted",
  preparing: "Preparing",
  ready_for_pickup: "Ready for Pickup",
  picked_up: "Picked Up",
  on_the_way: "On the Way",
  delivered: "Delivered",
  completed: "Completed",
  cancelled_restaurant: "Cancelled by Restaurant",
  cancelled_customer: "Cancelled by Customer",
  cancelled_admin: "Cancelled by Admin",
};

interface TimelineEvent {
  label: string;
  timestamp: string | null;
  icon: any;
  status: "completed" | "current" | "upcoming" | "cancelled";
}

export default function RestaurantOrderDetails() {
  const { orderId } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => void;
  }>({
    open: false,
    title: "",
    description: "",
    action: () => {},
  });

  // Fetch order details
  const { data, isLoading } = useQuery({
    queryKey: ordersKeys.detail(orderId || ""),
    queryFn: () => apiRequest(`/api/restaurant/orders/${orderId}`),
    enabled: !!orderId,
  });

  const order = data?.order;

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      return await apiRequest(`/api/restaurant/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      // Invalidate all order-related queries to refresh list, details, overview, and live board
      queryClient.invalidateQueries({ queryKey: ordersKeys.all });
      toast({
        title: "Success",
        description: "Order status updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update order status",
        variant: "destructive",
      });
    },
  });

  const handleStatusUpdate = (status: string, title: string, description: string) => {
    setConfirmDialog({
      open: true,
      title,
      description,
      action: () => {
        updateStatusMutation.mutate(status);
        setConfirmDialog({ ...confirmDialog, open: false });
      },
    });
  };

  // Loading state - initial fetch
  if (isLoading) {
    return (
      <div className="min-h-screen p-4 md:p-6 space-y-6">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-96" />
            <Skeleton className="h-64" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  // Not found state - fetch completed but no order (404 or permission denied)
  if (!isLoading && !order) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Order Not Found
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The order you're looking for doesn't exist or you don't have permission to view it.
            </p>
            <Button asChild className="w-full" data-testid="button-back-to-orders">
              <Link href="/restaurant/orders">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Orders
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Items are already parsed by the backend
  const items = order.items || [];
  const timeline = buildTimeline(order);

  // Action button visibility
  const canAccept = order.status === "placed";
  const canReject = ["placed", "accepted"].includes(order.status);
  const canStartPreparing = order.status === "accepted";
  const canMarkReady = order.status === "preparing";
  const canMarkPickedUp = order.status === "ready_for_pickup";

  const isCompleted = ["delivered", "completed", "cancelled_restaurant", "cancelled_customer", "cancelled_admin"].includes(order.status);

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/restaurant/orders")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-order-id">
              Order #{order.orderCode || order.id}
            </h1>
            <p className="text-sm text-muted-foreground" data-testid="text-placed-time">
              Placed {format(new Date(order.createdAt), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
        </div>
        <Badge
          className={`${STATUS_COLORS[order.status] || ""} border px-3 py-1 text-sm font-medium`}
          data-testid="badge-status"
        >
          {STATUS_LABELS[order.status] || order.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Delivery Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer & Delivery Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Customer</p>
                  <p className="text-base" data-testid="text-customer-name">
                    {order.customer?.user?.name || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Payment Method</p>
                  <p className="text-base capitalize" data-testid="text-payment-method">
                    {order.paymentMethod?.replace(/_/g, " ") || "N/A"}
                  </p>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Delivery Address
                </p>
                <p className="text-base mt-1" data-testid="text-delivery-address">
                  {order.deliveryAddress || "N/A"}
                </p>
              </div>
              {order.pickupAddress && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pickup Location</p>
                    <p className="text-base mt-1" data-testid="text-pickup-address">
                      {order.pickupAddress}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Items ({items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {items.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex justify-between items-start gap-4 pb-3 border-b last:border-0 last:pb-0"
                    data-testid={`item-${idx}`}
                  >
                    <div className="flex-1">
                      <p className="font-medium" data-testid={`text-item-name-${idx}`}>
                        {item.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Qty: {item.quantity || 1}
                      </p>
                    </div>
                    <p className="font-medium" data-testid={`text-item-total-${idx}`}>
                      ${((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span data-testid="text-subtotal">${order.subtotal?.toFixed(2) || "0.00"}</span>
                </div>
                {order.deliveryFee && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivery Fee</span>
                    <span data-testid="text-delivery-fee">${order.deliveryFee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">SafeGo Fee</span>
                  <span className="text-red-600 dark:text-red-400" data-testid="text-safego-fee">
                    -${order.safegoCommission?.toFixed(2) || "0.00"}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold text-base">
                  <span>Your Payout</span>
                  <span className="text-green-600 dark:text-green-400" data-testid="text-restaurant-payout">
                    ${order.restaurantPayout?.toFixed(2) || "0.00"}
                  </span>
                </div>
                <div className="flex justify-between font-semibold text-base">
                  <span>Customer Total</span>
                  <span data-testid="text-service-fare">
                    ${order.serviceFare?.toFixed(2) || "0.00"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Timeline & Actions - Right Column */}
        <div className="space-y-6">
          {/* Status Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Order Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative space-y-6">
                {timeline.map((event, idx) => (
                  <div key={idx} className="relative flex gap-3" data-testid={`timeline-event-${idx}`}>
                    {/* Connector Line */}
                    {idx < timeline.length - 1 && (
                      <div
                        className={`absolute left-[15px] top-8 w-0.5 h-full ${
                          event.status === "completed" ? "bg-primary" : "bg-border"
                        }`}
                      />
                    )}

                    {/* Icon */}
                    <div
                      className={`relative z-10 flex items-center justify-center h-8 w-8 rounded-full border-2 ${
                        event.status === "completed"
                          ? "bg-primary border-primary text-primary-foreground"
                          : event.status === "cancelled"
                          ? "bg-destructive/10 border-destructive text-destructive"
                          : "bg-background border-border text-muted-foreground"
                      }`}
                    >
                      <event.icon className="h-4 w-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 pt-0.5">
                      <p
                        className={`font-medium ${
                          event.status === "completed"
                            ? "text-foreground"
                            : event.status === "cancelled"
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        {event.label}
                      </p>
                      {event.timestamp && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(event.timestamp), "MMM d, h:mm a")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          {!isCompleted && (
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {canAccept && (
                  <Button
                    className="w-full"
                    onClick={() =>
                      handleStatusUpdate(
                        "accepted",
                        "Accept Order",
                        "Are you sure you want to accept this order? This will notify the customer."
                      )
                    }
                    disabled={updateStatusMutation.isPending}
                    data-testid="button-accept"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Accept Order
                  </Button>
                )}

                {canStartPreparing && (
                  <Button
                    className="w-full"
                    onClick={() =>
                      handleStatusUpdate(
                        "preparing",
                        "Start Preparing",
                        "Mark this order as being prepared?"
                      )
                    }
                    disabled={updateStatusMutation.isPending}
                    data-testid="button-preparing"
                  >
                    <ChefHat className="h-4 w-4 mr-2" />
                    Start Preparing
                  </Button>
                )}

                {canMarkReady && (
                  <Button
                    className="w-full"
                    onClick={() =>
                      handleStatusUpdate(
                        "ready_for_pickup",
                        "Mark Ready",
                        "Mark this order as ready for pickup? This will notify the driver."
                      )
                    }
                    disabled={updateStatusMutation.isPending}
                    data-testid="button-ready"
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Mark Ready for Pickup
                  </Button>
                )}

                {canMarkPickedUp && (
                  <Button
                    className="w-full"
                    onClick={() =>
                      handleStatusUpdate(
                        "picked_up",
                        "Mark Picked Up",
                        "Confirm that the driver has picked up this order?"
                      )
                    }
                    disabled={updateStatusMutation.isPending}
                    data-testid="button-picked-up"
                  >
                    <Truck className="h-4 w-4 mr-2" />
                    Mark Picked Up
                  </Button>
                )}

                {canReject && (
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() =>
                      handleStatusUpdate(
                        "cancelled_restaurant",
                        "Reject Order",
                        "Are you sure you want to reject this order? This action cannot be undone."
                      )
                    }
                    disabled={updateStatusMutation.isPending}
                    data-testid="button-reject"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject Order
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Cancellation Info */}
          {order.whoCancelled && (
            <Card>
              <CardHeader>
                <CardTitle className="text-destructive flex items-center gap-2">
                  <XCircle className="h-5 w-5" />
                  Cancellation Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Cancelled By</p>
                  <p className="text-base capitalize">{order.whoCancelled}</p>
                </div>
                {order.cancellationReason && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Reason</p>
                      <p className="text-base">{order.cancellationReason}</p>
                    </div>
                  </>
                )}
                {order.cancelledAt && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Time</p>
                      <p className="text-base">
                        {format(new Date(order.cancelledAt), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-confirm">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDialog.action} data-testid="button-confirm-action">
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function buildTimeline(order: any): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Order Placed
  events.push({
    label: "Order Placed",
    timestamp: order.createdAt,
    icon: CheckCircle2,
    status: "completed",
  });

  // Check if cancelled
  if (order.cancelledAt) {
    events.push({
      label: `Cancelled by ${order.whoCancelled || "unknown"}`,
      timestamp: order.cancelledAt,
      icon: XCircle,
      status: "cancelled",
    });
    return events;
  }

  // Accepted
  events.push({
    label: "Accepted by Restaurant",
    timestamp: order.acceptedAt,
    icon: Check,
    status: order.acceptedAt ? "completed" : order.status === "placed" ? "upcoming" : "current",
  });

  // Preparing
  events.push({
    label: "Preparing",
    timestamp: order.preparingAt,
    icon: ChefHat,
    status: order.preparingAt
      ? "completed"
      : ["placed", "accepted"].includes(order.status)
      ? "upcoming"
      : order.status === "preparing"
      ? "current"
      : "upcoming",
  });

  // Ready for Pickup
  events.push({
    label: "Ready for Pickup",
    timestamp: order.readyAt,
    icon: Package,
    status: order.readyAt
      ? "completed"
      : ["placed", "accepted", "preparing"].includes(order.status)
      ? "upcoming"
      : order.status === "ready_for_pickup"
      ? "current"
      : "upcoming",
  });

  // Picked Up
  events.push({
    label: "Picked Up by Driver",
    timestamp: order.pickedUpAt,
    icon: Truck,
    status: order.pickedUpAt
      ? "completed"
      : ["placed", "accepted", "preparing", "ready_for_pickup"].includes(order.status)
      ? "upcoming"
      : order.status === "picked_up"
      ? "current"
      : "upcoming",
  });

  // On the Way
  if (order.status === "on_the_way" || order.deliveredAt || order.completedAt) {
    events.push({
      label: "On the Way",
      timestamp: null,
      icon: Truck,
      status: order.deliveredAt || order.completedAt ? "completed" : order.status === "on_the_way" ? "current" : "upcoming",
    });
  }

  // Delivered/Completed
  events.push({
    label: "Delivered",
    timestamp: order.deliveredAt || order.completedAt,
    icon: CheckCircle2,
    status:
      order.deliveredAt || order.completedAt
        ? "completed"
        : ["delivered", "completed"].includes(order.status)
        ? "current"
        : "upcoming",
  });

  return events;
}
