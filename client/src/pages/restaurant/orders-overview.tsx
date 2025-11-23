import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Clock,
  Package,
  CheckCircle2,
  XCircle,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { KYCBanner } from "@/components/restaurant/KYCBanner";
import { PayoutSummaryWidget } from "@/components/restaurant/PayoutSummaryWidget";

export default function OrdersOverview() {
  const { data: overviewData, isLoading } = useQuery({
    queryKey: ["/api/restaurant/orders/overview"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: walletData, isLoading: walletLoading } = useQuery({
    queryKey: ["/api/restaurant/wallet"],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const today = overviewData?.today || {
    totalOrders: 0,
    totalRevenue: 0,
    totalCommission: 0,
    netRevenue: 0,
    placedCount: 0,
    activeCount: 0,
    completedCount: 0,
    cancelledCount: 0,
  };

  const wallet = overviewData?.wallet;

  return (
    <div className="p-6 space-y-6">
      {/* KYC Verification Banner */}
      <KYCBanner />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Orders Overview</h1>
          <p className="text-muted-foreground mt-1">
            Today's performance and financial summary
          </p>
        </div>
        <Link href="/restaurant/orders/live">
          <Button data-testid="button-view-live">
            <Clock className="h-4 w-4 mr-2" />
            View Live Orders
          </Button>
        </Link>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Stats Cards */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Total Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders Today</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-orders">{today.totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {today.completedCount} completed • {today.activeCount} in progress
            </p>
          </CardContent>
        </Card>

        {/* Total Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gross Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-gross-revenue">
              ${today.totalRevenue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Before commission
            </p>
          </CardContent>
        </Card>

        {/* Commission */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SafeGo Commission</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600" data-testid="text-commission">
              ${today.totalCommission.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {today.totalRevenue > 0 
                ? ((today.totalCommission / today.totalRevenue) * 100).toFixed(1)
                : 0}% of revenue
            </p>
          </CardContent>
        </Card>

        {/* Net Payout */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Payout</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary" data-testid="text-net-payout">
              ${today.netRevenue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Your earnings today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Wallet Balance (if negative balance exists) */}
      {wallet && !wallet.negativeBalance && wallet.negativeBalance !== 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <Wallet className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900 dark:text-orange-100">
                  Outstanding Commission Balance
                </h3>
                <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                  You have a negative balance of ${Math.abs(wallet.negativeBalance).toFixed(2)} due to 
                  commission fees. This will be settled from your next earnings.
                </p>
                <Link href="/restaurant/wallet">
                  <Button variant="outline" size="sm" className="mt-3" data-testid="button-view-wallet">
                    View Wallet Details
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Order Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* New Orders */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">New Orders</span>
              </div>
              <Badge variant="secondary" data-testid="badge-placed-count">{today.placedCount}</Badge>
            </div>
            <Progress 
              value={today.totalOrders > 0 ? (today.placedCount / today.totalOrders) * 100 : 0} 
              className="h-2"
            />
          </div>

          {/* Active Orders */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium">In Progress</span>
              </div>
              <Badge variant="secondary" data-testid="badge-active-count">{today.activeCount}</Badge>
            </div>
            <Progress 
              value={today.totalOrders > 0 ? (today.activeCount / today.totalOrders) * 100 : 0} 
              className="h-2"
            />
          </div>

          {/* Completed Orders */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Completed</span>
              </div>
              <Badge variant="default" data-testid="badge-completed-count">{today.completedCount}</Badge>
            </div>
            <Progress 
              value={today.totalOrders > 0 ? (today.completedCount / today.totalOrders) * 100 : 0} 
              className="h-2"
            />
          </div>

          {/* Cancelled Orders */}
          {today.cancelledCount > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium">Cancelled</span>
                </div>
                <Badge variant="destructive" data-testid="badge-cancelled-count">{today.cancelledCount}</Badge>
              </div>
              <Progress 
                value={today.totalOrders > 0 ? (today.cancelledCount / today.totalOrders) * 100 : 0} 
                className="h-2"
              />
            </div>
          )}
        </CardContent>
      </Card>
        </div>

        {/* Right Column: Payout Summary */}
        <div>
          <PayoutSummaryWidget
            wallet={walletData?.wallet || null}
            earnings={{
              totalEarnings: today.totalRevenue.toFixed(2),
              commission: today.totalCommission.toFixed(2),
              netPayout: today.netRevenue.toFixed(2),
            }}
            nextSettlementDate="Weekly on Monday"
            isLoading={walletLoading}
          />
        </div>
      </div>

      {/* Bottom Section */}
      <div className="space-y-6">
        <Separator />

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/restaurant/orders/live">
          <Card className="hover-elevate cursor-pointer" data-testid="card-live-orders">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-primary" />
                <div>
                  <h3 className="font-semibold">Live Orders Board</h3>
                  <p className="text-sm text-muted-foreground">
                    Manage active orders in real-time
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/restaurant/orders">
          <Card className="hover-elevate cursor-pointer" data-testid="card-all-orders">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <ShoppingBag className="h-8 w-8 text-primary" />
                <div>
                  <h3 className="font-semibold">All Orders</h3>
                  <p className="text-sm text-muted-foreground">
                    View complete order history
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/restaurant/wallet">
          <Card className="hover-elevate cursor-pointer" data-testid="card-wallet">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Wallet className="h-8 w-8 text-primary" />
                <div>
                  <h3 className="font-semibold">Wallet & Payouts</h3>
                  <p className="text-sm text-muted-foreground">
                    Manage your earnings
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        </div>
      </div>
    </div>
  );
}
