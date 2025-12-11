import { useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { jsPDF } from "jspdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useToast } from "@/hooks/use-toast";
import { useEatsCart } from "@/contexts/EatsCartContext";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/formatCurrency";
import { computeOrderTotals } from "@/lib/foodOrderUtils";
import {
  ArrowLeft,
  CheckCircle2,
  MapPin,
  Calendar,
  Clock,
  Receipt,
  DollarSign,
  Download,
  Share2,
  Store,
  Copy,
  Headphones,
  CreditCard,
  Banknote,
  UtensilsCrossed,
  User,
  Car,
  Package,
  ChefHat,
  Truck,
  XCircle,
  RotateCcw,
  Loader2,
  FileText,
} from "lucide-react";

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  menuItemId: string;
}

interface DriverInfo {
  id: string;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  vehicle: {
    make: string;
    model: string;
    color: string | null;
    plate: string | null;
  } | null;
}

interface FoodOrderReceipt {
  id: string;
  orderCode: string | null;
  restaurantId: string;
  restaurantName: string;
  restaurantAddress?: string;
  restaurantCuisine?: string;
  restaurantLogo?: string;
  deliveryAddress: string;
  items: OrderItem[];
  itemsCount: number;
  subtotal: number | null;
  serviceFare: number;
  deliveryFee?: number;
  taxAmount?: number;
  tipAmount?: number;
  discountAmount?: number;
  promoCode?: string;
  status: string;
  paymentMethod: string;
  createdAt: string;
  acceptedAt?: string | null;
  preparingAt?: string | null;
  readyAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt: string | null;
  cancelledAt?: string | null;
  driver?: DriverInfo | null;
  hasReview?: boolean;
}

interface TimelineStep {
  status: string;
  label: string;
  description: string;
  timestamp: string | null;
  icon: typeof Clock;
  completed: boolean;
  active: boolean;
}

function DeliveryTimeline({ order }: { order: FoodOrderReceipt }) {
  const isDelivered = order.status.toLowerCase() === 'delivered';
  const isCancelled = order.status.toLowerCase() === 'cancelled';

  const formatTime = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const steps: TimelineStep[] = [
    {
      status: 'placed',
      label: 'Order Placed',
      description: 'Your order has been received',
      timestamp: order.createdAt,
      icon: Receipt,
      completed: true,
      active: !order.acceptedAt,
    },
    {
      status: 'accepted',
      label: 'Order Confirmed',
      description: 'Restaurant accepted your order',
      timestamp: order.acceptedAt || null,
      icon: CheckCircle2,
      completed: !!order.acceptedAt,
      active: !!order.acceptedAt && !order.preparingAt,
    },
    {
      status: 'preparing',
      label: 'Preparing',
      description: 'Restaurant is preparing your food',
      timestamp: order.preparingAt || null,
      icon: ChefHat,
      completed: !!order.preparingAt,
      active: !!order.preparingAt && !order.readyAt,
    },
    {
      status: 'ready',
      label: 'Ready for Pickup',
      description: 'Food is ready for driver',
      timestamp: order.readyAt || null,
      icon: Package,
      completed: !!order.readyAt,
      active: !!order.readyAt && !order.pickedUpAt,
    },
    {
      status: 'picked_up',
      label: 'Picked Up',
      description: 'Driver picked up your order',
      timestamp: order.pickedUpAt || null,
      icon: Truck,
      completed: !!order.pickedUpAt,
      active: !!order.pickedUpAt && !order.deliveredAt,
    },
    {
      status: 'delivered',
      label: 'Delivered',
      description: 'Order delivered successfully',
      timestamp: order.deliveredAt || null,
      icon: CheckCircle2,
      completed: !!order.deliveredAt,
      active: false,
    },
  ];

  if (isCancelled) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h3 className="font-semibold text-destructive">Order Cancelled</h3>
              <p className="text-sm text-muted-foreground">
                {order.cancelledAt ? formatTime(order.cancelledAt) : 'Cancelled'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Delivery Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="relative space-y-0">
          {steps.map((step, index) => {
            const IconComponent = step.icon;
            const isLast = index === steps.length - 1;
            
            return (
              <div key={step.status} className="relative flex gap-4">
                {!isLast && (
                  <div 
                    className={`absolute left-[17px] top-9 w-0.5 h-[calc(100%-12px)] ${
                      step.completed ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                )}
                
                <div 
                  className={`relative z-10 h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                    step.completed 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <IconComponent className="h-4 w-4" />
                </div>
                
                <div className="flex-1 pb-6">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className={`font-medium text-sm ${step.completed ? '' : 'text-muted-foreground'}`}>
                        {step.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                    {step.timestamp && step.completed && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTime(step.timestamp)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function DriverInfoCard({ driver }: { driver: DriverInfo }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Truck className="h-4 w-4" />
          Delivery Driver
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            {driver.photoUrl ? (
              <AvatarImage src={driver.photoUrl} alt={driver.firstName} />
            ) : null}
            <AvatarFallback>
              <User className="h-6 w-6" />
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <p className="font-semibold">
              {driver.firstName} {driver.lastName || ''}
            </p>
            {driver.vehicle && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Car className="h-4 w-4" />
                <span>
                  {driver.vehicle.color && `${driver.vehicle.color} `}
                  {driver.vehicle.make} {driver.vehicle.model}
                </span>
                {driver.vehicle.plate && (
                  <>
                    <span className="opacity-50">•</span>
                    <span className="font-mono">{driver.vehicle.plate}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FoodOrderReceipt() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/customer/food-orders/:id/receipt");
  const orderId = params?.id;
  const { toast } = useToast();
  const { setCartFromReorder, isFromDifferentRestaurant, state: cartState } = useEatsCart();
  const [reorderConfirmOpen, setReorderConfirmOpen] = useState(false);

  const { data, isLoading, error } = useQuery<{ order: FoodOrderReceipt }>({
    queryKey: ["/api/customer/food-orders", orderId],
    enabled: !!orderId,
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return apiRequest(`/api/customer/food/orders/${orderId}/reorder`, { method: 'GET' });
    },
    onSuccess: (reorderData: any) => {
      if (reorderData.items && reorderData.restaurant) {
        setCartFromReorder(reorderData.restaurant, reorderData.items);
        toast({
          title: "Items added to cart",
          description: `${reorderData.items.length} item(s) from ${reorderData.restaurant.name} added to your cart`,
        });
        setLocation("/customer/food/checkout");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Reorder failed",
        description: error.message || "Could not reorder. Some items may no longer be available.",
        variant: "destructive",
      });
    },
  });

  const handleReorder = () => {
    if (!data?.order) return;
    
    if (cartState.items.length > 0 && isFromDifferentRestaurant(data.order.restaurantId)) {
      setReorderConfirmOpen(true);
    } else {
      reorderMutation.mutate(orderId!);
    }
  };

  const confirmReorder = () => {
    if (orderId) {
      reorderMutation.mutate(orderId);
    }
    setReorderConfirmOpen(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6 pb-12">
          <div className="flex items-center gap-4 mb-6">
            <Skeleton className="h-10 w-10 rounded-full bg-white/20" />
            <Skeleton className="h-6 w-32 bg-white/20" />
          </div>
          <div className="text-center">
            <Skeleton className="h-20 w-20 mx-auto mb-4 rounded-full bg-white/20" />
            <Skeleton className="h-8 w-48 mx-auto mb-2 bg-white/20" />
            <Skeleton className="h-4 w-32 mx-auto bg-white/20" />
          </div>
        </div>
        <div className="px-4 -mt-6 space-y-4">
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-full mb-4" />
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !data?.order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <UtensilsCrossed className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Receipt Not Found</h2>
            <p className="text-muted-foreground mb-6">
              We couldn't find this order receipt. It may have been removed or the order doesn't exist.
            </p>
            <Link href="/customer/food/orders">
              <Button data-testid="button-back-to-orders">Back to Order History</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const order = data.order;
  const orderDate = new Date(order.createdAt);
  const deliveryDate = order.deliveredAt ? new Date(order.deliveredAt) : null;
  
  const orderTotals = computeOrderTotals(order);
  const { 
    itemsSubtotal, 
    deliveryFee, 
    taxAmount, 
    tipAmount, 
    discountAmount, 
    total,
    hasBreakdown 
  } = orderTotals;

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;
    const lineHeight = 7;
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;

    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("SafeGo Eats", pageWidth / 2, y, { align: "center" });
    y += 10;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Order Receipt", pageWidth / 2, y, { align: "center" });
    y += 15;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Order ID:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(`#${order.orderCode || order.id.slice(0, 8).toUpperCase()}`, margin + 25, y);
    y += lineHeight;

    doc.setFont("helvetica", "bold");
    doc.text("Date:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(orderDate.toLocaleDateString() + " at " + orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), margin + 25, y);
    y += lineHeight;

    doc.setFont("helvetica", "bold");
    doc.text("Status:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(order.status.charAt(0).toUpperCase() + order.status.slice(1), margin + 25, y);
    y += 15;

    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Restaurant", margin, y);
    y += lineHeight;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(order.restaurantName, margin, y);
    y += lineHeight;
    if (order.restaurantAddress) {
      const addressLines = doc.splitTextToSize(order.restaurantAddress, contentWidth);
      doc.text(addressLines, margin, y);
      y += addressLines.length * lineHeight;
    }
    y += 5;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Delivery Address", margin, y);
    y += lineHeight;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const deliveryLines = doc.splitTextToSize(order.deliveryAddress, contentWidth);
    doc.text(deliveryLines, margin, y);
    y += deliveryLines.length * lineHeight + 10;

    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Order Items", margin, y);
    y += lineHeight + 3;

    doc.setFontSize(10);
    order.items.forEach((item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;
      const itemTotal = qty * price;
      doc.setFont("helvetica", "normal");
      doc.text(`${qty}x ${item.name || 'Item'}`, margin, y);
      doc.text(formatCurrency(itemTotal, "USD"), pageWidth - margin, y, { align: "right" });
      y += lineHeight;
    });
    y += 5;

    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Payment Summary", margin, y);
    y += lineHeight + 3;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    if (hasBreakdown) {
      doc.text("Subtotal", margin, y);
      doc.text(formatCurrency(itemsSubtotal, "USD"), pageWidth - margin, y, { align: "right" });
      y += lineHeight;

      if (deliveryFee > 0) {
        doc.text("Delivery Fee", margin, y);
        doc.text(formatCurrency(deliveryFee, "USD"), pageWidth - margin, y, { align: "right" });
        y += lineHeight;
      }

      if (taxAmount > 0) {
        doc.text("Tax", margin, y);
        doc.text(formatCurrency(taxAmount, "USD"), pageWidth - margin, y, { align: "right" });
        y += lineHeight;
      }

      if (tipAmount > 0) {
        doc.text("Tip", margin, y);
        doc.text(formatCurrency(tipAmount, "USD"), pageWidth - margin, y, { align: "right" });
        y += lineHeight;
      }

      if (discountAmount > 0) {
        doc.setTextColor(34, 139, 34);
        doc.text(`Discount${order.promoCode ? ` (${order.promoCode})` : ''}`, margin, y);
        doc.text(`-${formatCurrency(discountAmount, "USD")}`, pageWidth - margin, y, { align: "right" });
        doc.setTextColor(0, 0, 0);
        y += lineHeight;
      }
    } else {
      doc.text("Order Total", margin, y);
      doc.text(formatCurrency(total, "USD"), pageWidth - margin, y, { align: "right" });
      y += lineHeight;
    }

    y += 3;
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Total", margin, y);
    doc.text(formatCurrency(total, "USD"), pageWidth - margin, y, { align: "right" });
    y += 15;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Payment Method: ${order.paymentMethod === 'online' ? 'Card' : 'Cash'}`, margin, y);
    y += lineHeight;

    if (deliveryDate) {
      doc.text(`Delivered: ${deliveryDate.toLocaleDateString()} at ${deliveryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, margin, y);
      y += lineHeight;
    }

    if (order.driver) {
      y += 5;
      doc.text(`Driver: ${order.driver.firstName} ${order.driver.lastName || ''}`, margin, y);
      y += lineHeight;
      if (order.driver.vehicle) {
        doc.text(`Vehicle: ${order.driver.vehicle.color || ''} ${order.driver.vehicle.make} ${order.driver.vehicle.model}${order.driver.vehicle.plate ? ` (${order.driver.vehicle.plate})` : ''}`, margin, y);
      }
    }

    y = doc.internal.pageSize.getHeight() - 30;
    doc.setFontSize(10);
    doc.setTextColor(128, 128, 128);
    doc.text("Thank you for ordering with SafeGo Eats!", pageWidth / 2, y, { align: "center" });
    y += lineHeight;
    doc.text("For support, visit safego.app/support", pageWidth / 2, y, { align: "center" });

    const filename = `SafeGo-Receipt-${order.orderCode || order.id.slice(0, 8)}.pdf`;
    doc.save(filename);
    
    toast({
      title: "Receipt downloaded",
      description: "Your PDF receipt has been saved.",
    });
  };

  const handleShare = async () => {
    const shareText = `SafeGo Eats order from ${order.restaurantName} - ${formatCurrency(total, "USD")} - Order #${order.orderCode || order.id.slice(0, 8).toUpperCase()}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'SafeGo Eats Receipt',
          text: shareText,
        });
      } catch {
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        toast({
          title: "Copied to clipboard",
          description: "Receipt details have been copied.",
        });
      } catch {
        toast({
          title: "Unable to share",
          description: "Could not copy receipt details.",
          variant: "destructive",
        });
      }
    }
  };

  const isCompleted = order.status.toLowerCase() === 'delivered';
  const isCancelled = order.status.toLowerCase() === 'cancelled';
  const headerColor = isCompleted 
    ? "from-green-600 to-green-500" 
    : isCancelled 
      ? "from-red-600 to-red-500"
      : "from-primary to-primary/80";

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className={`bg-gradient-to-br ${headerColor} text-white p-6 pb-12 relative`}>
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/customer/food/orders")}
            className="text-white hover:bg-white/10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Order Receipt</h1>
        </div>
        
        <div className="text-center">
          <div className="h-20 w-20 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center">
            {isCompleted ? (
              <CheckCircle2 className="h-10 w-10" />
            ) : isCancelled ? (
              <XCircle className="h-10 w-10" />
            ) : (
              <Receipt className="h-10 w-10" />
            )}
          </div>
          <h2 className="text-2xl font-bold mb-1">
            {isCompleted ? "Order Delivered" : isCancelled ? "Order Cancelled" : "Order " + order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </h2>
          <p className="text-white/80">
            {orderDate.toLocaleDateString()} at {orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          {order.orderCode && (
            <Badge variant="secondary" className="mt-2 bg-white/20 text-white font-mono">
              #{order.orderCode.slice(0, 8)}
            </Badge>
          )}
        </div>
      </div>

      <div className="px-4 -mt-6 space-y-4">
        <DeliveryTimeline order={order} />

        {order.driver && <DriverInfoCard driver={order.driver} />}

        <Card className="shadow-lg" data-testid="receipt-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Order Details
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Avatar className="h-12 w-12 rounded-lg flex-shrink-0">
                {order.restaurantLogo ? (
                  <AvatarImage src={order.restaurantLogo} alt={order.restaurantName} className="object-cover" />
                ) : null}
                <AvatarFallback className="rounded-lg bg-primary/10">
                  <Store className="h-6 w-6 text-primary" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Restaurant</p>
                <p className="font-medium" data-testid="text-restaurant">{order.restaurantName}</p>
                {order.restaurantAddress && (
                  <p className="text-sm text-muted-foreground">{order.restaurantAddress}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-6 w-6 text-red-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Delivered to</p>
                <p className="font-medium" data-testid="text-delivery-address">{order.deliveryAddress}</p>
              </div>
            </div>

            <div className="flex gap-4 py-2 flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span data-testid="text-order-date">
                  {orderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              {deliveryDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span data-testid="text-delivery-time">
                    Delivered {deliveryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4" />
                Order Items ({order.items.length})
              </h4>
              
              {order.items.map((item, idx) => {
                const qty = Number(item.quantity) || 0;
                const price = Number(item.price) || 0;
                return (
                  <div key={idx} className="flex justify-between text-sm py-1" data-testid={`item-${idx}`}>
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground">{qty}x</span> {item.name || 'Item'}
                    </span>
                    <span className="font-medium">{formatCurrency(qty * price, "USD")}</span>
                  </div>
                );
              })}
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Payment Summary
              </h4>
              
              {hasBreakdown ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span data-testid="text-subtotal">{formatCurrency(itemsSubtotal, "USD")}</span>
                  </div>
                  
                  {deliveryFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Delivery Fee</span>
                      <span data-testid="text-delivery-fee">{formatCurrency(deliveryFee, "USD")}</span>
                    </div>
                  )}
                  
                  {taxAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span data-testid="text-tax">{formatCurrency(taxAmount, "USD")}</span>
                    </div>
                  )}
                  
                  {tipAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tip</span>
                      <span data-testid="text-tip">{formatCurrency(tipAmount, "USD")}</span>
                    </div>
                  )}
                  
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount{order.promoCode ? ` (${order.promoCode})` : ''}</span>
                      <span data-testid="text-discount">-{formatCurrency(discountAmount, "USD")}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Order Total</span>
                  <span data-testid="text-subtotal">{formatCurrency(total, "USD")}</span>
                </div>
              )}

              <Separator className="my-2" />
              
              <div className="flex justify-between items-center">
                <span className="font-bold text-lg">Total</span>
                <span className="font-bold text-2xl" data-testid="text-total">{formatCurrency(total, "USD")}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="payment-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  {order.paymentMethod === 'online' ? (
                    <CreditCard className="h-5 w-5" />
                  ) : (
                    <Banknote className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p className="font-medium">Payment Method</p>
                  <p className="text-sm text-muted-foreground">
                    {order.paymentMethod === 'online' ? 'Paid by Card' : 'Paid by Cash'}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-green-600 border-green-600">Paid</Badge>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={generatePDF}
            data-testid="button-download-pdf"
          >
            <FileText className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleShare}
            data-testid="button-share"
          >
            {'share' in navigator ? (
              <Share2 className="h-4 w-4 mr-2" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            {'share' in navigator ? 'Share' : 'Copy'}
          </Button>
        </div>

        {isCompleted && (
          <Button
            variant="outline"
            className="w-full"
            onClick={handleReorder}
            disabled={reorderMutation.isPending}
            data-testid="button-reorder"
          >
            {reorderMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-2" />
            )}
            Order Again
          </Button>
        )}
        
        <Link href="/customer/support">
          <Button
            variant="outline"
            className="w-full"
            data-testid="button-contact-support"
          >
            <Headphones className="h-4 w-4 mr-2" />
            Need help? Contact Support
          </Button>
        </Link>
      </div>

      <div 
        className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t p-4"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
      >
        <Button
          onClick={() => setLocation("/customer/food/orders")}
          size="lg"
          className="w-full text-base font-semibold"
          data-testid="button-done"
        >
          Back to Order History
        </Button>
      </div>

      <AlertDialog open={reorderConfirmOpen} onOpenChange={setReorderConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new order?</AlertDialogTitle>
            <AlertDialogDescription>
              You have items from {cartState.restaurant?.name} in your cart. 
              Reordering from {order.restaurantName} will replace your current cart.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-reorder">Keep current cart</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReorder} data-testid="button-confirm-reorder">
              Start new order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
