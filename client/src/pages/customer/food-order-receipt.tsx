import { useRoute, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
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
} from "lucide-react";

interface FoodOrderReceipt {
  id: string;
  restaurantId: string;
  restaurantName: string;
  restaurantAddress?: string;
  deliveryAddress: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    menuItemId?: string;
  }>;
  serviceFare: number;
  deliveryFee?: number;
  subtotal?: number;
  taxAmount?: number;
  tipAmount?: number;
  discountAmount?: number;
  promoCode?: string;
  status: string;
  paymentMethod: string;
  createdAt: string;
  deliveredAt: string | null;
  estimatedDeliveryTime?: string;
}

export default function FoodOrderReceipt() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/customer/food-orders/:id/receipt");
  const orderId = params?.id;
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<{ order: FoodOrderReceipt }>({
    queryKey: ["/api/food-orders", orderId],
    enabled: !!orderId,
  });

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
  
  const itemsSubtotal = order.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const deliveryFee = order.deliveryFee ?? order.serviceFare;
  const taxAmount = order.taxAmount ?? 0;
  const tipAmount = order.tipAmount ?? 0;
  const discountAmount = order.discountAmount ?? 0;
  const total = itemsSubtotal + deliveryFee + taxAmount + tipAmount - discountAmount;

  const handleDownloadReceipt = () => {
    const receiptText = `
SafeGo Eats Receipt
===================

Order ID: ${order.id.slice(0, 8).toUpperCase()}
Date: ${orderDate.toLocaleDateString()} at ${orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}

RESTAURANT
----------
${order.restaurantName}
${order.restaurantAddress || ''}

DELIVERY ADDRESS
----------------
${order.deliveryAddress}

ORDER ITEMS
-----------
${order.items.map(item => `${item.quantity}x ${item.name} - $${(item.quantity * item.price).toFixed(2)}`).join('\n')}

RECEIPT
-------
Subtotal: $${itemsSubtotal.toFixed(2)}
Delivery Fee: $${deliveryFee.toFixed(2)}
${taxAmount > 0 ? `Tax: $${taxAmount.toFixed(2)}\n` : ''}${tipAmount > 0 ? `Tip: $${tipAmount.toFixed(2)}\n` : ''}${discountAmount > 0 ? `Discount${order.promoCode ? ` (${order.promoCode})` : ''}: -$${discountAmount.toFixed(2)}\n` : ''}-----------
TOTAL: $${total.toFixed(2)}

Payment: ${order.paymentMethod === 'online' ? 'Card' : 'Cash'}
Status: ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}
${deliveryDate ? `Delivered: ${deliveryDate.toLocaleDateString()} at ${deliveryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}

Thank you for ordering with SafeGo Eats!
    `.trim();

    const blob = new Blob([receiptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `safego-eats-receipt-${order.id.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Receipt downloaded",
      description: "Your receipt has been saved as a text file.",
    });
  };

  const handleShare = async () => {
    const shareText = `SafeGo Eats order from ${order.restaurantName} - $${total.toFixed(2)} - Order #${order.id.slice(0, 8).toUpperCase()}`;
    
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
  const headerColor = isCompleted 
    ? "from-green-600 to-green-500" 
    : "from-primary to-primary/80";

  return (
    <div className="min-h-screen bg-background pb-24">
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
            ) : (
              <Receipt className="h-10 w-10" />
            )}
          </div>
          <h2 className="text-2xl font-bold mb-1">
            {isCompleted ? "Order Delivered" : "Order " + order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </h2>
          <p className="text-white/80">
            {orderDate.toLocaleDateString()} at {orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      <div className="px-4 -mt-6 space-y-4">
        <Card className="shadow-lg" data-testid="receipt-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Order Details
              </CardTitle>
              <Badge variant="secondary" className="font-mono text-xs">
                #{order.id.slice(0, 8).toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Store className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Restaurant</p>
                <p className="font-medium" data-testid="text-restaurant">{order.restaurantName}</p>
                {order.restaurantAddress && (
                  <p className="text-sm text-muted-foreground">{order.restaurantAddress}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
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
                Order Items
              </h4>
              
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm" data-testid={`item-${idx}`}>
                  <span className="text-muted-foreground">
                    {item.quantity}x {item.name}
                  </span>
                  <span>${(item.quantity * item.price).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Payment Summary
              </h4>
              
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span data-testid="text-subtotal">${itemsSubtotal.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Delivery Fee</span>
                <span data-testid="text-delivery-fee">${deliveryFee.toFixed(2)}</span>
              </div>
              
              {taxAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span data-testid="text-tax">${taxAmount.toFixed(2)}</span>
                </div>
              )}
              
              {tipAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tip</span>
                  <span data-testid="text-tip">${tipAmount.toFixed(2)}</span>
                </div>
              )}
              
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount{order.promoCode ? ` (${order.promoCode})` : ''}</span>
                  <span data-testid="text-discount">-${discountAmount.toFixed(2)}</span>
                </div>
              )}

              <Separator className="my-2" />
              
              <div className="flex justify-between items-center">
                <span className="font-bold text-lg">Total</span>
                <span className="font-bold text-2xl" data-testid="text-total">${total.toFixed(2)}</span>
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

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleDownloadReceipt}
            data-testid="button-download"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button
            variant="outline"
            className="flex-1"
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
          Done
        </Button>
      </div>
    </div>
  );
}
