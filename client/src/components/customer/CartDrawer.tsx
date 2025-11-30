import { Link, useLocation } from "wouter";
import { Plus, Minus, Trash2, X, ShoppingCart, ArrowRight, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { useEatsCart } from "@/contexts/EatsCartContext";
import { useAuth } from "@/contexts/AuthContext";

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CartDrawer({ open, onOpenChange }: CartDrawerProps) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const {
    state,
    updateQuantity,
    removeItem,
    getTotals,
    isEmpty,
    hasMinimumOrder,
  } = useEatsCart();

  const totals = getTotals();
  const isLoggedIn = !!user && user.role === "customer";

  const handleCheckout = () => {
    onOpenChange(false);
    if (isLoggedIn) {
      setLocation("/customer/food/checkout");
    } else {
      setLocation("/auth/login?redirect=/customer/food/checkout");
    }
  };

  const handleViewRestaurant = () => {
    if (state.restaurant?.id) {
      onOpenChange(false);
      setLocation(`/customer/food/${state.restaurant.id}`);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col w-full sm:max-w-md p-0">
        <SheetHeader className="p-3 sm:p-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-base sm:text-lg">
            <ShoppingCart className="h-5 w-5" />
            Your Cart
            {!isEmpty && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {totals.itemCount} items
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        {isEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 text-center">
            <ShoppingCart className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-base sm:text-lg mb-2">Your cart is empty</h3>
            <p className="text-muted-foreground text-xs sm:text-sm mb-4">
              Add items from a restaurant to start your order
            </p>
            <Button 
              className="h-10 touch-manipulation" 
              onClick={() => onOpenChange(false)} 
              data-testid="button-browse-restaurants"
            >
              Browse Restaurants
            </Button>
          </div>
        ) : (
          <>
            {/* Restaurant Info - Touch-friendly */}
            {state.restaurant && (
              <button
                onClick={handleViewRestaurant}
                className="flex items-center gap-3 p-3 sm:p-4 border-b hover:bg-muted/50 transition-colors w-full text-left min-h-[60px] touch-manipulation"
                data-testid="button-view-restaurant"
              >
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                  {state.restaurant.logoUrl ? (
                    <img 
                      src={state.restaurant.logoUrl} 
                      alt={state.restaurant.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <Store className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm sm:text-base truncate" data-testid="text-cart-restaurant-name">{state.restaurant.name}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate" data-testid="text-cart-restaurant-cuisine">{state.restaurant.cuisineType}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </button>
            )}

            {/* Cart Items */}
            <ScrollArea className="flex-1">
              <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                {state.items.map((item) => (
                  <div key={item.id} className="flex gap-2 sm:gap-3" data-testid={`cart-item-${item.id}`}>
                    {/* Item Image */}
                    <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                      {item.imageUrl ? (
                        <img 
                          src={item.imageUrl} 
                          alt={item.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-muted-foreground text-[10px] sm:text-xs">
                          No image
                        </div>
                      )}
                    </div>

                    {/* Item Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <p className="font-medium text-xs sm:text-sm truncate" data-testid={`text-item-name-${item.id}`}>{item.name}</p>
                          {item.specialInstructions && (
                            <p className="text-[10px] sm:text-xs text-muted-foreground truncate" data-testid={`text-item-instructions-${item.id}`}>
                              Note: {item.specialInstructions}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0 -mr-1 touch-manipulation"
                          onClick={() => removeItem(item.id)}
                          data-testid={`button-remove-item-${item.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="flex items-center justify-between mt-1.5 sm:mt-2">
                        <p className="font-semibold text-xs sm:text-sm" data-testid={`text-item-price-${item.id}`}>
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>
                        <div className="flex items-center gap-0.5 bg-muted rounded-full p-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-full touch-manipulation"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            data-testid={`button-decrease-${item.id}`}
                          >
                            {item.quantity === 1 ? (
                              <Trash2 className="h-4 w-4 text-destructive" />
                            ) : (
                              <Minus className="h-4 w-4" />
                            )}
                          </Button>
                          <span className="w-6 text-center text-sm font-medium" data-testid={`text-item-quantity-${item.id}`}>
                            {item.quantity}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-full touch-manipulation"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            data-testid={`button-increase-${item.id}`}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Order Summary */}
            <div className="border-t bg-muted/30">
              <div className="p-3 sm:p-4 space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span data-testid="text-cart-subtotal">${totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery Fee</span>
                  <span data-testid="text-cart-delivery-fee">{totals.deliveryFee === 0 ? 'Free' : `$${totals.deliveryFee.toFixed(2)}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service Fee</span>
                  <span data-testid="text-cart-service-fee">${totals.serviceFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span data-testid="text-cart-tax">${totals.tax.toFixed(2)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span data-testid="text-cart-discount">-${totals.discount.toFixed(2)}</span>
                  </div>
                )}
                <Separator className="my-1.5 sm:my-2" />
                <div className="flex justify-between font-semibold text-sm sm:text-base">
                  <span>Total</span>
                  <span data-testid="text-cart-total">${totals.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Checkout Button - Touch-friendly */}
              <div className="p-3 sm:p-4 pt-0 pb-safe">
                {!hasMinimumOrder && state.restaurant?.minOrderAmount && (
                  <p className="text-[10px] sm:text-xs text-destructive mb-2 text-center">
                    Minimum order: ${state.restaurant.minOrderAmount.toFixed(2)}
                  </p>
                )}
                <Button
                  className="w-full h-12 text-sm sm:text-base touch-manipulation"
                  disabled={!hasMinimumOrder}
                  onClick={handleCheckout}
                  data-testid="button-checkout"
                >
                  {isLoggedIn ? "Proceed to Checkout" : "Sign in to Checkout"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
