import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  ArrowLeft, Plus, Minus, Trash2, ShoppingCart, MapPin, CreditCard, Ticket, 
  AlertCircle, Store, Clock, CheckCircle, Shield, Home, Briefcase, ChevronRight,
  Loader2, X
} from "lucide-react";
import { SiVisa, SiMastercard, SiAmericanexpress } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useEatsCart } from "@/contexts/EatsCartContext";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useCallback } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { GooglePlacesInput } from "@/components/rider/GooglePlacesInput";
import { ensureGoogleMapsLoaded } from "@/hooks/useGoogleMaps";

async function geocodeAddress(address: string): Promise<{lat: number; lng: number} | null> {
  try {
    await ensureGoogleMapsLoaded();
    
    if (!window.google?.maps) {
      console.error("[Checkout] Google Maps SDK not available for geocoding");
      return null;
    }

    return new Promise((resolve) => {
      const geocoder = new window.google.maps.Geocoder();
      
      geocoder.geocode({ address }, (results, status) => {
        if (status !== "OK" || !results || results.length === 0) {
          console.warn("[Checkout] Geocode failed:", status);
          resolve(null);
          return;
        }

        const location = results[0].geometry.location;
        resolve({
          lat: location.lat(),
          lng: location.lng(),
        });
      });
    });
  } catch (error) {
    console.error("[Checkout] Geocode error:", error);
    return null;
  }
}

interface CustomerProfile {
  id: string;
  userId: string;
  email: string;
  countryCode: string;
  isVerified: boolean;
  verificationStatus: string;
  homeAddress?: string | null;
  presentAddress?: string | null;
  workAddress?: string | null;
  fullName?: string | null;
  phoneNumber?: string | null;
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

interface PaymentMethodsResponse {
  paymentMethods: PaymentMethod[];
}

interface SavedAddress {
  id: string;
  type: "home" | "work" | "saved";
  label: string;
  address: string;
  lat?: number;
  lng?: number;
}

const cardBrandIcons: Record<string, any> = {
  visa: SiVisa,
  mastercard: SiMastercard,
  amex: SiAmericanexpress,
};

const cardBrandColors: Record<string, string> = {
  visa: "text-blue-600",
  mastercard: "text-red-500",
  amex: "text-blue-500",
};

function getCardIcon(brand: string) {
  const Icon = cardBrandIcons[brand.toLowerCase()] || CreditCard;
  const colorClass = cardBrandColors[brand.toLowerCase()] || "text-muted-foreground";
  return <Icon className={`h-5 w-5 ${colorClass}`} />;
}

export default function FoodCheckout() {
  const [, setLocationPath] = useLocation();
  const { toast } = useToast();
  const {
    state,
    updateQuantity,
    removeItem,
    setSpecialInstructions,
    setPaymentMethod,
    setDeliveryAddress,
    clearCart,
    getTotals,
    isEmpty,
    hasMinimumOrder,
  } = useEatsCart();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [showAddressSheet, setShowAddressSheet] = useState(false);
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [showKycDialog, setShowKycDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [customAddress, setCustomAddress] = useState("");

  const totals = getTotals();

  const { data: profileData, isLoading: profileLoading } = useQuery<CustomerProfile>({
    queryKey: ["/api/customer/profile"],
  });

  const { data: paymentMethodsData, isLoading: paymentMethodsLoading } = useQuery<PaymentMethodsResponse>({
    queryKey: ["/api/customer/payment-methods"],
  });

  const savedAddresses = useMemo((): SavedAddress[] => {
    if (!profileData) return [];
    const addresses: SavedAddress[] = [];
    
    if (profileData.homeAddress || profileData.presentAddress) {
      addresses.push({
        id: "home",
        type: "home",
        label: "Home",
        address: profileData.homeAddress || profileData.presentAddress || "",
      });
    }
    
    if (profileData.workAddress) {
      addresses.push({
        id: "work",
        type: "work",
        label: "Work",
        address: profileData.workAddress,
      });
    }
    
    return addresses;
  }, [profileData]);

  const paymentMethods = paymentMethodsData?.paymentMethods || [];
  const defaultPaymentMethod = paymentMethods.find(pm => pm.isDefault) || paymentMethods[0];
  const selectedPaymentMethod = state.paymentMethod 
    ? (state.paymentMethod === "cash" || state.paymentMethod === "wallet" 
        ? state.paymentMethod 
        : paymentMethods.find(pm => pm.id === state.paymentMethod))
    : defaultPaymentMethod;

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: {
      restaurantId: string;
      deliveryAddress: string;
      deliveryLat: number;
      deliveryLng: number;
      items: any[];
      serviceFare: number;
      paymentMethod: string;
    }) => {
      const response = await apiRequest("/api/food-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });
      return response;
    },
    onSuccess: (response: any) => {
      clearCart();
      queryClient.invalidateQueries({ queryKey: ["/api/customer/food-orders"] });
      const orderId = response?.order?.id || response?.orderId;
      if (orderId) {
        setLocationPath(`/customer/food/tracking/${orderId}`);
      } else {
        setLocationPath("/customer/food/orders");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Order failed",
        description: error.message || "Could not place your order. Please try again.",
        variant: "destructive",
      });
    },
  });

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

  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);

  const handleAddressSelect = async (address: SavedAddress) => {
    if (address.lat && address.lng) {
      setDeliveryAddress({
        address: address.address,
        lat: address.lat,
        lng: address.lng,
        label: address.label,
      });
      setShowAddressSheet(false);
      return;
    }

    setIsGeocodingAddress(true);
    try {
      const coords = await geocodeAddress(address.address);
      if (coords) {
        setDeliveryAddress({
          address: address.address,
          lat: coords.lat,
          lng: coords.lng,
          label: address.label,
        });
        toast({
          title: "Address verified",
          description: "Your delivery address has been set.",
        });
        setShowAddressSheet(false);
      } else {
        toast({
          title: "Could not verify address",
          description: "Please use the search box to find your address or try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Address verification failed",
        description: "Please search for your address using the search box below.",
        variant: "destructive",
      });
    } finally {
      setIsGeocodingAddress(false);
    }
  };

  const handleCustomLocationSelect = useCallback((location: {
    address: string;
    lat: number;
    lng: number;
    placeId?: string;
  }) => {
    setDeliveryAddress({
      address: location.address,
      lat: location.lat,
      lng: location.lng,
      placeId: location.placeId,
      label: "Custom",
    });
    setCustomAddress("");
    setShowAddressSheet(false);
    toast({
      title: "Address selected",
      description: "Delivery address has been set.",
    });
  }, [setDeliveryAddress, toast]);

  const handlePaymentSelect = (method: string | PaymentMethod) => {
    if (typeof method === "string") {
      setPaymentMethod(method);
    } else {
      setPaymentMethod(method.id);
    }
    setShowPaymentSheet(false);
  };

  const validateOrder = (): boolean => {
    if (!profileData?.isVerified) {
      setShowKycDialog(true);
      return false;
    }

    if (!state.deliveryAddress) {
      toast({
        title: "Delivery address required",
        description: "Please select a delivery address.",
        variant: "destructive",
      });
      setShowAddressSheet(true);
      return false;
    }

    if (!state.deliveryAddress.lat || !state.deliveryAddress.lng || 
        (state.deliveryAddress.lat === 0 && state.deliveryAddress.lng === 0)) {
      toast({
        title: "Address verification needed",
        description: "Please search for your address to verify the delivery location.",
        variant: "destructive",
      });
      setShowAddressSheet(true);
      return false;
    }

    if (!state.paymentMethod && !defaultPaymentMethod) {
      toast({
        title: "Payment method required",
        description: "Please select a payment method.",
        variant: "destructive",
      });
      setShowPaymentSheet(true);
      return false;
    }

    if (!hasMinimumOrder && state.restaurant?.minOrderAmount) {
      toast({
        title: "Minimum order not met",
        description: `Add $${(state.restaurant.minOrderAmount - totals.subtotal).toFixed(2)} more to reach the minimum order.`,
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleReviewOrder = () => {
    if (!validateOrder()) return;
    setShowConfirmDialog(true);
  };

  const handlePlaceOrder = async () => {
    if (!state.restaurant || !state.deliveryAddress) return;
    
    setIsSubmitting(true);
    setShowConfirmDialog(false);

    const paymentMethodToUse = state.paymentMethod || defaultPaymentMethod?.id || "cash";
    const paymentType = paymentMethodToUse === "cash" ? "cash" : "online";

    try {
      await createOrderMutation.mutateAsync({
        restaurantId: state.restaurant.id,
        deliveryAddress: state.deliveryAddress.address,
        deliveryLat: state.deliveryAddress.lat,
        deliveryLng: state.deliveryAddress.lng,
        items: state.items.map(item => ({
          menuItemId: item.menuItemId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          modifiers: item.modifiers || [],
          specialInstructions: item.specialInstructions || "",
        })),
        serviceFare: totals.total,
        paymentMethod: paymentType,
      });
      
      toast({
        title: "Order placed!",
        description: "Your order has been submitted. Track it in your orders.",
      });
    } catch (error) {
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSelectedPaymentDisplay = () => {
    if (!selectedPaymentMethod) return null;
    
    if (selectedPaymentMethod === "cash") {
      return (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="font-medium">Cash on Delivery</p>
            <p className="text-sm text-muted-foreground">Pay when you receive your order</p>
          </div>
        </div>
      );
    }
    
    if (selectedPaymentMethod === "wallet") {
      return (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">SafeGo Wallet</p>
            <p className="text-sm text-muted-foreground">Pay with your wallet balance</p>
          </div>
        </div>
      );
    }
    
    if (typeof selectedPaymentMethod === "object") {
      return (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            {getCardIcon(selectedPaymentMethod.brand)}
          </div>
          <div>
            <p className="font-medium capitalize">{selectedPaymentMethod.brand} •••• {selectedPaymentMethod.last4}</p>
            <p className="text-sm text-muted-foreground">
              Expires {selectedPaymentMethod.expMonth}/{selectedPaymentMethod.expYear}
            </p>
          </div>
        </div>
      );
    }
    
    return null;
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

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
            <h1 className="text-2xl font-bold">Checkout</h1>
            {state.restaurant && (
              <p className="text-sm opacity-90">{state.restaurant.name}</p>
            )}
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {!profileData?.isVerified && (
          <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
            <CardContent className="p-4 flex items-start gap-3">
              <Shield className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-yellow-900 dark:text-yellow-200">
                  Verification Required
                </p>
                <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3">
                  Please complete your KYC verification to place food orders.
                </p>
                <Link href="/customer/profile/kyc">
                  <Button size="sm" variant="outline" data-testid="button-verify-kyc">
                    Complete Verification
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {state.restaurant && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Store className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold" data-testid="text-restaurant-name">
                    {state.restaurant.name}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span data-testid="text-prep-time">25-35 min</span>
                  </div>
                </div>
                <Link href={`/customer/food/${state.restaurant.id}`}>
                  <Button variant="ghost" size="sm" data-testid="button-add-more">
                    Add more
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

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
                  {item.modifiers && item.modifiers.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.modifiers.map(m => m.name).join(", ")}
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" />
              Delivery Address
            </CardTitle>
          </CardHeader>
          <CardContent>
            <button
              onClick={() => setShowAddressSheet(true)}
              className="w-full flex items-center justify-between p-3 rounded-lg border hover-elevate active-elevate-2"
              data-testid="button-select-address"
            >
              {state.deliveryAddress ? (
                <div className="flex items-center gap-3 text-left">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {state.deliveryAddress.label === "Home" ? (
                      <Home className="h-5 w-5 text-primary" />
                    ) : state.deliveryAddress.label === "Work" ? (
                      <Briefcase className="h-5 w-5 text-primary" />
                    ) : (
                      <MapPin className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{state.deliveryAddress.label || "Delivery Address"}</p>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {state.deliveryAddress.address}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <span className="text-muted-foreground">Select delivery address</span>
                </div>
              )}
              <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent>
            <button
              onClick={() => setShowPaymentSheet(true)}
              className="w-full flex items-center justify-between p-3 rounded-lg border hover-elevate active-elevate-2"
              data-testid="button-select-payment"
            >
              {getSelectedPaymentDisplay() || (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <span className="text-muted-foreground">Select payment method</span>
                </div>
              )}
              <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            </button>
          </CardContent>
        </Card>

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
              <span data-testid="text-delivery-fee">
                {totals.deliveryFee === 0 ? (
                  <span className="text-green-600">Free</span>
                ) : (
                  `$${totals.deliveryFee.toFixed(2)}`
                )}
              </span>
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

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-lg z-50">
        <Button
          className="w-full"
          size="lg"
          onClick={handleReviewOrder}
          disabled={isSubmitting || (!hasMinimumOrder && !!state.restaurant?.minOrderAmount)}
          data-testid="button-review-order"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Placing Order...
            </>
          ) : (
            `Review Order - $${totals.total.toFixed(2)}`
          )}
        </Button>
      </div>

      <Sheet open={showAddressSheet} onOpenChange={setShowAddressSheet}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
          <SheetHeader className="mb-6">
            <SheetTitle>Select Delivery Address</SheetTitle>
            <SheetDescription>
              Choose from your saved addresses or add a new one
            </SheetDescription>
          </SheetHeader>
          
          <div className="space-y-4 overflow-y-auto max-h-[60vh]">
            {savedAddresses.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Saved Addresses
                </h4>
                {savedAddresses.map((address) => (
                  <button
                    key={address.id}
                    onClick={() => handleAddressSelect(address)}
                    disabled={isGeocodingAddress}
                    className="w-full flex items-center gap-3 p-4 rounded-lg border hover-elevate active-elevate-2 text-left disabled:opacity-50 disabled:pointer-events-none"
                    data-testid={`address-option-${address.id}`}
                  >
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      address.type === "home" 
                        ? "bg-blue-100 dark:bg-blue-950" 
                        : "bg-green-100 dark:bg-green-950"
                    }`}>
                      {address.type === "home" ? (
                        <Home className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Briefcase className="h-5 w-5 text-green-600 dark:text-green-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{address.label}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{address.address}</p>
                    </div>
                    {isGeocodingAddress ? (
                      <Loader2 className="h-5 w-5 text-muted-foreground flex-shrink-0 animate-spin" />
                    ) : state.deliveryAddress?.address === address.address ? (
                      <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                    ) : null}
                  </button>
                ))}
              </div>
            )}
            
            <div className="space-y-3 pt-4 border-t">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Or Search New Address
              </h4>
              <GooglePlacesInput
                value={customAddress}
                onChange={setCustomAddress}
                onLocationSelect={handleCustomLocationSelect}
                placeholder="Search for an address..."
                variant="dropoff"
                showCurrentLocation={false}
                className="w-full"
              />
            </div>
            
            {savedAddresses.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No saved addresses yet</p>
                <p className="text-xs">Add addresses in your profile for quick checkout</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={showPaymentSheet} onOpenChange={setShowPaymentSheet}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
          <SheetHeader className="mb-6">
            <SheetTitle>Select Payment Method</SheetTitle>
            <SheetDescription>
              Choose how you'd like to pay for your order
            </SheetDescription>
          </SheetHeader>
          
          <div className="space-y-4 overflow-y-auto max-h-[60vh]">
            <RadioGroup 
              value={state.paymentMethod || (defaultPaymentMethod?.id || "cash")}
              onValueChange={(value) => handlePaymentSelect(value)}
              className="space-y-3"
            >
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Cash
                </h4>
                <Label
                  htmlFor="payment-cash"
                  className="flex items-center gap-3 p-4 rounded-lg border cursor-pointer hover-elevate"
                >
                  <RadioGroupItem value="cash" id="payment-cash" data-testid="radio-payment-cash" />
                  <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Cash on Delivery</p>
                    <p className="text-sm text-muted-foreground">Pay when you receive your order</p>
                  </div>
                </Label>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Wallet
                </h4>
                <Label
                  htmlFor="payment-wallet"
                  className="flex items-center gap-3 p-4 rounded-lg border cursor-pointer hover-elevate"
                >
                  <RadioGroupItem value="wallet" id="payment-wallet" data-testid="radio-payment-wallet" />
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">SafeGo Wallet</p>
                    <p className="text-sm text-muted-foreground">Pay with your wallet balance</p>
                  </div>
                </Label>
              </div>

              {paymentMethods.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                    Saved Cards
                  </h4>
                  {paymentMethods.map((method) => (
                    <Label
                      key={method.id}
                      htmlFor={`payment-${method.id}`}
                      className="flex items-center gap-3 p-4 rounded-lg border cursor-pointer hover-elevate"
                    >
                      <RadioGroupItem 
                        value={method.id} 
                        id={`payment-${method.id}`} 
                        data-testid={`radio-payment-${method.id}`}
                      />
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        {getCardIcon(method.brand)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium capitalize">{method.brand} •••• {method.last4}</p>
                          {method.isDefault && (
                            <Badge variant="secondary" className="text-xs">Default</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Expires {method.expMonth}/{method.expYear}
                        </p>
                      </div>
                    </Label>
                  ))}
                </div>
              )}
            </RadioGroup>
            
            <div className="pt-4 border-t">
              <Link href="/customer/payment-methods">
                <Button variant="outline" className="w-full" data-testid="button-manage-payment-methods">
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Payment Method
                </Button>
              </Link>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={showKycDialog} onOpenChange={setShowKycDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-yellow-600" />
              Verification Required
            </DialogTitle>
            <DialogDescription>
              You need to complete your identity verification before placing food orders. This helps us ensure safe and secure transactions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowKycDialog(false)} data-testid="button-cancel-kyc">
              Cancel
            </Button>
            <Link href="/customer/profile/kyc">
              <Button data-testid="button-go-to-kyc">
                Complete Verification
              </Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Your Order</DialogTitle>
            <DialogDescription>
              Please review your order details before placing.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Store className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{state.restaurant?.name}</p>
                <p className="text-sm text-muted-foreground">{totals.itemCount} item(s)</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Delivery to</p>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {state.deliveryAddress?.address}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Payment</p>
                <p className="text-sm text-muted-foreground">
                  {selectedPaymentMethod === "cash" && "Cash on Delivery"}
                  {selectedPaymentMethod === "wallet" && "SafeGo Wallet"}
                  {typeof selectedPaymentMethod === "object" && 
                    `${selectedPaymentMethod.brand} •••• ${selectedPaymentMethod.last4}`}
                </p>
              </div>
            </div>
            
            <Separator />
            
            <div className="flex justify-between font-semibold text-lg">
              <span>Total</span>
              <span>${totals.total.toFixed(2)}</span>
            </div>
          </div>
          
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmDialog(false)}
              disabled={isSubmitting}
              data-testid="button-cancel-order"
            >
              Cancel
            </Button>
            <Button 
              onClick={handlePlaceOrder}
              disabled={isSubmitting}
              data-testid="button-confirm-order"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Placing...
                </>
              ) : (
                "Place Order"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
