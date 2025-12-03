import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { 
  ArrowLeft, Store, CheckCircle, XCircle, Clock, Ban, Package, 
  ShoppingCart, Mail, Phone, Calendar, Wallet, Image, FileText, Eye
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface ShopPartnerDetails {
  id: string;
  shopName: string;
  ownerName: string;
  phoneNumber: string;
  verificationStatus: string;
  rejectionReason?: string;
  commissionRate: number;
  walletBalance: number;
  negativeBalance: number;
  logoUrl?: string;
  bannerUrl?: string;
  category?: string;
  address?: string;
  nidNumber?: string;
  tradeLicenseNumber?: string;
  bkashNumber?: string;
  nagadNumber?: string;
  createdAt: string;
  verifiedAt?: string;
  user: { id: string; email: string; fullName?: string; isBlocked: boolean; createdAt: string };
  products: Array<{ id: string; name: string; price: number; imageUrl?: string; isAvailable: boolean; createdAt: string }>;
  orders: Array<{ id: string; status: string; totalAmount: number; createdAt: string }>;
}

const STATUS_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  pending: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Clock, label: "Pending Review" },
  approved: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle, label: "Approved" },
  rejected: { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: XCircle, label: "Rejected" },
  suspended: { color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", icon: Ban, label: "Suspended" },
};

export default function ShopPartnerDetailsPage() {
  const { toast } = useToast();
  const params = useParams<{ id: string }>();
  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ success: boolean; shopPartner: ShopPartnerDetails }>({
    queryKey: ["/api/admin/shop-partners", params.id],
  });

  const statusMutation = useMutation({
    mutationFn: async ({ status, rejectionReason }: { status: string; rejectionReason?: string }) => {
      return apiRequest(`/api/admin/shop-partners/${params.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, rejectionReason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shop-partners"] });
      toast({ title: "Status updated", description: "Shop partner status has been updated" });
      setRejectDialog(false);
      setRejectionReason("");
    },
    onError: (error: any) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const shop = data?.shopPartner;
  const statusConf = STATUS_CONFIG[shop?.verificationStatus?.toLowerCase() || "pending"] || STATUS_CONFIG.pending;
  const StatusIcon = statusConf.icon;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-5xl mx-auto text-center py-12">
          <Store className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Shop Partner Not Found</h2>
          <Link href="/admin/shop-partners">
            <Button>Back to Shop Partners</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin/shop-partners">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-shop-name">{shop.shopName}</h1>
              <p className="text-muted-foreground">Shop Partner Details</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={statusConf.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConf.label}
            </Badge>
            {shop.user.isBlocked && <Badge variant="destructive">User Blocked</Badge>}
          </div>
        </div>

        {shop.verificationStatus?.toLowerCase() === 'pending' && (
          <Card className="mb-6 border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="h-6 w-6 text-yellow-600" />
                  <div>
                    <h3 className="font-semibold">Pending Approval</h3>
                    <p className="text-sm text-muted-foreground">Review the details and approve or reject this application</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setRejectDialog(true)} data-testid="button-reject">
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button onClick={() => statusMutation.mutate({ status: "approved" })} data-testid="button-approve">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {shop.verificationStatus?.toLowerCase() === 'rejected' && shop.rejectionReason && (
          <Card className="mb-6 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <XCircle className="h-6 w-6 text-red-600" />
                <div>
                  <h3 className="font-semibold text-red-800 dark:text-red-200">Application Rejected</h3>
                  <p className="text-sm text-red-700 dark:text-red-300">{shop.rejectionReason}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="overview">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="documents">KYC Documents</TabsTrigger>
            <TabsTrigger value="products">Products ({shop.products?.length || 0})</TabsTrigger>
            <TabsTrigger value="orders">Orders ({shop.orders?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Shop Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    {shop.logoUrl ? (
                      <img 
                        src={shop.logoUrl} 
                        alt="Logo" 
                        className="h-16 w-16 rounded-lg object-cover cursor-pointer"
                        onClick={() => setImagePreview(shop.logoUrl!)}
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
                        <Store className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold">{shop.shopName}</h3>
                      <p className="text-sm text-muted-foreground">{shop.category || 'General Store'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Owner</span>
                      <p className="font-medium">{shop.ownerName}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Phone</span>
                      <p className="font-medium">{shop.phoneNumber}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email</span>
                      <p className="font-medium">{shop.user.email}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Address</span>
                      <p className="font-medium">{shop.address || 'Not provided'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Financial Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950">
                      <Wallet className="h-5 w-5 text-green-600 mb-2" />
                      <span className="text-sm text-muted-foreground">Wallet Balance</span>
                      <p className="text-xl font-bold text-green-600">৳{shop.walletBalance?.toFixed(2) || '0.00'}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950">
                      <Wallet className="h-5 w-5 text-red-600 mb-2" />
                      <span className="text-sm text-muted-foreground">Negative Balance</span>
                      <p className="text-xl font-bold text-red-600">৳{shop.negativeBalance?.toFixed(2) || '0.00'}</p>
                    </div>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Commission Rate:</span>
                    <span className="font-medium ml-2">{shop.commissionRate}%</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">bKash</span>
                      <p className="font-medium">{shop.bkashNumber || 'Not linked'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Nagad</span>
                      <p className="font-medium">{shop.nagadNumber || 'Not linked'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">KYC Documents</CardTitle>
                <CardDescription>Verification documents submitted by the shop partner</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>NID Number</Label>
                    <div className="p-3 rounded-lg bg-muted">
                      <p className="font-mono">{shop.nidNumber || 'Not provided'}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Trade License Number</Label>
                    <div className="p-3 rounded-lg bg-muted">
                      <p className="font-mono">{shop.tradeLicenseNumber || 'Not provided'}</p>
                    </div>
                  </div>
                  {shop.bannerUrl && (
                    <div className="space-y-2 col-span-2">
                      <Label>Shop Banner</Label>
                      <img 
                        src={shop.bannerUrl} 
                        alt="Banner" 
                        className="w-full h-48 object-cover rounded-lg cursor-pointer"
                        onClick={() => setImagePreview(shop.bannerUrl!)}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Products</CardTitle>
              </CardHeader>
              <CardContent>
                {!shop.products?.length ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No products listed yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {shop.products.map((product) => (
                      <div key={product.id} className="border rounded-lg p-4">
                        {product.imageUrl ? (
                          <img 
                            src={product.imageUrl} 
                            alt={product.name} 
                            className="w-full h-32 object-cover rounded-lg mb-3 cursor-pointer"
                            onClick={() => setImagePreview(product.imageUrl!)}
                          />
                        ) : (
                          <div className="w-full h-32 bg-muted rounded-lg mb-3 flex items-center justify-center">
                            <Package className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        <h4 className="font-medium truncate">{product.name}</h4>
                        <div className="flex items-center justify-between mt-2">
                          <span className="font-bold">৳{product.price}</span>
                          <Badge variant={product.isAvailable ? "default" : "secondary"}>
                            {product.isAvailable ? 'Available' : 'Unavailable'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Orders</CardTitle>
              </CardHeader>
              <CardContent>
                {!shop.orders?.length ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No orders yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {shop.orders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(order.createdAt), "MMM d, yyyy h:mm a")}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{order.status}</Badge>
                          <span className="font-bold">৳{order.totalAmount}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Shop Partner</DialogTitle>
              <DialogDescription>
                Provide a reason for rejecting {shop.shopName}
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
              <Button variant="outline" onClick={() => setRejectDialog(false)}>Cancel</Button>
              <Button 
                variant="destructive" 
                onClick={() => statusMutation.mutate({ status: "rejected", rejectionReason })}
                disabled={!rejectionReason.trim() || statusMutation.isPending}
              >
                {statusMutation.isPending ? "Rejecting..." : "Reject"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!imagePreview} onOpenChange={() => setImagePreview(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Image Preview</DialogTitle>
            </DialogHeader>
            {imagePreview && (
              <img src={imagePreview} alt="Preview" className="w-full h-auto rounded-lg" />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
