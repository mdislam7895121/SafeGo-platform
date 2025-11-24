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
import { KYCBanner } from "@/components/restaurant/KYCBanner";
import { PayoutSummaryWidget } from "@/components/restaurant/PayoutSummaryWidget";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, BarChart3 } from "lucide-react";

type TimePeriod = 'today' | 'week' | 'month';

export default function RestaurantHome() {
  const { user, logout } = useAuth();
  const [rejectOrderId, setRejectOrderId] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('today');
  const { toast } = useToast();

  const { data: restaurantData, isLoading } = useQuery({
    queryKey: ["/api/restaurant/home"],
    refetchInterval: 5000,
  });

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["/api/restaurant/orders"],
    refetchInterval: 10000, // Poll every 10 seconds for live updates
  });

  const { data: walletData, isLoading: walletLoading } = useQuery({
    queryKey: ["/api/restaurant/wallet"],
    refetchInterval: 30000, // Poll every 30 seconds
  });

  // Mutation for updating order status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      return await apiRequest(`/api/restaurant/orders/${orderId}/status`, {
        method: "POST",
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
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const profile = (restaurantData as any)?.profile;
  const wallet = (restaurantData as any)?.wallet;
  const orders = ordersData?.orders || [];

  // Calculate time period boundaries
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const prevMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);

  // Filter orders by time period
  const getFilteredOrders = (start: Date) => 
    orders.filter((order: any) => new Date(order.createdAt) >= start);

  const todayOrders = getFilteredOrders(todayStart);
  const weekOrders = getFilteredOrders(weekStart);
  const monthOrders = getFilteredOrders(monthStart);
  const prevWeekOrders = getFilteredOrders(prevWeekStart).filter((order: any) => 
    new Date(order.createdAt) < weekStart
  );
  const prevMonthOrders = orders.filter((order: any) => {
    const date = new Date(order.createdAt);
    return date >= prevMonthStart && date < monthStart;
  });

  // Calculate earnings
  const calculateEarnings = (ordersList: any[]) =>
    ordersList.reduce((sum, order) => sum + Number(order.restaurantPayout || 0), 0);

  const todayEarnings = calculateEarnings(todayOrders);
  const weekEarnings = calculateEarnings(weekOrders);
  const monthEarnings = calculateEarnings(monthOrders);
  const prevWeekEarnings = calculateEarnings(prevWeekOrders);
  const prevMonthEarnings = calculateEarnings(prevMonthOrders);

  // Get current period metrics based on selected time period
  const currentOrders = timePeriod === 'today' ? todayOrders : 
                        timePeriod === 'week' ? weekOrders : monthOrders;
  const currentEarnings = timePeriod === 'today' ? todayEarnings : 
                          timePeriod === 'week' ? weekEarnings : monthEarnings;
  const prevEarnings = timePeriod === 'today' ? 0 : // No comparison for today
                       timePeriod === 'week' ? prevWeekEarnings : prevMonthEarnings;

  // Calculate trend percentages
  const earningsTrend = prevEarnings > 0 
    ? ((currentEarnings - prevEarnings) / prevEarnings) * 100 
    : currentEarnings > 0 ? 100 : 0;

  const liveOrders = orders.filter((order: any) => 
    !['delivered', 'cancelled', 'completed'].includes(order.status)
  );

  // Mock rating (to be replaced with real data)
  const avgRating = 4.5;
  const totalRatings = 0;

  // Calculate 7-day performance metrics
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const last7DaysOrders = orders.filter((order: any) => 
    new Date(order.createdAt) >= sevenDaysAgo
  );
  
  const last7DaysEarnings = last7DaysOrders.reduce((sum: number, order: any) => 
    sum + Number(order.restaurantPayout || 0), 0
  );
  
  const cancelledOrders = last7DaysOrders.filter((order: any) => 
    order.status === 'cancelled'
  );
  const cancellationRate = last7DaysOrders.length > 0 
    ? (cancelledOrders.length / last7DaysOrders.length) * 100 
    : 0;
  
  // Calculate average preparation time (if data available)
  const completedOrders = last7DaysOrders.filter((order: any) => 
    order.status === 'completed' || order.status === 'delivered'
  );
  // Placeholder - would need timestamps to calculate real prep time
  const avgPrepTime = completedOrders.length > 0 ? 15 : null; // Default 15 min
  
  // Calculate pending payouts (only from completed/delivered orders awaiting settlement)
  const pendingPayoutOrders = last7DaysOrders.filter((order: any) => 
    order.status === 'completed' || order.status === 'delivered'
  );
  const pendingPayouts = pendingPayoutOrders.reduce((sum: number, order: any) => 
    sum + Number(order.restaurantPayout || 0), 0
  );
  
  // Check if restaurant has payout methods configured
  const hasPayoutMethod = wallet?.payoutMethods && Array.isArray(wallet.payoutMethods) && wallet.payoutMethods.length > 0;

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
    <div className="space-y-6">
        {/* KYC Verification Banner */}
        <KYCBanner />

        {/* Performance Overview Section - Increased spacing from header for breathing room */}
        <section className="mt-8 sm:mt-9 space-y-6">
          {/* Performance Overview with Time Period Filter */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold whitespace-nowrap">Performance Overview</h2>
            <Tabs value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
              <TabsList data-testid="tabs-time-period">
                <TabsTrigger value="today" data-testid="tab-today">Today</TabsTrigger>
                <TabsTrigger value="week" data-testid="tab-week">7 Days</TabsTrigger>
                <TabsTrigger value="month" data-testid="tab-month">30 Days</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Orders Count */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">
                    {timePeriod === 'today' ? "Today's Orders" : 
                     timePeriod === 'week' ? "7-Day Orders" : "30-Day Orders"}
                  </p>
                  <p className="text-3xl font-bold" data-testid="text-period-orders">
                    {currentOrders.length || "—"}
                  </p>
                </div>
                <ShoppingBag className="h-8 w-8 text-primary opacity-20" />
              </div>
              {/* R-ENHANCE: Mini trend bar */}
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.min((currentOrders.length / Math.max(currentOrders.length, 10)) * 100, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Earnings with Trend */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">
                    {timePeriod === 'today' ? "Today's Earnings" : 
                     timePeriod === 'week' ? "7-Day Earnings" : "30-Day Earnings"}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold text-green-600" data-testid="text-period-earnings">
                      {currentEarnings > 0 ? `$${currentEarnings.toFixed(2)}` : "—"}
                    </p>
                    {timePeriod !== 'today' && earningsTrend !== 0 && (
                      <span 
                        className={`text-xs font-medium ${earningsTrend > 0 ? 'text-green-600' : 'text-red-600'}`}
                        data-testid="text-earnings-trend"
                      >
                        {earningsTrend > 0 ? '↑' : '↓'} {Math.abs(earningsTrend).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">After SafeGo fees</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600 opacity-20" />
              </div>
              {/* R-ENHANCE: Revenue trend bar */}
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${earningsTrend >= 0 ? 'bg-green-500' : 'bg-orange-500'}`}
                  style={{ width: `${Math.min((currentEarnings / Math.max(currentEarnings, prevEarnings, 100)) * 100, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Active Orders */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">Active Orders</p>
                  <p className="text-3xl font-bold text-orange-600" data-testid="text-active-orders">
                    {liveOrders.length || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Needs attention</p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-600 opacity-20" />
              </div>
              {/* R-ENHANCE: Active orders indicator */}
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-500 transition-all duration-300"
                  style={{ width: `${Math.min((liveOrders.length / Math.max(liveOrders.length, 5)) * 100, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Restaurant Rating */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
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
              {/* R-ENHANCE: Rating visualization */}
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-500 transition-all duration-300"
                  style={{ width: `${totalRatings > 0 ? (avgRating / 5) * 100 : 0}%` }}
                />
              </div>
            </CardContent>
          </Card>
          </div>
        </section>

        {/* R-ENHANCE: Recent Orders + Alerts Unified Panel */}
        {liveOrders.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Recent Orders & Alerts
                  <Badge variant="default">{liveOrders.length} active</Badge>
                </div>
                <Link href="/restaurant/orders">
                  <Button variant="outline" size="sm" data-testid="button-view-all-orders">
                    View All Orders
                  </Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {liveOrders.slice(0, 3).map((order: any) => {
                  const isUrgent = order.status === 'placed' && 
                    (Date.now() - new Date(order.createdAt).getTime()) > 5 * 60 * 1000; // > 5 min
                  
                  return (
                    <div
                      key={order.id}
                      className={`border rounded-lg p-3 hover-elevate ${isUrgent ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' : ''}`}
                      data-testid={`recent-order-${order.id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm">Order #{order.id.substring(0, 8)}</span>
                            <Badge variant={getStatusBadgeVariant(order.status)} className="text-xs">
                              {getStatusLabel(order.status)}
                            </Badge>
                            {isUrgent && (
                              <Badge variant="destructive" className="text-xs" data-testid={`badge-urgent-${order.id}`}>
                                URGENT
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {getItemsSummary(order.items)} • {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">${Number(order.serviceFare).toFixed(2)}</span>
                          <Link href={`/restaurant/orders#${order.id}`}>
                            <Button size="sm" variant="outline" data-testid={`button-view-order-${order.id}`}>
                              View
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {liveOrders.length > 3 && (
                  <p className="text-sm text-muted-foreground text-center pt-2">
                    +{liveOrders.length - 3} more active orders
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

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
            {/* Payout Summary */}
            <PayoutSummaryWidget
              wallet={walletData?.wallet || null}
              earnings={{
                totalEarnings: todayEarnings.toFixed(2),
                commission: (todayEarnings * 0.15).toFixed(2), // Assuming 15% commission
                netPayout: (todayEarnings * 0.85).toFixed(2),
              }}
              nextSettlementDate="Weekly on Monday"
              isLoading={walletLoading}
            />

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

            {/* Wallet Snapshot */}
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
                  {wallet?.negativeBalance && Number(wallet.negativeBalance) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Negative Balance</span>
                      <span className="font-medium text-red-600">
                        ${Number(wallet.negativeBalance).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pending Payouts</span>
                    <span className="font-medium" data-testid="text-pending-payouts">
                      ${pendingPayouts > 0 ? pendingPayouts.toFixed(2) : "0.00"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Next Payout</span>
                    <span className="font-medium text-xs" data-testid="text-next-payout">
                      Weekly (Auto)
                    </span>
                  </div>
                </div>
                
                {/* Warning if no payout method */}
                {!hasPayoutMethod && (
                  <div className="p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                    <p className="text-xs text-orange-700 dark:text-orange-300 font-medium">
                      ⚠ Add a payout method to receive earnings
                    </p>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Link href="/restaurant/wallet">
                    <Button size="sm" className="w-full" data-testid="button-goto-wallet">
                      <Wallet className="h-4 w-4 mr-2" />
                      View Wallet
                    </Button>
                  </Link>
                  <Link href="/restaurant/wallet">
                    <Button size="sm" variant="outline" className="w-full" data-testid="button-manage-payouts">
                      <CreditCard className="h-4 w-4 mr-2" />
                      Manage Payout Methods
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Performance Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4" />
                  Performance Insights
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Last 7 days</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Total Orders</span>
                    </div>
                    <span className="font-semibold" data-testid="text-7day-orders">
                      {last7DaysOrders.length}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Total Earnings</span>
                    </div>
                    <span className="font-semibold text-green-600" data-testid="text-7day-earnings">
                      ${last7DaysEarnings.toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Avg. Prep Time</span>
                    </div>
                    <span className="font-semibold" data-testid="text-avg-prep-time">
                      {avgPrepTime ? `${avgPrepTime} min` : "N/A"}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <X className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Cancelled Orders</span>
                    </div>
                    <span className={`font-semibold ${cancellationRate > 10 ? 'text-red-600' : ''}`} data-testid="text-cancellation-rate">
                      {cancellationRate.toFixed(1)}%
                    </span>
                  </div>
                  
                  {last7DaysOrders.length === 0 && (
                    <div className="pt-2 text-center">
                      <p className="text-xs text-muted-foreground">
                        No orders in the last 7 days
                      </p>
                    </div>
                  )}
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
