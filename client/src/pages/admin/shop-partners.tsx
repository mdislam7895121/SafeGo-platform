import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  ArrowLeft, Store, Search, Filter, CheckCircle, XCircle, Clock, 
  Eye, MoreHorizontal, Ban, UserCheck, Package, ShoppingCart, RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface ShopPartner {
  id: string;
  shopName: string;
  ownerName: string;
  phoneNumber: string;
  verificationStatus: string;
  commissionRate: number;
  walletBalance: number;
  negativeBalance: number;
  logoUrl?: string;
  bannerUrl?: string;
  category?: string;
  createdAt: string;
  user: { id: string; email: string; fullName?: string; isBlocked: boolean };
  _count: { products: number; orders: number };
}

interface ShopPartnersResponse {
  success: boolean;
  shopPartners: ShopPartner[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

const STATUS_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  pending: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Clock, label: "Pending" },
  approved: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle, label: "Approved" },
  rejected: { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: XCircle, label: "Rejected" },
  suspended: { color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", icon: Ban, label: "Suspended" },
};

export default function ShopPartnersPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [actionDialog, setActionDialog] = useState<{ open: boolean; shop: ShopPartner | null; action: string }>({
    open: false, shop: null, action: ""
  });
  const [rejectionReason, setRejectionReason] = useState("");

  const queryParams = new URLSearchParams();
  if (search) queryParams.set("search", search);
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  queryParams.set("page", page.toString());
  queryParams.set("limit", "20");

  const { data, isLoading, refetch } = useQuery<ShopPartnersResponse>({
    queryKey: ["/api/admin/shop-partners", queryParams.toString()],
    refetchInterval: 30000,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status, rejectionReason }: { id: string; status: string; rejectionReason?: string }) => {
      return apiRequest(`/api/admin/shop-partners/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, rejectionReason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shop-partners"] });
      toast({ title: "Status updated", description: "Shop partner status has been updated" });
      setActionDialog({ open: false, shop: null, action: "" });
      setRejectionReason("");
    },
    onError: (error: any) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const handleAction = (shop: ShopPartner, action: string) => {
    if (action === "reject") {
      setActionDialog({ open: true, shop, action });
    } else if (action === "approve") {
      statusMutation.mutate({ id: shop.id, status: "approved" });
    }
  };

  const confirmReject = () => {
    if (!rejectionReason.trim()) {
      toast({ title: "Rejection reason required", variant: "destructive" });
      return;
    }
    if (actionDialog.shop) {
      statusMutation.mutate({ id: actionDialog.shop.id, status: "rejected", rejectionReason });
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">Shop Partners</h1>
              <p className="text-muted-foreground">Manage Bangladesh shop partner accounts</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by shop name, owner, or email..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-40" data-testid="select-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Shop Partners ({data?.pagination?.total || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-lg" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                    <Skeleton className="h-8 w-24" />
                  </div>
                ))
              ) : !data?.shopPartners?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Store className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No shop partners found</p>
                </div>
              ) : (
                data.shopPartners.map((shop) => {
                  const statusConf = STATUS_CONFIG[shop.verificationStatus?.toLowerCase()] || STATUS_CONFIG.pending;
                  const StatusIcon = statusConf.icon;
                  return (
                    <div 
                      key={shop.id} 
                      className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                      data-testid={`row-shop-${shop.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                          {shop.logoUrl ? (
                            <img src={shop.logoUrl} alt={shop.shopName} className="h-12 w-12 rounded-lg object-cover" />
                          ) : (
                            <Store className="h-6 w-6 text-purple-600" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{shop.shopName}</span>
                            <Badge variant="outline" className="text-xs">{shop.category || 'General'}</Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{shop.ownerName}</span>
                            <span>•</span>
                            <span>{shop.user.email}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Package className="h-3 w-3" />
                              {shop._count.products} products
                            </span>
                            <span className="flex items-center gap-1">
                              <ShoppingCart className="h-3 w-3" />
                              {shop._count.orders} orders
                            </span>
                            <span>Joined {format(new Date(shop.createdAt), "MMM d, yyyy")}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={statusConf.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConf.label}
                        </Badge>
                        {shop.user.isBlocked && (
                          <Badge variant="destructive">Blocked</Badge>
                        )}
                        <Link href={`/admin/shop-partners/${shop.id}`}>
                          <Button size="sm" variant="outline" data-testid={`button-view-${shop.id}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" data-testid={`button-actions-${shop.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {shop.verificationStatus?.toLowerCase() === 'pending' && (
                              <>
                                <DropdownMenuItem onClick={() => handleAction(shop, "approve")}>
                                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleAction(shop, "reject")}>
                                  <XCircle className="h-4 w-4 mr-2 text-red-600" />
                                  Reject
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/shop-partners/${shop.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {data?.pagination && data.pagination.pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {data.pagination.pages}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page >= data.pagination.pages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={actionDialog.open} onOpenChange={(open) => !open && setActionDialog({ open: false, shop: null, action: "" })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Shop Partner</DialogTitle>
              <DialogDescription>
                Provide a reason for rejecting {actionDialog.shop?.shopName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Rejection Reason</Label>
                <Textarea
                  placeholder="Enter the reason for rejection..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  data-testid="input-rejection-reason"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActionDialog({ open: false, shop: null, action: "" })}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmReject} disabled={statusMutation.isPending}>
                {statusMutation.isPending ? "Rejecting..." : "Reject"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
