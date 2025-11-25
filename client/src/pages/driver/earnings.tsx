import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  TrendingUp,
  Car,
  UtensilsCrossed,
  Package,
  ChevronRight,
  Clock,
  Calendar,
  ArrowUpRight,
  Wallet,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";

interface EarningSummary {
  currency: string;
  availableBalance: number;
  negativeBalance: number;
  pendingPayouts: number;
  totalEarnedAllTime: number;
  thisWeekEarnings: number;
  thisWeekTrips: number;
  breakdown: {
    rides: number;
    food: number;
    parcel: number;
  };
}

interface EarningItem {
  id: string;
  type: "ride" | "food" | "parcel";
  date: string;
  grossAmount: number;
  commission: number;
  netEarning: number;
  paymentMethod: string;
  status: string;
}

interface EarningsResponse {
  earnings: EarningItem[];
  currency: string;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function DriverEarnings() {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [page, setPage] = useState(1);

  const { data: summary, isLoading: loadingSummary } = useQuery<EarningSummary>({
    queryKey: ["/api/driver/earnings-summary"],
  });

  const { data: earningsData, isLoading: loadingEarnings } = useQuery<EarningsResponse>({
    queryKey: ["/api/driver/earnings", activeTab, page],
    queryFn: async () => {
      const response = await fetch(`/api/driver/earnings?type=${activeTab}&page=${page}&limit=20`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch earnings");
      return response.json();
    },
  });

  const formatCurrency = (amount: number, currency?: string) => {
    const curr = currency || summary?.currency || "USD";
    if (curr === "BDT") {
      return `৳${amount.toFixed(2)}`;
    }
    return `$${amount.toFixed(2)}`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "ride":
        return <Car className="h-4 w-4" />;
      case "food":
        return <UtensilsCrossed className="h-4 w-4" />;
      case "parcel":
        return <Package className="h-4 w-4" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "ride":
        return "Ride";
      case "food":
        return "Food Delivery";
      case "parcel":
        return "Parcel";
      default:
        return type;
    }
  };

  const getTypeBadgeVariant = (type: string): "default" | "secondary" | "outline" => {
    switch (type) {
      case "ride":
        return "default";
      case "food":
        return "secondary";
      case "parcel":
        return "outline";
      default:
        return "outline";
    }
  };

  if (loadingSummary) {
    return (
      <div className="bg-background min-h-screen p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-64" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  const hasNegativeBalance = (summary?.negativeBalance || 0) > 0;

  return (
    <div className="bg-background min-h-screen">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Negative Balance Warning */}
        {hasNegativeBalance && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">Outstanding Commission Debt</p>
                  <p className="text-sm text-muted-foreground">
                    You have {formatCurrency(summary?.negativeBalance || 0)} in outstanding commissions that will be deducted from future earnings.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="hover-elevate">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Available</span>
              </div>
              <p className="text-2xl font-bold" data-testid="text-available-balance">
                {formatCurrency(summary?.availableBalance || 0)}
              </p>
              <Link href="/driver/wallet">
                <Button variant="link" size="sm" className="p-0 h-auto mt-1" data-testid="link-view-wallet">
                  View Wallet <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">This Week</span>
              </div>
              <p className="text-2xl font-bold" data-testid="text-this-week">
                {formatCurrency(summary?.thisWeekEarnings || 0)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {summary?.thisWeekTrips || 0} trips
              </p>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-muted-foreground">Pending</span>
              </div>
              <p className="text-2xl font-bold" data-testid="text-pending">
                {formatCurrency(summary?.pendingPayouts || 0)}
              </p>
              <Link href="/driver/payouts">
                <Button variant="link" size="sm" className="p-0 h-auto mt-1" data-testid="link-view-payouts">
                  View Payouts <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowUpRight className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">All Time</span>
              </div>
              <p className="text-2xl font-bold" data-testid="text-all-time">
                {formatCurrency(summary?.totalEarnedAllTime || 0)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Total earned</p>
            </CardContent>
          </Card>
        </div>

        {/* Weekly Breakdown */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              This Week's Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Car className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rides</p>
                  <p className="font-semibold" data-testid="text-rides-earnings">
                    {formatCurrency(summary?.breakdown?.rides || 0)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <UtensilsCrossed className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Food</p>
                  <p className="font-semibold" data-testid="text-food-earnings">
                    {formatCurrency(summary?.breakdown?.food || 0)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Package className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Parcels</p>
                  <p className="font-semibold" data-testid="text-parcel-earnings">
                    {formatCurrency(summary?.breakdown?.parcel || 0)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Earnings History */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Earnings History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setPage(1); }}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
                <TabsTrigger value="rides" data-testid="tab-rides">Rides</TabsTrigger>
                <TabsTrigger value="food" data-testid="tab-food">Food</TabsTrigger>
                <TabsTrigger value="parcel" data-testid="tab-parcel">Parcels</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-4">
                {loadingEarnings ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : earningsData?.earnings?.length === 0 ? (
                  <div className="text-center py-12">
                    <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No earnings found</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Complete trips to start earning
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {earningsData?.earnings?.map((earning) => (
                      <div
                        key={earning.id}
                        className="flex items-center justify-between p-4 rounded-lg border hover-elevate"
                        data-testid={`earning-item-${earning.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-muted rounded-lg">
                            {getTypeIcon(earning.type)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant={getTypeBadgeVariant(earning.type)} className="text-xs">
                                {getTypeLabel(earning.type)}
                              </Badge>
                              <span className="text-sm text-muted-foreground capitalize">
                                {earning.paymentMethod.replace(/_/g, " ")}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {format(new Date(earning.date), "MMM d, yyyy 'at' h:mm a")}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600" data-testid={`text-earning-amount-${earning.id}`}>
                            +{formatCurrency(earning.netEarning)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Fare: {formatCurrency(earning.grossAmount)} · Fee: {formatCurrency(earning.commission)}
                          </p>
                        </div>
                      </div>
                    ))}

                    {/* Pagination */}
                    {earningsData && earningsData.pagination.totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 pt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(Math.max(1, page - 1))}
                          disabled={page === 1}
                          data-testid="button-prev-page"
                        >
                          Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          Page {page} of {earningsData.pagination.totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(Math.min(earningsData.pagination.totalPages, page + 1))}
                          disabled={page === earningsData.pagination.totalPages}
                          data-testid="button-next-page"
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <Link href="/driver/payouts">
            <Button variant="outline" className="w-full h-14 justify-start gap-3" data-testid="button-request-payout">
              <DollarSign className="h-5 w-5" />
              <div className="text-left">
                <p className="font-medium">Request Payout</p>
                <p className="text-xs text-muted-foreground">Cash out your earnings</p>
              </div>
            </Button>
          </Link>
          <Link href="/driver/wallet">
            <Button variant="outline" className="w-full h-14 justify-start gap-3" data-testid="button-go-wallet">
              <Wallet className="h-5 w-5" />
              <div className="text-left">
                <p className="font-medium">Wallet</p>
                <p className="text-xs text-muted-foreground">Manage your balance</p>
              </div>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
