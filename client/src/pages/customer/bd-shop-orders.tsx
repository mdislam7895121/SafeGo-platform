import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  Package,
  Store,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  Star,
  MapPin,
  Phone,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/formatCurrency";

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  price: number;
  subtotal: number;
  image?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  statusLabel: string;
  shopName: string;
  shopAddress: string;
  shopLogo?: string;
  deliveryAddress: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  placedAt: string;
  estimatedDeliveryMinutes?: number;
  customerRating?: number;
  customerFeedback?: string;
}

const STATUS_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  placed: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: Clock, label: "অর্ডার করা হয়েছে" },
  accepted: { color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200", icon: CheckCircle, label: "গ্রহণ করা হয়েছে" },
  packing: { color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", icon: Package, label: "প্যাকেজিং চলছে" },
  ready_for_pickup: { color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", icon: Store, label: "পিকআপের জন্য প্রস্তুত" },
  picked_up: { color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200", icon: Truck, label: "পিকআপ হয়েছে" },
  on_the_way: { color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200", icon: Truck, label: "পথে আছে" },
  delivered: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle, label: "ডেলিভারি সম্পন্ন" },
  cancelled_by_customer: { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: XCircle, label: "বাতিল (গ্রাহক)" },
  cancelled_by_shop: { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: XCircle, label: "বাতিল (দোকান)" },
  cancelled_by_driver: { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: XCircle, label: "বাতিল (ড্রাইভার)" },
  refunded: { color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200", icon: XCircle, label: "রিফান্ড হয়েছে" },
};

function OrderStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.placed;
  const Icon = config.icon;
  
  return (
    <Badge className={`${config.color} gap-1`} data-testid={`badge-status-${status}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function RatingStars({ rating, onRate, editable = false }: { rating: number; onRate?: (r: number) => void; editable?: boolean }) {
  return (
    <div className="flex gap-1" data-testid="rating-stars">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => editable && onRate?.(star)}
          disabled={!editable}
          className={`${editable ? "cursor-pointer hover:scale-110" : "cursor-default"} transition-transform`}
          data-testid={`button-star-${star}`}
        >
          <Star
            className={`h-6 w-6 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
          />
        </button>
      ))}
    </div>
  );
}

export default function BDShopOrders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [ratingDialog, setRatingDialog] = useState<{ open: boolean; orderId: string | null }>({ open: false, orderId: null });
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");

  const statusFilter = activeTab === "all" ? undefined : activeTab;

  const { data, isLoading } = useQuery<{ orders: Order[] }>({
    queryKey: ["/api/bd/orders", statusFilter],
    queryFn: () => apiRequest(`/api/bd/orders${statusFilter ? `?status=${statusFilter}` : ""}`),
  });

  const rateMutation = useMutation({
    mutationFn: async ({ orderId, rating, feedback }: { orderId: string; rating: number; feedback: string }) => {
      return apiRequest(`/api/bd/orders/${orderId}/rate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, feedback }),
      });
    },
    onSuccess: () => {
      toast({ title: "ধন্যবাদ!", description: "আপনার রেটিং সফলভাবে জমা হয়েছে" });
      queryClient.invalidateQueries({ queryKey: ["/api/bd/orders"] });
      setRatingDialog({ open: false, orderId: null });
      setRating(0);
      setFeedback("");
    },
    onError: (error: any) => {
      toast({ title: "রেটিং দিতে সমস্যা হয়েছে", description: error.message, variant: "destructive" });
    },
  });

  const orders = data?.orders || [];

  const handleSubmitRating = () => {
    if (!ratingDialog.orderId || rating === 0) {
      toast({ title: "রেটিং নির্বাচন করুন", variant: "destructive" });
      return;
    }
    rateMutation.mutate({ orderId: ratingDialog.orderId, rating, feedback });
  };

  const openRatingDialog = (orderId: string) => {
    setRating(0);
    setFeedback("");
    setRatingDialog({ open: true, orderId });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card">
        <div className="flex h-14 items-center gap-4 px-4">
          <Link href="/customer/bd-shops">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold" data-testid="text-page-title">আমার অর্ডার</h1>
            <p className="text-xs text-muted-foreground">SafeGo Shop</p>
          </div>
        </div>
      </header>

      <main className="p-4 max-w-3xl mx-auto space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="all" data-testid="tab-all">সব</TabsTrigger>
            <TabsTrigger value="placed" data-testid="tab-active">চলমান</TabsTrigger>
            <TabsTrigger value="delivered" data-testid="tab-delivered">সম্পন্ন</TabsTrigger>
            <TabsTrigger value="cancelled" data-testid="tab-cancelled">বাতিল</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4 space-y-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))
            ) : orders.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">কোনো অর্ডার নেই</p>
                  <Link href="/customer/bd-shops">
                    <Button className="mt-4" data-testid="button-start-shopping">
                      শপিং শুরু করুন
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              orders.map((order) => (
                <Card key={order.id} className="hover-elevate" data-testid={`card-order-${order.id}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        {order.shopLogo ? (
                          <img 
                            src={order.shopLogo} 
                            alt={order.shopName}
                            className="h-12 w-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                            <Store className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <h3 className="font-medium" data-testid={`text-shop-name-${order.id}`}>{order.shopName}</h3>
                          <p className="text-xs text-muted-foreground" data-testid={`text-order-number-${order.id}`}>
                            #{order.orderNumber}
                          </p>
                        </div>
                      </div>
                      <OrderStatusBadge status={order.status} />
                    </div>

                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      {format(new Date(order.placedAt), "dd MMM yyyy, hh:mm a")}
                    </div>

                    <div className="text-sm">
                      <p className="text-muted-foreground">{order.items.length} আইটেম</p>
                      <ul className="mt-1 space-y-0.5">
                        {order.items.slice(0, 2).map((item) => (
                          <li key={item.id} className="text-xs text-muted-foreground">
                            {item.productName} x{item.quantity}
                          </li>
                        ))}
                        {order.items.length > 2 && (
                          <li className="text-xs text-muted-foreground">
                            +{order.items.length - 2} আরও...
                          </li>
                        )}
                      </ul>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground">মোট</p>
                        <p className="font-bold text-lg" data-testid={`text-total-${order.id}`}>
                          {formatCurrency(order.totalAmount, "BDT")}
                        </p>
                      </div>
                      
                      <div className="flex gap-2">
                        {order.status === "delivered" && !order.customerRating && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => openRatingDialog(order.id)}
                            data-testid={`button-rate-${order.id}`}
                          >
                            <Star className="h-4 w-4 mr-1" />
                            রেটিং দিন
                          </Button>
                        )}
                        {order.customerRating && (
                          <div className="flex items-center gap-1 text-sm">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span>{order.customerRating}</span>
                          </div>
                        )}
                        <Link href={`/customer/bd-shop-order/${order.id}`}>
                          <Button variant="ghost" size="sm" data-testid={`button-view-${order.id}`}>
                            বিস্তারিত
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={ratingDialog.open} onOpenChange={(open) => setRatingDialog({ open, orderId: ratingDialog.orderId })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>অর্ডার রেটিং দিন</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <RatingStars rating={rating} onRate={setRating} editable />
            </div>
            <Textarea
              placeholder="আপনার মতামত লিখুন (ঐচ্ছিক)"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              data-testid="input-feedback"
            />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setRatingDialog({ open: false, orderId: null })}
              data-testid="button-cancel-rating"
            >
              বাতিল
            </Button>
            <Button 
              onClick={handleSubmitRating}
              disabled={rating === 0 || rateMutation.isPending}
              data-testid="button-submit-rating"
            >
              জমা দিন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
