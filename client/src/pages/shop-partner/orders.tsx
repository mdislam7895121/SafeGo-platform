import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ShoppingCart,
  Clock,
  CheckCircle,
  Package,
  Truck,
  User,
  Phone,
  MapPin,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { bn } from "date-fns/locale";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  placed: { label: "নতুন অর্ডার", color: "bg-blue-500", icon: ShoppingCart },
  accepted: { label: "গৃহীত", color: "bg-yellow-500", icon: CheckCircle },
  packing: { label: "প্যাকিং চলছে", color: "bg-orange-500", icon: Package },
  ready_for_pickup: { label: "ডেলিভারি প্রস্তুত", color: "bg-green-500", icon: Truck },
  picked_up: { label: "পিক আপ হয়েছে", color: "bg-purple-500", icon: Truck },
  delivered: { label: "ডেলিভারি হয়েছে", color: "bg-green-700", icon: CheckCircle },
  cancelled: { label: "বাতিল", color: "bg-red-500", icon: ShoppingCart },
};

const statusFlow = ["placed", "accepted", "packing", "ready_for_pickup", "picked_up", "delivered"];

export default function ShopPartnerOrders() {
  const [activeTab, setActiveTab] = useState("active");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ orders: any[] }>({
    queryKey: ["/api/shop-partner/orders"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      return apiRequest(`/api/shop-partner/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop-partner/orders"] });
      toast({
        title: "সফল!",
        description: "অর্ডার স্ট্যাটাস আপডেট হয়েছে।",
      });
    },
    onError: (error: any) => {
      toast({
        title: "ত্রুটি",
        description: error.message || "স্ট্যাটাস আপডেট ব্যর্থ হয়েছে।",
        variant: "destructive",
      });
    },
  });

  const orders = data?.orders || [];
  const activeOrders = orders.filter((o: any) =>
    ["placed", "accepted", "packing", "ready_for_pickup", "picked_up"].includes(o.status)
  );
  const completedOrders = orders.filter((o: any) =>
    ["delivered", "cancelled"].includes(o.status)
  );

  const getNextStatus = (currentStatus: string) => {
    const currentIndex = statusFlow.indexOf(currentStatus);
    if (currentIndex >= 0 && currentIndex < statusFlow.length - 1) {
      return statusFlow[currentIndex + 1];
    }
    return null;
  };

  const getNextStatusLabel = (currentStatus: string) => {
    const nextStatus = getNextStatus(currentStatus);
    if (!nextStatus) return null;

    const labels: Record<string, string> = {
      accepted: "অর্ডার গ্রহণ করুন",
      packing: "প্যাকিং শুরু করুন",
      ready_for_pickup: "ডেলিভারি প্রস্তুত",
      picked_up: "পিক আপ হয়েছে",
      delivered: "ডেলিভারি হয়েছে",
    };
    return labels[nextStatus] || null;
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const renderOrderCard = (order: any) => {
    const statusInfo = statusConfig[order.status] || statusConfig.placed;
    const StatusIcon = statusInfo.icon;
    const nextStatusLabel = getNextStatusLabel(order.status);
    const nextStatus = getNextStatus(order.status);

    return (
      <Card key={order.id} className="hover-elevate" data-testid={`card-order-${order.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className={`${statusInfo.color} text-white`}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusInfo.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                অর্ডার #{order.id.slice(-6).toUpperCase()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">
                ৳{Number(order.totalAmount).toLocaleString("bn-BD")}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(order.placedAt), "dd MMM, hh:mm a", { locale: bn })}
              </p>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{order.customerName || "গ্রাহক"}</span>
            </div>
            {order.customerPhone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{order.customerPhone}</span>
              </div>
            )}
            {order.deliveryAddress && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="line-clamp-1">{order.deliveryAddress}</span>
              </div>
            )}
          </div>

          <div className="bg-muted/50 rounded-lg p-3 mb-4">
            <p className="text-sm font-medium mb-2">অর্ডার আইটেম:</p>
            <div className="space-y-1">
              {order.items?.map((item: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>
                    {item.productName} x{item.quantity}
                  </span>
                  <span className="font-medium">
                    ৳{Number(item.totalPrice).toLocaleString("bn-BD")}
                  </span>
                </div>
              )) || (
                <p className="text-sm text-muted-foreground">আইটেম তথ্য নেই</p>
              )}
            </div>
          </div>

          {nextStatus && nextStatusLabel && (
            <Button
              className="w-full h-14 text-lg"
              onClick={() =>
                updateStatusMutation.mutate({
                  orderId: order.id,
                  status: nextStatus,
                })
              }
              disabled={updateStatusMutation.isPending}
              data-testid={`button-status-${order.id}`}
            >
              {updateStatusMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  {nextStatusLabel}
                  <ChevronRight className="h-5 w-5 ml-2" />
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-4 md:p-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full h-12 mb-4">
          <TabsTrigger value="active" className="flex-1 h-10 text-base gap-2">
            <Clock className="h-4 w-4" />
            চলমান
            {activeOrders.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {activeOrders.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex-1 h-10 text-base gap-2">
            <CheckCircle className="h-4 w-4" />
            সম্পন্ন
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4 mt-0">
          {activeOrders.length === 0 ? (
            <Card className="p-8 text-center">
              <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">কোন অপেক্ষমান অর্ডার নেই</h3>
              <p className="text-muted-foreground">
                নতুন অর্ডার আসলে এখানে দেখাবে।
              </p>
            </Card>
          ) : (
            activeOrders.map(renderOrderCard)
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4 mt-0">
          {completedOrders.length === 0 ? (
            <Card className="p-8 text-center">
              <CheckCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">কোন সম্পন্ন অর্ডার নেই</h3>
              <p className="text-muted-foreground">
                সম্পন্ন অর্ডারগুলো এখানে দেখাবে।
              </p>
            </Card>
          ) : (
            completedOrders.map(renderOrderCard)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
