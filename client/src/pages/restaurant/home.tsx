import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  UtensilsCrossed, 
  DollarSign, 
  Clock, 
  Settings, 
  Wallet,
  ShoppingBag,
  Star,
  TrendingUp,
  Info,
  MessageCircle,
  Menu as MenuIcon,
  Check,
  X,
  ChefHat,
  PackageCheck,
  Truck,
  CreditCard,
  MapPin
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

export default function RestaurantHome() {
  const { user, logout } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [rejectOrderId, setRejectOrderId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: restaurantData, isLoading } = useQuery({
    queryKey: ["/api/restaurant/home"],
    refetchInterval: 5000,
  });

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["/api/restaurant/orders"],
    refetchInterval: 10000, // Poll every 10 seconds for live updates
  });

  // Mutation for updating order status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      return await apiRequest(`/api/food-orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/home"] });
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const profile = (restaurantData as any)?.profile;
  const wallet = (restaurantData as any)?.wallet;
  const orders = ordersData?.orders || [];

  // Calculate KPIs
  const today = new Date().toDateString();
  const todayOrders = orders.filter((order: any) => 
    new Date(order.createdAt).toDateString() === today
  );
  const todayEarnings = todayOrders.reduce((sum: number, order: any) => 
    sum + Number(order.restaurantPayout || 0), 0
  );
  const liveOrders = orders.filter((order: any) => 
    !['delivered', 'cancelled', 'completed'].includes(order.status)
  );

  // Mock rating (to be replaced with real data)
  const avgRating = 4.5;
  const totalRatings = 0;

  // Helper functions
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'placed':
        return 'default';
      case 'accepted':
      case 'preparing':
        return 'secondary';
      case 'ready_for_pickup':
      case 'picked_up':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      placed: 'NEW',
      accepted: 'ACCEPTED',
      preparing: 'PREPARING',
      ready_for_pickup: 'READY',
      picked_up: 'OUT FOR DELIVERY',
      on_the_way: 'OUT FOR DELIVERY',
      delivered: 'DELIVERED',
      completed: 'COMPLETED',
    };
    return labels[status] || status.toUpperCase();
  };

  const getItemsSummary = (items: any) => {
    if (!items || !Array.isArray(items)) return 'No items';
    const totalItems = items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
    const preview = items.slice(0, 2).map((item: any) => 
      `${item.quantity || 1}x ${item.name}`
    ).join(', ');
    const remaining = items.length - 2;
    return `${totalItems} items · ${preview}${remaining > 0 ? `, +${remaining} more` : ''}`;
  };

  const handleAcceptOrder = (orderId: string) => {
    updateStatusMutation.mutate({ orderId, status: 'accepted' });
  };

  const handleRejectOrder = () => {
    if (rejectOrderId) {
      updateStatusMutation.mutate({ orderId: rejectOrderId, status: 'cancelled' });
      setRejectOrderId(null);
    }
  };

  const handleMarkPreparing = (orderId: string) => {
    updateStatusMutation.mutate({ orderId, status: 'preparing' });
  };

  const handleMarkReady = (orderId: string) => {
    updateStatusMutation.mutate({ orderId, status: 'ready_for_pickup' });
  };

  const handleMarkOutForDelivery = (orderId: string) => {
    updateStatusMutation.mutate({ orderId, status: 'picked_up' });
  };

  const handleMarkCompleted = (orderId: string) => {
    updateStatusMutation.mutate({ orderId, status: 'completed' });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* TOP HEADER - SafeGo Eats Branding */}
      <div className="bg-card border-b">
        <div className="container mx-auto p-4 lg:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Left Side - Restaurant Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <UtensilsCrossed className="h-8 w-8 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold" data-testid="text-restaurant-name">
                    {profile?.restaurantName || "Restaurant"}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>{profile?.address?.split(',')[1]?.trim() || "Location pending"}</span>
                    <span>•</span>
                    <span className="font-mono text-xs" data-testid="text-restaurant-id">
                      ID: {profile?.id?.substring(0, 8) || "—"}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Status Chip */}
              <Badge 
                variant={profile?.isVerified ? "default" : "secondary"}
                className="font-medium"
                data-testid="badge-verification-status"
              >
                {profile?.isVerified ? "✓ Verified & Active" : 
                 profile?.verificationStatus === 'pending' ? "Pending Verification" : 
                 "Inactive"}
              </Badge>
            </div>

            {/* Right Side - Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* Online/Offline Toggle */}
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-background">
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {isOnline ? "You're receiving orders" : "Not receiving orders right now"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isOnline ? "ONLINE" : "OFFLINE"}
                  </p>
                </div>
                <Switch 
                  checked={isOnline} 
                  onCheckedChange={setIsOnline}
                  data-testid="switch-online-status"
                />
              </div>

              {/* Logout Button */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={logout}
                data-testid="button-logout"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI SUMMARY ROW - 4 Cards */}
      <div className="container mx-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Today's Orders */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Today's Orders</p>
                  <p className="text-3xl font-bold" data-testid="text-today-orders">
                    {todayOrders.length || "—"}
                  </p>
                </div>
                <ShoppingBag className="h-8 w-8 text-primary opacity-20" />
              </div>
            </CardContent>
          </Card>

          {/* Today's Earnings */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Today's Earnings</p>
                  <p className="text-3xl font-bold text-green-600" data-testid="text-today-earnings">
                    {todayEarnings > 0 ? `$${todayEarnings.toFixed(2)}` : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">After SafeGo fees</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          {/* Active Orders */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Active Orders</p>
                  <p className="text-3xl font-bold text-orange-600" data-testid="text-active-orders">
                    {liveOrders.length || "—"}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          {/* Restaurant Rating */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Restaurant Rating</p>
                  {totalRatings > 0 ? (
                    <>
                      <div className="flex items-baseline gap-1">
                        <p className="text-3xl font-bold" data-testid="text-avg-rating">
                          {avgRating.toFixed(1)}
                        </p>
                        <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                      </div>
                      <p className="text-xs text-muted-foreground">{totalRatings} ratings</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground" data-testid="text-no-ratings">
                      No ratings yet
                    </p>
                  )}
                </div>
                <Star className="h-8 w-8 text-yellow-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* TWO-COLUMN LAYOUT SHELL */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN - Live Orders Area (2/3 width on desktop) */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Live Orders
                    {liveOrders.length > 0 && (
                      <Badge variant="default" className="ml-2">
                        {liveOrders.length}
                      </Badge>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {ordersLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-32 w-full" />
                    ))}
                  </div>
                ) : liveOrders.length > 0 ? (
                  <div className="space-y-3">
                    {liveOrders.map((order: any) => (
                      <div
                        key={order.id}
                        className="border rounded-lg p-4 space-y-3 hover-elevate"
                        data-testid={`live-order-${order.id}`}
                      >
                        {/* Order Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold">Order #{order.id.substring(0, 8)}</p>
                              <Badge 
                                variant={getStatusBadgeVariant(order.status)}
                                data-testid={`badge-order-status-${order.id}`}
                              >
                                {getStatusLabel(order.status)}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                          <p className="font-bold text-lg">${Number(order.serviceFare).toFixed(2)}</p>
                        </div>

                        {/* Order Details */}
                        <div className="space-y-2 text-sm">
                          <div className="flex items-start gap-2">
                            <ShoppingBag className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <span>{getItemsSummary(order.items)}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <span className="text-muted-foreground">{order.deliveryAddress}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                              <Truck className="h-4 w-4 text-muted-foreground" />
                              <span className="text-xs">Delivery</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <CreditCard className="h-4 w-4 text-muted-foreground" />
                              <span className="text-xs capitalize">{order.paymentMethod}</span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        {profile?.isVerified && (
                          <div className="pt-3 border-t">
                            {order.status === 'placed' && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => handleAcceptOrder(order.id)}
                                  disabled={updateStatusMutation.isPending}
                                  data-testid={`button-accept-order-${order.id}`}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Accept Order
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setRejectOrderId(order.id)}
                                  disabled={updateStatusMutation.isPending}
                                  data-testid={`button-reject-order-${order.id}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                            {order.status === 'accepted' && (
                              <Button
                                size="sm"
                                className="w-full"
                                onClick={() => handleMarkPreparing(order.id)}
                                disabled={updateStatusMutation.isPending}
                                data-testid={`button-preparing-${order.id}`}
                              >
                                <ChefHat className="h-4 w-4 mr-2" />
                                Mark as Preparing
                              </Button>
                            )}
                            {order.status === 'preparing' && (
                              <Button
                                size="sm"
                                className="w-full"
                                onClick={() => handleMarkReady(order.id)}
                                disabled={updateStatusMutation.isPending}
                                data-testid={`button-ready-${order.id}`}
                              >
                                <PackageCheck className="h-4 w-4 mr-2" />
                                Mark as Ready
                              </Button>
                            )}
                            {order.status === 'ready_for_pickup' && (
                              <div className="space-y-2">
                                <Button
                                  size="sm"
                                  className="w-full"
                                  onClick={() => handleMarkOutForDelivery(order.id)}
                                  disabled={updateStatusMutation.isPending}
                                  data-testid={`button-out-delivery-${order.id}`}
                                >
                                  <Truck className="h-4 w-4 mr-2" />
                                  Mark as Out for Delivery
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full"
                                  onClick={() => handleMarkCompleted(order.id)}
                                  disabled={updateStatusMutation.isPending}
                                  data-testid={`button-completed-${order.id}`}
                                >
                                  Customer Picked Up
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="h-16 w-16 mx-auto mb-4 opacity-20" />
                    <p className="font-medium">No live orders right now</p>
                    <p className="text-sm mt-2">New orders will appear here as customers order</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN - Info + Wallet + Quick Actions (1/3 width on desktop) */}
          <div className="space-y-4">
            {/* Restaurant Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Info className="h-4 w-4" />
                  Restaurant Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{profile?.restaurantName || "Not set"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Address</span>
                    <span className="font-medium text-right text-xs">
                      {profile?.address || "Not set"}
                    </span>
                  </div>
                  {profile?.phone && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Phone</span>
                      <span className="font-medium">{profile.phone}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Hours</span>
                    <span className="font-medium">9:00 AM - 10:00 PM</span>
                  </div>
                </div>
                <Link href="/restaurant/profile">
                  <Button variant="outline" size="sm" className="w-full" data-testid="button-edit-info">
                    Edit Restaurant Info
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Wallet Snapshot Placeholder */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="h-4 w-4" />
                  Wallet Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current Balance</span>
                    <span className="font-bold text-green-600" data-testid="text-wallet-balance">
                      ${wallet?.balance != null ? Number(wallet.balance).toFixed(2) : "0.00"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pending Payouts</span>
                    <span className="font-medium">Coming soon</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Next Payout</span>
                    <span className="font-medium">Coming soon</span>
                  </div>
                </div>
                <Link href="/restaurant/wallet">
                  <Button size="sm" className="w-full" data-testid="button-goto-wallet">
                    Go to Wallet
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Performance Insights Placeholder */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4" />
                  Performance Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>• Weekly orders: Coming soon</p>
                  <p>• Weekly earnings: Coming soon</p>
                  <p>• Cancellation rate: Coming soon</p>
                  <p>• Avg prep time: Coming soon</p>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings className="h-4 w-4" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/restaurant/menu">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2" data-testid="button-manage-menu">
                    <MenuIcon className="h-4 w-4" />
                    Manage Menu
                  </Button>
                </Link>
                <Link href="/restaurant/orders">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2" data-testid="button-order-history">
                    <ShoppingBag className="h-4 w-4" />
                    Order History
                  </Button>
                </Link>
                <Link href="/restaurant/wallet">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2" data-testid="button-wallet-payouts">
                    <Wallet className="h-4 w-4" />
                    Wallet & Payouts
                  </Button>
                </Link>
                <Link href="/restaurant/support">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2" data-testid="button-support">
                    <MessageCircle className="h-4 w-4" />
                    Support Chat
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Warning for Unverified Restaurants */}
        {!profile?.isVerified && (
          <Card className="mt-6 border-orange-500 bg-orange-50 dark:bg-orange-950/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="font-medium text-orange-900 dark:text-orange-100">
                    Verification Pending
                  </p>
                  <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                    Your restaurant is currently under review. You'll be able to accept orders once verification is complete.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Reject Order Confirmation Dialog */}
      <AlertDialog open={!!rejectOrderId} onOpenChange={() => setRejectOrderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the order and notify the customer. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRejectOrder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reject Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
