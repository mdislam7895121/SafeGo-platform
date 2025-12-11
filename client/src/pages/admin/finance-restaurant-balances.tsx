import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  Building2,
  RefreshCw,
  Search,
  AlertCircle,
  CheckCircle,
  DollarSign,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface RestaurantBalance {
  restaurantId: string;
  restaurantName: string | null;
  countryCode: string;
  currentBalance: number;
  negativeBalance: number;
  unsettledOrdersCount: number;
  isRestricted: boolean;
  lastUpdated: string;
}

interface RestaurantBalanceResponse {
  data: RestaurantBalance[];
  total: number;
  page: number;
  pageSize: number;
}

interface UnsettledOrder {
  orderType: string;
  orderId: string;
  date: string;
  amount: number;
  commissionAmount: number;
  paymentMethod: string;
}

interface UnsettledOrdersResponse {
  foods: UnsettledOrder[];
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function FinanceRestaurantBalancesPage() {
  const { toast } = useToast();
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [minNegative, setMinNegative] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState(1);
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantBalance | null>(null);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState<string>("");
  const [settlementMethod, setSettlementMethod] = useState<string>("bank_transfer");
  const [settlementReference, setSettlementReference] = useState<string>("");
  const [settlementNotes, setSettlementNotes] = useState<string>("");
  const [selectedOrders, setSelectedOrders] = useState<Array<{ orderType: string; orderId: string; commissionAmount: number }>>([]);

  const queryParams = new URLSearchParams();
  if (countryFilter !== "all") queryParams.set("countryCode", countryFilter);
  if (minNegative) queryParams.set("minNegative", minNegative);
  if (search) queryParams.set("search", search);
  queryParams.set("page", page.toString());
  queryParams.set("pageSize", "20");

  const { data, isLoading, refetch } = useQuery<RestaurantBalanceResponse>({
    queryKey: ["/api/admin/finance/restaurant-balances", queryParams.toString()],
  });

  const { data: unsettledOrders, isLoading: ordersLoading } = useQuery<UnsettledOrdersResponse>({
    queryKey: ["/api/admin/finance/restaurant-balances", selectedRestaurant?.restaurantId, "unsettled"],
    enabled: !!selectedRestaurant,
  });

  const createSettlementMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/admin/finance/settlements", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Settlement created",
        description: "The settlement has been recorded and balances updated.",
      });
      setSettlementOpen(false);
      setSelectedRestaurant(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/finance/restaurant-balances"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create settlement",
        variant: "destructive",
      });
    },
  });

  const handleCreateSettlement = () => {
    if (!selectedRestaurant) return;
    
    createSettlementMutation.mutate({
      userType: "restaurant",
      userId: selectedRestaurant.restaurantId,
      userName: selectedRestaurant.restaurantName,
      countryCode: selectedRestaurant.countryCode,
      totalAmount: parseFloat(settlementAmount),
      currency: selectedRestaurant.countryCode === "US" ? "USD" : "BDT",
      method: settlementMethod,
      reference: settlementReference || undefined,
      notes: settlementNotes || undefined,
      orderIds: selectedOrders,
    });
  };

  const allOrders = unsettledOrders?.foods || [];

  const selectAllOrders = () => {
    setSelectedOrders(allOrders.map((o) => ({
      orderType: o.orderType,
      orderId: o.orderId,
      commissionAmount: o.commissionAmount,
    })));
    const total = allOrders.reduce((sum, o) => sum + o.commissionAmount, 0);
    setSettlementAmount(total.toFixed(2));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Restaurant Balances"
        description="View and settle restaurant negative balances"
        icon={Building2}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger className="w-[130px]" data-testid="select-country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="BD">Bangladesh</SelectItem>
                  <SelectItem value="US">United States</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Min Balance</Label>
              <Input
                type="number"
                placeholder="e.g. 100"
                value={minNegative}
                onChange={(e) => setMinNegative(e.target.value)}
                className="w-[120px]"
                data-testid="input-min-balance"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Restaurant name or ID"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-[200px]"
                  data-testid="input-search"
                />
              </div>
            </div>
            <Button variant="outline" onClick={() => { setPage(1); refetch(); }} data-testid="button-apply">
              <RefreshCw className="h-4 w-4 mr-2" />
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Negative Balance</TableHead>
                  <TableHead>Unsettled Orders</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No restaurants with negative balance found
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data.map((restaurant) => (
                    <TableRow key={restaurant.restaurantId}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{restaurant.restaurantName || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{restaurant.restaurantId.slice(0, 12)}...</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{restaurant.countryCode}</Badge>
                      </TableCell>
                      <TableCell className="font-bold text-red-600">
                        {formatCurrency(restaurant.negativeBalance, restaurant.countryCode === "US" ? "USD" : "BDT")}
                      </TableCell>
                      <TableCell>{restaurant.unsettledOrdersCount}</TableCell>
                      <TableCell>
                        {restaurant.isRestricted ? (
                          <Badge variant="destructive">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Restricted
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(restaurant.lastUpdated), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Sheet>
                            <SheetTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedRestaurant(restaurant)}
                                data-testid={`button-view-${restaurant.restaurantId}`}
                              >
                                View Details
                              </Button>
                            </SheetTrigger>
                            <SheetContent className="w-[500px] sm:w-[600px]">
                              <SheetHeader>
                                <SheetTitle>Restaurant Details</SheetTitle>
                                <SheetDescription>
                                  {restaurant.restaurantName || restaurant.restaurantId}
                                </SheetDescription>
                              </SheetHeader>
                              <div className="mt-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm text-muted-foreground">Negative Balance</p>
                                    <p className="text-xl font-bold text-red-600">
                                      {formatCurrency(restaurant.negativeBalance, restaurant.countryCode === "US" ? "USD" : "BDT")}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Unsettled Orders</p>
                                    <p className="text-xl font-bold">{restaurant.unsettledOrdersCount}</p>
                                  </div>
                                </div>

                                <div>
                                  <h4 className="font-medium mb-2">Unsettled Orders</h4>
                                  {ordersLoading ? (
                                    <Skeleton className="h-32 w-full" />
                                  ) : allOrders.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No unsettled orders</p>
                                  ) : (
                                    <div className="max-h-64 overflow-y-auto border rounded">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Commission</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {allOrders.map((order) => (
                                            <TableRow key={order.orderId}>
                                              <TableCell>
                                                <Badge variant="outline">{order.orderType}</Badge>
                                              </TableCell>
                                              <TableCell className="text-sm">
                                                {format(new Date(order.date), "MMM d")}
                                              </TableCell>
                                              <TableCell className="font-medium">
                                                {formatCurrency(order.commissionAmount, restaurant.countryCode === "US" ? "USD" : "BDT")}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  )}
                                </div>

                                <Button
                                  className="w-full"
                                  onClick={() => {
                                    selectAllOrders();
                                    setSettlementOpen(true);
                                  }}
                                  data-testid="button-create-settlement"
                                >
                                  <DollarSign className="h-4 w-4 mr-2" />
                                  Record Settlement
                                </Button>
                              </div>
                            </SheetContent>
                          </Sheet>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data && data.total > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            Page {page} of {Math.ceil(data.total / 20)}
          </span>
          <Button variant="outline" size="sm" disabled={page >= Math.ceil(data.total / 20)} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}

      <Dialog open={settlementOpen} onOpenChange={setSettlementOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Settlement</DialogTitle>
            <DialogDescription>
              Record a payment received from {selectedRestaurant?.restaurantName || selectedRestaurant?.restaurantId}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={settlementAmount}
                onChange={(e) => setSettlementAmount(e.target.value)}
                placeholder="Enter amount"
                data-testid="input-settlement-amount"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={settlementMethod} onValueChange={setSettlementMethod}>
                <SelectTrigger data-testid="select-settlement-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cash_deposit">Cash Deposit</SelectItem>
                  <SelectItem value="bkash">bKash</SelectItem>
                  <SelectItem value="nagad">Nagad</SelectItem>
                  <SelectItem value="stripe_payout_adjust">Stripe Payout Adjust</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Reference (optional)</Label>
              <Input
                value={settlementReference}
                onChange={(e) => setSettlementReference(e.target.value)}
                placeholder="Transaction ID, bank reference, etc."
                data-testid="input-settlement-reference"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                value={settlementNotes}
                onChange={(e) => setSettlementNotes(e.target.value)}
                placeholder="Any additional notes..."
                data-testid="input-settlement-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettlementOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreateSettlement}
              disabled={!settlementAmount || createSettlementMutation.isPending}
              data-testid="button-confirm-settlement"
            >
              {createSettlementMutation.isPending ? "Creating..." : "Create Settlement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
