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
  MapPin,
  Plus,
  CalendarClock,
  Tag,
  Power,
  PauseCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ordersKeys } from "@/lib/queryKeys";
import { formatDistanceToNow } from "date-fns";
import { KYCBanner } from "@/components/restaurant/KYCBanner";
import { PayoutSummaryWidget } from "@/components/restaurant/PayoutSummaryWidget";
import { PerformanceInsights } from "@/components/restaurant/PerformanceInsights";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, BarChart3 } from "lucide-react";

type TimePeriod = 'today' | 'week' | 'month';

interface WalletData {
  wallet: {
    availableBalance: string;
    negativeBalance: string;
    currency: string;
    balance?: string;
    payoutMethods?: any[];
  } | null;
}

export default function RestaurantHome() {
  const { user, logout } = useAuth();
  const [rejectOrderId, setRejectOrderId] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('today');
  const { toast } = useToast();

  const { data: restaurantData, isLoading, isError: homeError } = useQuery({
    queryKey: ["/api/restaurant/home"],
    refetchInterval: 5000,
  });

  const { data: ordersData, isLoading: ordersLoading, isError: ordersError } = useQuery({
    queryKey: ordersKeys.list({ limit: 10 }),
    queryFn: () => apiRequest("/api/restaurant/orders?limit=10"),
    refetchInterval: 10000, // Poll every 10 seconds for live updates
  });

  const { data: walletData, isLoading: walletLoading, isError: walletError } = useQuery<WalletData>({
    queryKey: ["/api/restaurant/wallet"],
    refetchInterval: 30000, // Poll every 30 seconds
  });

  // Restaurant status controls - derived from server state with local override during mutation
  const serverIsOpen = (restaurantData as any)?.profile?.isOpen ?? true;
  const serverIsBusy = (restaurantData as any)?.profile?.isBusy ?? false;
  
  // Local state for optimistic updates (null = use server state)
  const [localIsOpen, setLocalIsOpen] = useState<boolean | null>(null);
  const [localIsBusy, setLocalIsBusy] = useState<boolean | null>(null);

  // Clear local overrides when server data updates (sync back to server truth)
  useEffect(() => {
    setLocalIsOpen(null);
    setLocalIsBusy(null);
  }, [serverIsOpen, serverIsBusy]);

  // Effective values: use local override if set, otherwise use server state
  const isOpen = localIsOpen ?? serverIsOpen;
  const isBusy = localIsBusy ?? serverIsBusy;

  // Mutation for updating restaurant status
  const updateStatusMutation2 = useMutation({
    mutationFn: async ({ isOpen, isBusy }: { isOpen?: boolean; isBusy?: boolean }) => {
      return await apiRequest("/api/restaurant/status", {
        method: "POST",
        body: JSON.stringify({ isOpen, isBusy }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/home"] });
      toast({
        title: "Status Updated",
        description: "Restaurant status has been updated.",
      });
    },
    onError: (error: any) => {
      // Revert local overrides on error (server state will be re-fetched)
      setLocalIsOpen(null);
      setLocalIsBusy(null);
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive",
      });
    },
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
      queryClient.invalidateQueries({ queryKey: ordersKeys.all });
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

  if (homeError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="error-dashboard-load">
        <AlertTriangle className="h-16 w-16 text-orange-500 opacity-50 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Unable to load dashboard</h2>
        <p className="text-muted-foreground mb-4">Please check your connection and try refreshing the page.</p>
        <Button onClick={() => window.location.reload()} data-testid="button-retry-dashboard">
          Retry
        </Button>
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

  // Today's order status breakdown
  const todayOrdersByStatus = {
    new: todayOrders.filter((o: any) => o.status === 'placed').length,
    preparing: todayOrders.filter((o: any) => ['accepted', 'preparing'].includes(o.status)).length,
    ready: todayOrders.filter((o: any) => o.status === 'ready_for_pickup').length,
    delivered: todayOrders.filter((o: any) => ['delivered', 'completed', 'picked_up'].includes(o.status)).length,
    cancelled: todayOrders.filter((o: any) => o.status === 'cancelled').length,
  };

  // Handle status toggle with optimistic updates
  const handleOpenToggle = (checked: boolean) => {
    setLocalIsOpen(checked);
    updateStatusMutation2.mutate({ isOpen: checked });
  };

  const handleBusyToggle = (checked: boolean) => {
    setLocalIsBusy(checked);
    updateStatusMutation2.mutate({ isBusy: checked });
  };

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

        {/* Restaurant Status Controls */}
        <Card className="mb-6" data-testid="card-restaurant-status">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Power className="h-4 w-4" />
              Restaurant Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id="open-toggle"
                    checked={isOpen}
                    onCheckedChange={handleOpenToggle}
                    disabled={updateStatusMutation2.isPending}
                    data-testid="switch-open-close"
                  />
                  <Label htmlFor="open-toggle" className="font-medium cursor-pointer">
                    {isOpen ? "Open" : "Closed"}
                  </Label>
                </div>
                <Badge 
                  variant={isOpen ? "default" : "secondary"} 
                  className={isOpen ? "bg-green-500" : ""}
                  data-testid="badge-open-status"
                >
                  {isOpen ? "Accepting Orders" : "Not Accepting"}
                </Badge>
              </div>
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id="busy-toggle"
                    checked={isBusy}
                    onCheckedChange={handleBusyToggle}
                    disabled={updateStatusMutation2.isPending || !isOpen}
                    data-testid="switch-busy-mode"
                  />
                  <Label htmlFor="busy-toggle" className={`font-medium cursor-pointer ${!isOpen ? 'text-muted-foreground' : ''}`}>
                    Busy Mode
                  </Label>
                </div>
                {isBusy && isOpen && (
                  <Badge variant="destructive" className="flex items-center gap-1" data-testid="badge-busy-status">
                    <PauseCircle className="h-3 w-3" />
                    Paused
                  </Badge>
                )}
              </div>
            </div>
            {isBusy && isOpen && (
              <p className="text-xs text-muted-foreground mt-3">
                New orders are temporarily paused. Existing orders can still be managed.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Today's Order Overview */}
        <Card className="mb-6" data-testid="card-order-overview">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingBag className="h-4 w-4" />
              Today's Order Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2 sm:gap-4">
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg" data-testid="status-new">
                <p className="text-2xl font-bold text-blue-600">{todayOrdersByStatus.new}</p>
                <p className="text-xs text-muted-foreground mt-1">New</p>
              </div>
              <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg" data-testid="status-preparing">
                <p className="text-2xl font-bold text-yellow-600">{todayOrdersByStatus.preparing}</p>
                <p className="text-xs text-muted-foreground mt-1">Preparing</p>
              </div>
              <div className="text-center p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg" data-testid="status-ready">
                <p className="text-2xl font-bold text-purple-600">{todayOrdersByStatus.ready}</p>
                <p className="text-xs text-muted-foreground mt-1">Ready</p>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg" data-testid="status-delivered">
                <p className="text-2xl font-bold text-green-600">{todayOrdersByStatus.delivered}</p>
                <p className="text-xs text-muted-foreground mt-1">Delivered</p>
              </div>
              <div className="text-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg" data-testid="status-cancelled">
                <p className="text-2xl font-bold text-red-600">{todayOrdersByStatus.cancelled}</p>
                <p className="text-xs text-muted-foreground mt-1">Cancelled</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Overview Section - Responsive spacing: 32px mobile, 24px tablet, 20px desktop */}
        <section className="mt-6 max-md:mt-8 xl:mt-5 space-y-6">
          {/* Performance Overview Heading + Tabs Container */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Performance Overview</h2>
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
                ) : ordersError ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="status-fetch-error">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-orange-500 opacity-50" />
                    <p className="font-medium">Unable to load orders</p>
                    <p className="text-sm mt-1">Please check your connection and try again</p>
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
              isError={walletError}
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
                  <div className="p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0" />
                    <p className="text-xs text-orange-700 dark:text-orange-300 font-medium">
                      Add a payout method to receive earnings
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

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings className="h-4 w-4" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/restaurant/menu/new">
                  <Button variant="default" size="sm" className="w-full justify-start gap-2" data-testid="button-add-item">
                    <Plus className="h-4 w-4" />
                    Add New Item
                  </Button>
                </Link>
                <Link href="/restaurant/menu">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2" data-testid="button-manage-menu">
                    <MenuIcon className="h-4 w-4" />
                    Manage Menu
                  </Button>
                </Link>
                <Link href="/restaurant/orders/live">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2" data-testid="button-ongoing-orders">
                    <Clock className="h-4 w-4" />
                    Ongoing Orders
                  </Button>
                </Link>
                <Link href="/restaurant/settings/hours">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2" data-testid="button-schedule-hours">
                    <CalendarClock className="h-4 w-4" />
                    Schedule Hours
                  </Button>
                </Link>
                <Link href="/restaurant/payout-methods">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2" data-testid="button-payout-methods">
                    <CreditCard className="h-4 w-4" />
                    Payout Methods
                  </Button>
                </Link>
                <Link href="/restaurant/promotions/campaigns">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2" data-testid="button-promotions">
                    <Tag className="h-4 w-4" />
                    Promotions & Discounts
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Enhanced Performance Insights - R2 */}
        <div className="mt-8">
          <PerformanceInsights />
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
