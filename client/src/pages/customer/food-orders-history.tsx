import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  ArrowLeft, 
  Star, 
  UtensilsCrossed, 
  Calendar, 
  CheckCircle, 
  RotateCcw, 
  Loader2, 
  Receipt, 
  XCircle,
  Clock,
  ChevronRight,
  Store,
} from "lucide-react";
import { CustomerHomeButton, BackToRestaurantsButton } from "@/components/customer/EatsNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ReviewSubmissionDialog } from "@/components/customer/ReviewSubmissionDialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useEatsCart } from "@/contexts/EatsCartContext";
import { computeOrderTotals } from "@/lib/foodOrderUtils";

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  menuItemId: string;
}

interface DriverInfo {
  id: string;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  vehicle: {
    make: string;
    model: string;
    color: string | null;
    plate: string | null;
  } | null;
}

interface FoodOrder {
  id: string;
  orderCode: string | null;
  restaurantId: string;
  restaurantName: string;
  restaurantAddress: string | null;
  restaurantCuisine: string | null;
  restaurantLogo: string | null;
  deliveryAddress: string;
  items: OrderItem[];
  itemsCount: number;
  subtotal: number | null;
  deliveryFee: number | null;
  serviceFare: number;
  taxAmount: number | null;
  tipAmount: number | null;
  discountAmount: number | null;
  promoCode: string | null;
  status: string;
  paymentMethod: string;
  createdAt: string;
  acceptedAt: string | null;
  preparingAt: string | null;
  readyAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  hasReview: boolean;
  driver: DriverInfo | null;
}

interface FoodOrdersResponse {
  orders: FoodOrder[];
  total: number;
}

interface ReorderData {
  items: OrderItem[];
  restaurant: {
    id: string;
    name: string;
    deliveryFee: number;
    minOrderAmount: number;
  };
}

function formatOrderDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays === 1) {
    return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
    });
  }
}

function getOrderTotal(order: FoodOrder): number {
  return computeOrderTotals(order).total;
}

function OrderCard({ 
  order, 
  onReview, 
  onReorder,
  isReordering 
}: { 
  order: FoodOrder; 
  onReview: () => void;
  onReorder: () => void;
  isReordering: boolean;
}) {
  const isDelivered = order.status.toLowerCase() === 'delivered';
  const isCancelled = order.status.toLowerCase() === 'cancelled';
  const total = getOrderTotal(order);
  const itemsPreview = order.items.slice(0, 2).map(item => `${item.quantity}x ${item.name}`).join(', ');
  const moreItems = order.items.length > 2 ? ` +${order.items.length - 2} more` : '';

  return (
    <Card className="hover-elevate overflow-hidden" data-testid={`card-order-${order.id}`}>
      <CardContent className="p-0">
        <Link href={`/customer/food-orders/${order.id}/receipt`}>
          <div className="flex p-4 gap-4 cursor-pointer">
            <Avatar className="h-16 w-16 rounded-xl flex-shrink-0">
              {order.restaurantLogo ? (
                <AvatarImage src={order.restaurantLogo} alt={order.restaurantName} className="object-cover" />
              ) : null}
              <AvatarFallback className="rounded-xl bg-primary/10 text-primary">
                <Store className="h-8 w-8" />
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base truncate" data-testid={`text-restaurant-name-${order.id}`}>
                    {order.restaurantName}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate" data-testid={`text-items-preview-${order.id}`}>
                    {itemsPreview}{moreItems}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              </div>
              
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="text-lg font-bold" data-testid={`text-total-${order.id}`}>
                  ${total.toFixed(2)}
                </span>
                {isDelivered && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" data-testid={`badge-status-${order.id}`}>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Delivered
                  </Badge>
                )}
                {isCancelled && (
                  <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" data-testid={`badge-status-${order.id}`}>
                    <XCircle className="h-3 w-3 mr-1" />
                    Cancelled
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span data-testid={`text-order-date-${order.id}`}>
                  {formatOrderDate(order.createdAt)}
                </span>
                {order.orderCode && (
                  <>
                    <span className="opacity-50">•</span>
                    <span className="font-mono">#{order.orderCode.slice(0, 8)}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </Link>
        
        {isDelivered && (
          <>
            <Separator />
            <div className="flex p-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={(e) => {
                  e.preventDefault();
                  onReorder();
                }}
                disabled={isReordering}
                data-testid={`button-reorder-${order.id}`}
              >
                {isReordering ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-2" />
                )}
                Reorder
              </Button>
              
              {order.hasReview ? (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 px-3">
                  <Star className="h-4 w-4 fill-current" />
                  <span data-testid={`text-reviewed-${order.id}`}>Reviewed</span>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={(e) => {
                    e.preventDefault();
                    onReview();
                  }}
                  data-testid={`button-leave-review-${order.id}`}
                >
                  <Star className="h-4 w-4 mr-2" />
                  Review
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function FoodOrdersHistory() {
  const [selectedOrderForReview, setSelectedOrderForReview] = useState<FoodOrder | null>(null);
  const [orderToReorder, setOrderToReorder] = useState<FoodOrder | null>(null);
  const [reorderConfirmOpen, setReorderConfirmOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "delivered" | "cancelled">("all");
  const [, setLocationPath] = useLocation();
  const { toast } = useToast();
  const { setCartFromReorder, isFromDifferentRestaurant, state: cartState } = useEatsCart();

  const { data, isLoading, refetch } = useQuery<FoodOrdersResponse>({
    queryKey: ["/api/customer/food-orders"],
    retry: 1,
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return apiRequest(`/api/customer/food/orders/${orderId}/reorder`, { method: 'GET' }) as Promise<ReorderData>;
    },
    onSuccess: (data) => {
      if (data.items && data.restaurant) {
        setCartFromReorder(data.restaurant, data.items);
        toast({
          title: "Items added to cart",
          description: `${data.items.length} item(s) from ${data.restaurant.name} added to your cart`,
        });
        setLocationPath("/customer/food/checkout");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Reorder failed",
        description: error.message || "Could not reorder. Some items may no longer be available.",
        variant: "destructive",
      });
    },
  });

  const handleReorder = (order: FoodOrder) => {
    if (cartState.items.length > 0 && isFromDifferentRestaurant(order.restaurantId)) {
      setOrderToReorder(order);
      setReorderConfirmOpen(true);
    } else {
      reorderMutation.mutate(order.id);
    }
  };

  const confirmReorder = () => {
    if (orderToReorder) {
      reorderMutation.mutate(orderToReorder.id);
    }
    setReorderConfirmOpen(false);
    setOrderToReorder(null);
  };

  const orders = data?.orders || [];
  
  const filteredOrders = orders.filter(order => {
    const status = order.status.toLowerCase();
    if (activeTab === "delivered") return status === "delivered";
    if (activeTab === "cancelled") return status === "cancelled";
    return true;
  });

  const deliveredCount = orders.filter(o => o.status.toLowerCase() === 'delivered').length;
  const cancelledCount = orders.filter(o => o.status.toLowerCase() === 'cancelled').length;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg sticky top-0 z-10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <BackToRestaurantsButton 
              variant="ghost" 
              size="sm" 
              className="text-primary-foreground"
            />
            <div>
              <h1 className="text-2xl font-bold">Order History</h1>
              <p className="text-sm opacity-90">{orders.length} orders</p>
            </div>
          </div>
          <CustomerHomeButton 
            variant="ghost" 
            size="sm" 
            className="text-primary-foreground"
          />
        </div>
      </header>

      <div className="p-4 max-w-2xl mx-auto">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="mb-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all" data-testid="tab-all">
              All ({orders.length})
            </TabsTrigger>
            <TabsTrigger value="delivered" data-testid="tab-delivered">
              Delivered ({deliveredCount})
            </TabsTrigger>
            <TabsTrigger value="cancelled" data-testid="tab-cancelled">
              Cancelled ({cancelledCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-3">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <Skeleton className="h-16 w-16 rounded-xl flex-shrink-0" />
                    <div className="flex-1">
                      <Skeleton className="h-5 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2 mb-2" />
                      <Skeleton className="h-4 w-1/3" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : filteredOrders.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <UtensilsCrossed className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {activeTab === "all" ? "No orders yet" : `No ${activeTab} orders`}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {activeTab === "all" 
                    ? "Your food orders will appear here" 
                    : `Orders that are ${activeTab} will appear here`}
                </p>
                {activeTab === "all" && (
                  <Link href="/customer/food">
                    <Button data-testid="button-browse-restaurants">
                      Browse Restaurants
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onReview={() => setSelectedOrderForReview(order)}
                onReorder={() => handleReorder(order)}
                isReordering={reorderMutation.isPending}
              />
            ))
          )}
        </div>
      </div>

      {selectedOrderForReview && (
        <ReviewSubmissionDialog
          open={!!selectedOrderForReview}
          onOpenChange={(open) => !open && setSelectedOrderForReview(null)}
          orderId={selectedOrderForReview.id}
          restaurantName={selectedOrderForReview.restaurantName}
          onSuccess={() => refetch()}
        />
      )}

      <AlertDialog open={reorderConfirmOpen} onOpenChange={setReorderConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new order?</AlertDialogTitle>
            <AlertDialogDescription>
              You have items from {cartState.restaurant?.name} in your cart. 
              Reordering from {orderToReorder?.restaurantName} will replace your current cart.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-reorder">Keep current cart</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReorder} data-testid="button-confirm-reorder">
              Start new order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
