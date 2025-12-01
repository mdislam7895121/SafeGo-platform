import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Clock,
  CheckCircle2,
  Package,
  Truck,
  ChefHat,
  User,
  DollarSign,
  MapPin,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ordersKeys } from "@/lib/queryKeys";
import { format } from "date-fns";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function LiveOrders() {
  const { toast } = useToast();
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const { data: liveData, isLoading } = useQuery({
    queryKey: ordersKeys.live(),
    queryFn: () => apiRequest("/api/restaurant/orders/live"),
    refetchInterval: 15000, // Reduced for memory efficiency
  });

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      return await apiRequest(`/api/restaurant/orders/${orderId}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ordersKeys.all });
      toast({
        title: "Success",
        description: "Order status updated successfully",
      });
      setSelectedOrder(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update order status",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      </div>
    );
  }

  const board = liveData?.board || {
    placed: [],
    accepted: [],
    preparing: [],
    ready_for_pickup: [],
    picked_up: [],
    on_the_way: [],
  };

  const columns = [
    {
      key: "placed",
      title: "New Orders",
      icon: Package,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
      orders: board.placed,
      nextStatuses: ["accepted"],
    },
    {
      key: "accepted",
      title: "Accepted",
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950",
      orders: board.accepted,
      nextStatuses: ["preparing"],
    },
    {
      key: "preparing",
      title: "Preparing",
      icon: ChefHat,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950",
      orders: board.preparing,
      nextStatuses: ["ready_for_pickup"],
    },
    {
      key: "ready_for_pickup",
      title: "Ready",
      icon: Clock,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950",
      orders: board.ready_for_pickup,
      nextStatuses: ["picked_up"],
    },
    {
      key: "picked_up",
      title: "Picked Up",
      icon: Truck,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50 dark:bg-indigo-950",
      orders: board.picked_up,
      nextStatuses: ["on_the_way"],
    },
    {
      key: "on_the_way",
      title: "Out for Delivery",
      icon: MapPin,
      color: "text-pink-600",
      bgColor: "bg-pink-50 dark:bg-pink-950",
      orders: board.on_the_way,
      nextStatuses: ["delivered"],
    },
  ];

  const totalActiveOrders = Object.values(board).flat().length;

  const formatStatus = (status: string) => {
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            Live Orders Board
          </h1>
          <p className="text-muted-foreground mt-1">
            {totalActiveOrders} active {totalActiveOrders === 1 ? "order" : "orders"} • Updates every 5 seconds
          </p>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {columns.map((column) => (
          <Card key={column.key} className={column.bgColor}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <column.icon className={`h-5 w-5 ${column.color}`} />
                  <span>{column.title}</span>
                </div>
                <Badge variant="secondary" data-testid={`badge-${column.key}-count`}>
                  {column.orders.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-300px)]">
                <div className="space-y-3">
                  {column.orders.length === 0 ? (
                    <div className="text-center py-8">
                      <column.icon className="h-12 w-12 mx-auto mb-2 text-muted-foreground opacity-20" />
                      <p className="text-sm text-muted-foreground">No orders</p>
                    </div>
                  ) : (
                    column.orders.map((order: any) => (
                      <Card
                        key={order.id}
                        className="hover-elevate cursor-pointer"
                        onClick={() => setSelectedOrder(order)}
                        data-testid={`order-card-${order.id}`}
                      >
                        <CardContent className="p-4 space-y-2">
                          {/* Order ID */}
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sm font-medium">
                              #{order.id.substring(0, 8)}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {order.orderType === "delivery" ? "Delivery" : "Pickup"}
                            </Badge>
                          </div>

                          {/* Customer */}
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span className="truncate">
                              {order.customer?.user?.email?.substring(0, 10)}...
                            </span>
                          </div>

                          {/* Time */}
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{format(new Date(order.createdAt), "hh:mm a")}</span>
                          </div>

                          {/* Amount */}
                          <div className="flex items-center justify-between pt-2 border-t">
                            <div className="flex items-center gap-1 text-sm font-medium">
                              <DollarSign className="h-3 w-3" />
                              {Number(order.totalAmount).toFixed(2)}
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {order.items?.length || 0} items
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Order Details Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Order #{selectedOrder?.id?.substring(0, 8)}</DialogTitle>
            <DialogDescription>
              {selectedOrder && format(new Date(selectedOrder.createdAt), "MMM dd, yyyy hh:mm a")}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              {/* Status */}
              <div>
                <h4 className="font-semibold mb-2">Current Status</h4>
                <Badge variant="secondary" className="text-base px-4 py-2">
                  {formatStatus(selectedOrder.status)}
                </Badge>
              </div>

              {/* Items */}
              <div>
                <h4 className="font-semibold mb-2">Order Items</h4>
                <div className="space-y-2">
                  {selectedOrder.items?.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between gap-4 p-3 bg-muted rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-semibold">
                        ${Number(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="flex items-center justify-between pt-3 border-t">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold text-primary">
                  ${Number(selectedOrder.totalAmount).toFixed(2)}
                </span>
              </div>

              {/* Status Update Actions */}
              <div>
                <h4 className="font-semibold mb-3">Update Status</h4>
                <div className="flex flex-wrap gap-2">
                  {columns
                    .find((col) => col.key === selectedOrder.status)
                    ?.nextStatuses.map((nextStatus) => (
                      <Button
                        key={nextStatus}
                        onClick={() =>
                          updateStatusMutation.mutate({
                            orderId: selectedOrder.id,
                            status: nextStatus,
                          })
                        }
                        disabled={updateStatusMutation.isPending}
                        data-testid={`button-status-${nextStatus}`}
                      >
                        {updateStatusMutation.isPending ? "Updating..." : formatStatus(nextStatus)}
                      </Button>
                    ))}
                  <Button
                    variant="destructive"
                    onClick={() =>
                      updateStatusMutation.mutate({
                        orderId: selectedOrder.id,
                        status: "cancelled_restaurant",
                      })
                    }
                    disabled={updateStatusMutation.isPending}
                    data-testid="button-cancel-order"
                  >
                    Cancel Order
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
