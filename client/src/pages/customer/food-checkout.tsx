import { Link, useLocation } from "wouter";
import { ArrowLeft, Plus, Minus, Trash2, ShoppingCart, MapPin, CreditCard, Ticket, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEatsCart } from "@/contexts/EatsCartContext";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function FoodCheckout() {
  const [, setLocationPath] = useLocation();
  const { toast } = useToast();
  const {
    state,
    updateQuantity,
    removeItem,
    setSpecialInstructions,
    setPaymentMethod,
    clearCart,
    getTotals,
    isEmpty,
    hasMinimumOrder,
  } = useEatsCart();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [promoInput, setPromoInput] = useState("");

  const totals = getTotals();

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(itemId);
      toast({
        title: "Item removed",
        description: "Item has been removed from your cart.",
      });
    } else {
      updateQuantity(itemId, newQuantity);
    }
  };

  const handlePlaceOrder = async () => {
    if (!state.paymentMethod) {
      toast({
        title: "Payment required",
        description: "Please select a payment method.",
        variant: "destructive",
      });
      return;
    }

    if (!hasMinimumOrder && state.restaurant?.minOrderAmount) {
      toast({
        title: "Minimum order not met",
        description: `Minimum order is $${state.restaurant.minOrderAmount.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast({
        title: "Order placed!",
        description: "Your order has been submitted. The restaurant will confirm shortly.",
      });
      
      clearCart();
      setLocationPath("/customer/food/orders");
    } catch (error: any) {
      toast({
        title: "Order failed",
        description: error.message || "Could not place your order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEmpty) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <Link href="/customer/food">
              <Button variant="ghost" size="icon" className="text-primary-foreground" data-testid="button-back">
                <ArrowLeft className="h-6 w-6" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Your Cart</h1>
          </div>
        </header>

        <div className="p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">Your cart is empty</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Add items from a restaurant to get started.
              </p>
              <Link href="/customer/food">
                <Button data-testid="button-browse-restaurants">
                  Browse Restaurants
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href={state.restaurant ? `/customer/food/${state.restaurant.id}` : "/customer/food"}>
            <Button variant="ghost" size="icon" className="text-primary-foreground" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Your Cart</h1>
            {state.restaurant && (
              <p className="text-sm opacity-90">{state.restaurant.name}</p>
            )}
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Cart Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Order Items ({totals.itemCount})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {state.items.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-4 pb-4 border-b last:border-0 last:pb-0"
                data-testid={`cart-item-${item.id}`}
              >
                {item.imageUrl && (
                  <div className="flex-shrink-0">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium" data-testid={`text-item-name-${item.id}`}>
                    {item.name}
                  </h4>
                  {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {item.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-semibold" data-testid={`text-item-total-${item.id}`}>
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                        data-testid={`button-decrement-${item.id}`}
                      >
                        {item.quantity === 1 ? <Trash2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                      </Button>
                      <span className="w-8 text-center font-semibold" data-testid={`text-quantity-${item.id}`}>
                        {item.quantity}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                        data-testid={`button-increment-${item.id}`}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Special Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Special Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Any special requests for your order..."
              value={state.specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              rows={2}
              data-testid="input-special-instructions"
            />
          </CardContent>
        </Card>

        {/* Delivery Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" />
              Delivery Address
            </CardTitle>
          </CardHeader>
          <CardContent>
            {state.deliveryAddress ? (
              <div className="flex items-center justify-between">
                <p className="text-sm">{state.deliveryAddress.address}</p>
                <Button variant="outline" size="sm" data-testid="button-change-address">
                  Change
                </Button>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3">
                  No delivery address set
                </p>
                <Button variant="outline" size="sm" data-testid="button-add-address">
                  Add Address
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={state.paymentMethod || ""}
              onValueChange={setPaymentMethod}
            >
              <SelectTrigger data-testid="select-payment-method">
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash on Delivery</SelectItem>
                <SelectItem value="card">Credit/Debit Card</SelectItem>
                <SelectItem value="wallet">SafeGo Wallet</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Promo Code */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Ticket className="h-4 w-4" />
              Promo Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Enter promo code"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
                data-testid="input-promo-code"
              />
              <Button 
                variant="outline"
                disabled={!promoInput.trim()}
                data-testid="button-apply-promo"
              >
                Apply
              </Button>
            </div>
            {state.promoCode && (
              <div className="mt-2 flex items-center justify-between">
                <Badge variant="secondary" className="gap-1">
                  {state.promoCode}
                </Badge>
                <span className="text-sm text-green-600">-${state.promoDiscount.toFixed(2)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span data-testid="text-subtotal">${totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Delivery Fee</span>
              <span data-testid="text-delivery-fee">${totals.deliveryFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Service Fee</span>
              <span data-testid="text-service-fee">${totals.serviceFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span data-testid="text-tax">${totals.tax.toFixed(2)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span data-testid="text-discount">-${totals.discount.toFixed(2)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-semibold text-lg">
              <span>Total</span>
              <span data-testid="text-total">${totals.total.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Minimum Order Warning */}
        {!hasMinimumOrder && state.restaurant?.minOrderAmount && (
          <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-900 dark:text-yellow-200">
                  Minimum order not met
                </p>
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  Add ${(state.restaurant.minOrderAmount - totals.subtotal).toFixed(2)} more to reach the minimum order of ${state.restaurant.minOrderAmount.toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Place Order Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-lg z-50">
        <Button
          className="w-full"
          size="lg"
          onClick={handlePlaceOrder}
          disabled={isSubmitting || (!hasMinimumOrder && !!state.restaurant?.minOrderAmount)}
          data-testid="button-place-order"
        >
          {isSubmitting ? "Placing Order..." : `Place Order - $${totals.total.toFixed(2)}`}
        </Button>
      </div>
    </div>
  );
}
