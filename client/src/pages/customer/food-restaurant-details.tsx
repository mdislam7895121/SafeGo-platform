import { Link, useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Star, MapPin, UtensilsCrossed, Plus, Minus, Camera, Clock, TrendingUp, AlertCircle, CheckCircle, Info, Tag, ShoppingCart, Home } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { CustomerHomeButton, BackToRestaurantsButton } from "@/components/customer/EatsNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import GalleryModal from "@/components/customer/GalleryModal";
import { PricingBreakdownModal } from "@/components/PricingBreakdownModal";
import { useEatsCart, type RestaurantInfo } from "@/contexts/EatsCartContext";
import { useToast } from "@/hooks/use-toast";

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string | null;
  isAvailable: boolean;
}

interface MenuCategory {
  id: string;
  name: string;
  description: string;
  items: MenuItem[];
}

interface Restaurant {
  id: string;
  name: string;
  cuisineType: string;
  description: string;
  address: string;
  cityCode: string;
  averageRating: number;
  totalRatings: number;
}

interface RestaurantResponse {
  restaurant: Restaurant;
}

interface MenuResponse {
  restaurantId: string;
  restaurantName: string;
  categories: MenuCategory[];
  totalCategories: number;
  totalItems: number;
}

interface MediaItem {
  id: string;
  url: string;
  type: string;
  category: string;
  displayOrder: number;
}

interface BrandingResponse {
  branding: {
    logoUrl: string | null;
    coverPhotoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    themeMode: string;
  };
  media: MediaItem[];
}

interface OperationalStatusResponse {
  status: {
    isOpen: boolean;
    isTemporarilyClosed: boolean;
    temporaryCloseReason: string | null;
    canAcceptOrders: boolean;
    isThrottled: boolean;
  };
  todayHours: {
    isClosed: boolean;
    openTime1: string | null;
    closeTime1: string | null;
    openTime2: string | null;
    closeTime2: string | null;
  } | null;
  hours: Array<{
    dayOfWeek: string;
    isClosed: boolean;
    openTime1: string | null;
    closeTime1: string | null;
    openTime2: string | null;
    closeTime2: string | null;
  }>;
  operational: {
    deliveryEnabled: boolean;
    pickupEnabled: boolean;
    preparationTimeMinutes: number;
    minOrderAmount: number | null;
  } | null;
  surgePricing: {
    isActive: boolean;
    multiplier: number;
  };
  deliveryZone: {
    inZone: boolean;
    deliveryFee: number | null;
    estimatedTimeMinutes: number | null;
  } | null;
}

interface OperationalStatusError {
  error: string;
  reason?: string;
}

interface PricingData {
  basePriceMultiplier: number;
  surgeMultiplier: number;
  surgeReason: string | null;
  discountPercent: number;
  activePromotions: Array<{
    id: string;
    title: string;
    description: string | null;
    promoType: string;
    discountPercentage: number | null;
    discountValue: number | null;
    minOrderAmount: number | null;
    maxDiscountCap: number | null;
    timeWindowStart: string | null;
    timeWindowEnd: string | null;
  }>;
  couponEligibility: Array<{
    code: string;
    discountType: string;
    discountPercentage: number | null;
    discountValue: number | null;
    minOrderAmount: number | null;
    maxDiscountCap: number | null;
  }>;
  prepTimeMinutes: number | null;
  realTimeOpenStatus: boolean;
  deliveryZoneEligible: boolean;
  throttlingLimitReached: boolean;
  dynamicPricingBreakdown: {
    basePrice: number;
    surgeMultiplier: number;
    surgeAmount: number;
    subtotalAfterSurge: number;
    discountPercent: number;
    discountAmount: number;
    finalPrice: number;
    appliedPromotions: string[];
    appliedCoupons: string[];
  };
}

export default function FoodRestaurantDetails() {
  const { id } = useParams() as { id: string };
  const [, setLocationPath] = useLocation();
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryStartIndex, setGalleryStartIndex] = useState(0);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [showDifferentRestaurantDialog, setShowDifferentRestaurantDialog] = useState(false);
  const [pendingItem, setPendingItem] = useState<MenuItem | null>(null);
  
  const { toast } = useToast();
  const { user, token } = useAuth();
  const isLoggedIn = !!user && !!token && user.role === "customer";
  
  const { 
    addItem, 
    getItemCount, 
    getItemQuantity, 
    updateQuantity, 
    isFromDifferentRestaurant, 
    clearAndAddItem,
    state: cartState 
  } = useEatsCart();

  const { data: restaurantData, isLoading: restaurantLoading, error: restaurantError } = useQuery<RestaurantResponse>({
    queryKey: [`/api/eats/restaurants/${id}`, isLoggedIn],
    queryFn: async () => {
      if (isLoggedIn && token) {
        const authRes = await fetch(`/api/customer/food/restaurants/${id}`, {
          credentials: 'include',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (authRes.ok) {
          const data = await authRes.json();
          return data;
        } else if (authRes.status !== 401 && authRes.status !== 403) {
          const errData = await authRes.json().catch(() => ({ error: 'Failed to fetch' }));
          throw new Error(errData.error || 'Failed to fetch restaurant');
        }
      }
      const res = await fetch(`/api/eats/restaurants/${id}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Failed to fetch' }));
        throw new Error(errData.error || 'Failed to fetch restaurant');
      }
      return await res.json();
    },
    retry: 1,
  });

  const { data: menuData, isLoading: menuLoading, error: menuError } = useQuery<MenuResponse>({
    queryKey: [`/api/eats/restaurants/${id}/menu`, isLoggedIn],
    queryFn: async () => {
      if (isLoggedIn && token) {
        const authRes = await fetch(`/api/customer/food/restaurants/${id}/menu`, {
          credentials: 'include',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (authRes.ok) {
          const data = await authRes.json();
          return data;
        } else if (authRes.status !== 401 && authRes.status !== 403) {
          const errData = await authRes.json().catch(() => ({ error: 'Failed to fetch' }));
          throw new Error(errData.error || 'Failed to fetch menu');
        }
      }
      const res = await fetch(`/api/eats/restaurants/${id}/menu`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Failed to fetch' }));
        throw new Error(errData.error || 'Failed to fetch menu');
      }
      return await res.json();
    },
    retry: 1,
  });

  const { data: brandingData, isLoading: brandingLoading } = useQuery<BrandingResponse>({
    queryKey: [`/api/eats/restaurants/${id}/branding`, isLoggedIn],
    queryFn: async () => {
      if (isLoggedIn && token) {
        const authRes = await fetch(`/api/customer/food/restaurants/${id}/branding`, {
          credentials: 'include',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (authRes.ok) {
          const data = await authRes.json();
          return data;
        } else if (authRes.status !== 401 && authRes.status !== 403) {
          const errData = await authRes.json().catch(() => ({ error: 'Failed to fetch' }));
          throw new Error(errData.error || 'Failed to fetch branding');
        }
      }
      const res = await fetch(`/api/eats/restaurants/${id}/branding`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Failed to fetch' }));
        throw new Error(errData.error || 'Failed to fetch branding');
      }
      return await res.json();
    },
    retry: 1,
  });

  const { 
    data: operationalData, 
    isLoading: operationalLoading,
    error: operationalError 
  } = useQuery<OperationalStatusResponse>({
    queryKey: [`/api/customer/restaurants/${id}/status`],
    retry: false, // Don't retry on auth/verification errors
  });

  const {
    data: pricingData,
    isLoading: pricingLoading,
    error: pricingError
  } = useQuery<PricingData>({
    queryKey: [`/api/customer/restaurants/${id}/pricing`],
    retry: false, // Don't retry on auth/verification errors
  });

  const restaurant = restaurantData?.restaurant;
  const categories = menuData?.categories || [];
  const branding = brandingData?.branding;
  const media = brandingData?.media || [];
  const operational = operationalData;
  const isLoading = restaurantLoading || menuLoading;
  const error = restaurantError || menuError;

  // Get theme colors with fallback
  const headerBgColor = branding?.primaryColor || undefined;
  const headerStyle = headerBgColor ? { backgroundColor: headerBgColor } : {};

  const openGallery = (index: number = 0) => {
    setGalleryStartIndex(index);
    setIsGalleryOpen(true);
  };

  // Helper function to format time (24hr to 12hr)
  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Helper function to get status badge info
  const getStatusBadge = () => {
    if (!operational?.status) return null;

    const { isOpen, isTemporarilyClosed, canAcceptOrders, isThrottled } = operational.status;

    if (isTemporarilyClosed) {
      return {
        variant: "destructive" as const,
        text: "Temporarily Closed",
        icon: AlertCircle,
      };
    }

    if (!isOpen) {
      return {
        variant: "secondary" as const,
        text: "Closed",
        icon: Clock,
      };
    }

    if (isThrottled || !canAcceptOrders) {
      return {
        variant: "outline" as const,
        text: "Busy",
        icon: AlertCircle,
      };
    }

    return {
      variant: "default" as const,
      text: "Open",
      icon: CheckCircle,
    };
  };

  const statusBadge = getStatusBadge();

  const getRestaurantInfo = (): RestaurantInfo | null => {
    if (!restaurant) return null;
    return {
      id: restaurant.id,
      name: restaurant.name,
      cuisineType: restaurant.cuisineType,
      address: restaurant.address,
      deliveryFee: operational?.deliveryZone?.deliveryFee ?? undefined,
      minOrderAmount: operational?.operational?.minOrderAmount ?? undefined,
      estimatedDeliveryMinutes: operational?.deliveryZone?.estimatedTimeMinutes ?? undefined,
    };
  };

  const handleAddToCart = (menuItem: MenuItem) => {
    if (!menuItem.isAvailable) {
      toast({
        title: "Item unavailable",
        description: "This item is currently out of stock.",
        variant: "destructive",
      });
      return;
    }

    if (isFromDifferentRestaurant(id)) {
      setPendingItem(menuItem);
      setShowDifferentRestaurantDialog(true);
      return;
    }

    const restaurantInfo = getRestaurantInfo();
    if (!restaurantInfo) {
      toast({
        title: "Error",
        description: "Restaurant information not available.",
        variant: "destructive",
      });
      return;
    }

    const result = addItem({
      menuItemId: menuItem.id,
      name: menuItem.name,
      description: menuItem.description,
      price: menuItem.price,
      quantity: 1,
      imageUrl: menuItem.imageUrl,
    }, restaurantInfo);

    if (result.success) {
      toast({
        title: "Added to cart",
        description: `${menuItem.name} added. ${result.newCount} item${result.newCount !== 1 ? "s" : ""} in cart.`,
      });
    }
  };

  const handleConfirmNewRestaurant = () => {
    if (!pendingItem) return;
    
    const restaurantInfo = getRestaurantInfo();
    if (!restaurantInfo) return;

    clearAndAddItem({
      menuItemId: pendingItem.id,
      name: pendingItem.name,
      description: pendingItem.description,
      price: pendingItem.price,
      quantity: 1,
      imageUrl: pendingItem.imageUrl,
    }, restaurantInfo);

    toast({
      title: "Cart updated",
      description: `Started new order from ${restaurant?.name}. ${pendingItem.name} added.`,
    });

    setPendingItem(null);
    setShowDifferentRestaurantDialog(false);
  };

  const handleIncrementItem = (menuItemId: string) => {
    const currentQty = getItemQuantity(menuItemId);
    const cartItem = cartState.items.find(item => item.menuItemId === menuItemId);
    if (cartItem) {
      updateQuantity(cartItem.id, currentQty + 1);
      toast({
        title: "Quantity updated",
        description: `${getItemCount() + 1} item${getItemCount() + 1 !== 1 ? "s" : ""} in cart.`,
      });
    }
  };

  const handleDecrementItem = (menuItemId: string) => {
    const currentQty = getItemQuantity(menuItemId);
    const cartItem = cartState.items.find(item => item.menuItemId === menuItemId);
    if (cartItem && currentQty > 0) {
      updateQuantity(cartItem.id, currentQty - 1);
      const newCount = getItemCount() - 1;
      if (newCount > 0) {
        toast({
          title: "Quantity updated",
          description: `${newCount} item${newCount !== 1 ? "s" : ""} in cart.`,
        });
      } else {
        toast({
          title: "Item removed",
          description: "Your cart is now empty.",
        });
      }
    }
  };

  const cartItemCount = getItemCount();

  if (error) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <BackToRestaurantsButton 
                variant="ghost" 
                size="sm" 
                className="text-primary-foreground"
              />
              <h1 className="text-2xl font-bold">Restaurant</h1>
            </div>
            <CustomerHomeButton 
              variant="ghost" 
              size="sm" 
              className="text-primary-foreground"
            />
          </div>
        </header>

        <div className="p-6">
          <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
            <CardContent className="p-6">
              <h3 className="font-semibold text-red-900 dark:text-red-200">Error</h3>
              <p className="text-sm text-red-800 dark:text-red-300 mt-2">
                {(error as any)?.message || "Failed to load restaurant details"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Cover Photo Banner */}
      {branding?.coverPhotoUrl && (
        <div className="relative h-48 md:h-64 overflow-hidden">
          <img
            src={branding.coverPhotoUrl}
            alt="Restaurant cover"
            className="w-full h-full object-cover"
            data-testid="img-cover-photo"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent" />
          
          {/* Navigation buttons overlay */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <BackToRestaurantsButton 
              variant="ghost" 
              size="sm"
              className="text-white bg-black/30 hover:bg-black/50"
            />
            <CustomerHomeButton 
              variant="ghost" 
              size="sm"
              className="text-white bg-black/30 hover:bg-black/50"
            />
          </div>

          {/* Logo overlay */}
          {branding.logoUrl && (
            <div className="absolute bottom-0 left-6 transform translate-y-1/2">
              <div className="h-24 w-24 md:h-32 md:w-32 rounded-xl overflow-hidden border-4 border-background bg-background shadow-lg">
                <img
                  src={branding.logoUrl}
                  alt="Restaurant logo"
                  className="w-full h-full object-cover"
                  data-testid="img-logo"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Header (shown when no cover photo) */}
      {!branding?.coverPhotoUrl && (
        <header 
          className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg sticky top-0 z-10"
          style={headerStyle}
        >
          <div className="flex items-center gap-4">
            <BackToRestaurantsButton 
              variant="ghost" 
              size="sm" 
              className="text-primary-foreground"
            />
            <div className="flex-1 flex items-center gap-3">
              {branding?.logoUrl && (
                <div className="h-12 w-12 rounded-lg overflow-hidden border-2 border-primary-foreground/20">
                  <img
                    src={branding.logoUrl}
                    alt="Restaurant logo"
                    className="w-full h-full object-cover"
                    data-testid="img-logo"
                  />
                </div>
              )}
              {isLoading ? (
                <Skeleton className="h-8 w-48 bg-primary-foreground/20" />
              ) : (
                <div>
                  <h1 className="text-2xl font-bold" data-testid="text-restaurant-name">
                    {restaurant?.name}
                  </h1>
                  <p className="text-sm opacity-90">{restaurant?.cuisineType}</p>
                </div>
              )}
            </div>
            <CustomerHomeButton 
              variant="ghost" 
              size="sm" 
              className="text-primary-foreground"
            />
          </div>
        </header>
      )}

      {/* Restaurant Info Card */}
      <div className={`p-6 ${branding?.coverPhotoUrl && branding?.logoUrl ? 'mt-14' : ''}`}>
        {restaurantLoading ? (
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-3/4 mb-3" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ) : restaurant ? (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  {branding?.coverPhotoUrl && (
                    <h2 className="text-2xl font-bold mb-2" data-testid="text-restaurant-name">
                      {restaurant.name}
                    </h2>
                  )}
                  <Badge variant="secondary" className="mb-2">{restaurant.cuisineType}</Badge>
                  {restaurant.description && (
                    <p className="text-sm text-muted-foreground">{restaurant.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                  <span className="font-semibold" data-testid="text-rating">
                    {restaurant.averageRating.toFixed(1)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    ({restaurant.totalRatings})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{restaurant.address}</span>
                {restaurant.cityCode !== "Nationwide" && (
                  <Badge variant="outline" className="text-xs ml-auto">
                    {restaurant.cityCode}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Operational Status Section */}
        {operationalLoading ? (
          <Card className="mt-4">
            <CardContent className="p-6">
              <Skeleton className="h-6 w-32 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ) : operationalError ? (
          <Card className="mt-4">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <p className="text-sm" data-testid="text-status-error">
                  {(operationalError as any)?.message?.includes("location_mismatch") || (operationalError as any)?.message?.includes("not available in your area")
                    ? "This restaurant is not available in your area"
                    : (operationalError as any)?.message?.includes("verification")
                    ? "Please complete account verification to view restaurant status"
                    : "Unable to load restaurant status"}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : operational && statusBadge ? (
          <Card className="mt-4">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">Restaurant Status</h3>
                <Badge variant={statusBadge.variant} className="gap-1" data-testid="badge-restaurant-status">
                  <statusBadge.icon className="h-3 w-3" />
                  {statusBadge.text}
                </Badge>
              </div>

              {/* Temporary Closure Notice */}
              {operational.status.isTemporarilyClosed && operational.status.temporaryCloseReason && (
                <div className="mb-4 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                  <p className="text-sm text-destructive" data-testid="text-closure-reason">
                    {operational.status.temporaryCloseReason}
                  </p>
                </div>
              )}

              {/* Today's Hours */}
              {operational.todayHours && !operational.todayHours.isClosed && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 text-sm mb-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Today's Hours:</span>
                  </div>
                  <div className="ml-6 space-y-1">
                    {operational.todayHours.openTime1 && operational.todayHours.closeTime1 && (
                      <p className="text-sm" data-testid="text-hours-shift1">
                        {formatTime(operational.todayHours.openTime1)} - {formatTime(operational.todayHours.closeTime1)}
                      </p>
                    )}
                    {operational.todayHours.openTime2 && operational.todayHours.closeTime2 && (
                      <p className="text-sm" data-testid="text-hours-shift2">
                        {formatTime(operational.todayHours.openTime2)} - {formatTime(operational.todayHours.closeTime2)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {operational.todayHours?.isClosed && (
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground" data-testid="text-closed-today">
                    Closed today
                  </p>
                </div>
              )}

              <Separator className="my-4" />

              {/* Service Options & Info */}
              <div className="space-y-3">
                {/* Delivery/Pickup Status */}
                {operational.operational && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Service Options:</span>
                    <div className="flex gap-2">
                      {operational.operational.deliveryEnabled && (
                        <Badge variant="outline" className="text-xs" data-testid="badge-delivery-enabled">
                          Delivery
                        </Badge>
                      )}
                      {operational.operational.pickupEnabled && (
                        <Badge variant="outline" className="text-xs" data-testid="badge-pickup-enabled">
                          Pickup
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Preparation Time */}
                {operational.operational?.preparationTimeMinutes && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Prep Time:</span>
                    <span className="text-sm font-medium" data-testid="text-prep-time">
                      {operational.operational.preparationTimeMinutes} min
                    </span>
                  </div>
                )}

                {/* Min Order Amount */}
                {operational.operational?.minOrderAmount && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Min Order:</span>
                    <span className="text-sm font-medium" data-testid="text-min-order">
                      ${Number(operational.operational.minOrderAmount).toFixed(2)}
                    </span>
                  </div>
                )}

                {/* Surge Pricing Indicator */}
                {operational.surgePricing.isActive && (
                  <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800" data-testid="card-surge-pricing">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                      <span className="text-sm font-medium text-orange-900 dark:text-orange-200" data-testid="text-surge-heading">
                        High Demand
                      </span>
                    </div>
                    <p className="text-xs text-orange-800 dark:text-orange-300" data-testid="text-surge-multiplier">
                      Prices increased by {((operational.surgePricing.multiplier - 1) * 100).toFixed(0)}% due to high demand
                    </p>
                  </div>
                )}

                {/* Throttling Notice */}
                {operational.status.isThrottled && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800" data-testid="card-throttling">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <p className="text-sm text-amber-900 dark:text-amber-200" data-testid="text-throttling-notice">
                        Restaurant is currently at capacity. Accepting limited orders.
                      </p>
                    </div>
                  </div>
                )}

                {/* Delivery Zone Info */}
                {operational.deliveryZone && operational.operational?.deliveryEnabled && (
                  <>
                    {operational.deliveryZone.inZone ? (
                      <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800" data-testid="card-delivery-zone-available">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span className="text-sm font-medium text-green-900 dark:text-green-200" data-testid="text-delivery-available">
                            Delivers to your area
                          </span>
                        </div>
                        {operational.deliveryZone.deliveryFee !== null && (
                          <p className="text-xs text-green-800 dark:text-green-300" data-testid="text-delivery-fee">
                            Delivery fee: ${Number(operational.deliveryZone.deliveryFee).toFixed(2)}
                          </p>
                        )}
                        {operational.deliveryZone.estimatedTimeMinutes && (
                          <p className="text-xs text-green-800 dark:text-green-300" data-testid="text-delivery-eta">
                            Estimated delivery: {operational.deliveryZone.estimatedTimeMinutes} min
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 bg-muted rounded-lg border" data-testid="card-delivery-zone-unavailable">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground" data-testid="text-no-delivery">
                            Delivery not available in your area
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Pricing & Promotions Panel */}
        {pricingLoading ? (
          <Card className="mt-4">
            <CardContent className="p-6">
              <Skeleton className="h-6 w-40 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ) : pricingError ? (
          <Card className="mt-4">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Info className="h-4 w-4" />
                <p className="text-sm" data-testid="text-pricing-error">
                  {(pricingError as any)?.message?.includes("verification")
                    ? "Complete verification to view pricing details"
                    : "Pricing information unavailable"}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : pricingData ? (
          <Card className="mt-4">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg" data-testid="text-pricing-heading">
                  Pricing & Offers
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPricingModalOpen(true)}
                  className="gap-2"
                  data-testid="button-pricing-breakdown"
                >
                  <Info className="h-4 w-4" />
                  See Breakdown
                </Button>
              </div>

              <div className="space-y-3">
                {/* Active Promotions Summary */}
                {pricingData.activePromotions.length > 0 && (
                  <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800" data-testid="card-active-promotions-summary">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium text-green-900 dark:text-green-200" data-testid="text-promotions-count">
                        {pricingData.activePromotions.length} Active {pricingData.activePromotions.length === 1 ? "Promotion" : "Promotions"}
                      </span>
                    </div>
                    <p className="text-xs text-green-800 dark:text-green-300" data-testid="text-best-promotion">
                      Best offer: {pricingData.activePromotions[0].title}
                      {pricingData.activePromotions[0].discountPercentage && (
                        <span className="ml-1 font-bold">({pricingData.activePromotions[0].discountPercentage}% OFF)</span>
                      )}
                    </p>
                  </div>
                )}

                {/* Available Coupons Summary */}
                {pricingData.couponEligibility.length > 0 && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800" data-testid="card-coupons-summary">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium text-blue-900 dark:text-blue-200" data-testid="text-coupons-count">
                        {pricingData.couponEligibility.length} Coupon {pricingData.couponEligibility.length === 1 ? "Code" : "Codes"} Available
                      </span>
                    </div>
                    <p className="text-xs text-blue-800 dark:text-blue-300" data-testid="text-coupon-hint">
                      Use codes at checkout for extra savings
                    </p>
                  </div>
                )}

                {/* Estimated Price Example */}
                {pricingData.dynamicPricingBreakdown && (
                  <div className="p-3 bg-muted/50 rounded-lg border" data-testid="card-price-estimate">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Example Order ($100)</span>
                      <span className="text-lg font-bold text-primary" data-testid="text-estimated-price">
                        ${pricingData.dynamicPricingBreakdown.finalPrice.toFixed(2)}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {pricingData.surgeMultiplier > 1.0 && (
                        <div className="flex items-center gap-1" data-testid="text-surge-note">
                          <TrendingUp className="h-3 w-3 text-orange-600" />
                          <span>
                            Surge pricing active ({pricingData.surgeMultiplier}x)
                          </span>
                        </div>
                      )}
                      {pricingData.discountPercent > 0 && (
                        <div className="flex items-center gap-1" data-testid="text-discount-note">
                          <Tag className="h-3 w-3 text-green-600" />
                          <span>
                            {pricingData.discountPercent}% discount applied
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Pricing Breakdown Modal */}
      <PricingBreakdownModal
        open={isPricingModalOpen}
        onOpenChange={setIsPricingModalOpen}
        pricingData={pricingData || null}
        restaurantName={restaurant?.name || "Restaurant"}
      />

      {/* Gallery Section */}
      {!brandingLoading && media.length > 0 && (
        <div className="px-6 pb-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Gallery ({media.length} photos)
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openGallery(0)}
                  data-testid="button-view-all-photos"
                >
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {media.slice(0, 12).map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => openGallery(idx)}
                    className="aspect-square rounded-lg overflow-hidden hover-elevate active-elevate-2"
                    data-testid={`button-gallery-${idx}`}
                  >
                    <img
                      src={item.url}
                      alt={`Gallery ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
                {media.length > 12 && (
                  <button
                    onClick={() => openGallery(12)}
                    className="aspect-square rounded-lg bg-muted flex items-center justify-center hover-elevate active-elevate-2"
                    data-testid="button-view-more"
                  >
                    <div className="text-center">
                      <p className="font-semibold">+{media.length - 12}</p>
                      <p className="text-xs text-muted-foreground">more</p>
                    </div>
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Menu Section */}
      <div className="px-6 pb-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">Menu</h2>
          {menuLoading ? (
            <Skeleton className="h-4 w-32" />
          ) : (
            <p className="text-sm text-muted-foreground">
              {menuData?.totalCategories} categories • {menuData?.totalItems} items
            </p>
          )}
        </div>

        {menuLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full mb-3" />
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))
        ) : categories.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <UtensilsCrossed className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">No Menu Available</h3>
              <p className="text-sm text-muted-foreground">
                This restaurant hasn't added their menu yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          categories.map((category) => (
            <Card key={category.id} data-testid={`card-category-${category.id}`}>
              <CardHeader>
                <CardTitle className="text-lg" data-testid={`text-category-name-${category.id}`}>
                  {category.name}
                </CardTitle>
                {category.description && (
                  <p className="text-sm text-muted-foreground">{category.description}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {category.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-4 pb-4 border-b last:border-0 last:pb-0"
                    data-testid={`item-${item.id}`}
                  >
                    {item.imageUrl && (
                      <div className="flex-shrink-0">
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="h-20 w-20 rounded-lg object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-medium" data-testid={`text-item-name-${item.id}`}>
                          {item.name}
                        </h4>
                        {!item.isAvailable && (
                          <Badge variant="destructive" className="text-xs">
                            Out of Stock
                          </Badge>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-lg" data-testid={`text-item-price-${item.id}`}>
                          ${item.price.toFixed(2)}
                        </span>
                        {getItemQuantity(item.id) > 0 ? (
                          <div className="flex items-center gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => handleDecrementItem(item.id)}
                              data-testid={`button-decrement-${item.id}`}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-8 text-center font-semibold" data-testid={`text-quantity-${item.id}`}>
                              {getItemQuantity(item.id)}
                            </span>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => handleIncrementItem(item.id)}
                              data-testid={`button-increment-${item.id}`}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!item.isAvailable}
                            className="gap-2"
                            onClick={() => handleAddToCart(item)}
                            data-testid={`button-add-cart-${item.id}`}
                          >
                            <Plus className="h-4 w-4" />
                            Add
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Floating Cart Bar */}
      {cartItemCount > 0 && cartState.restaurant?.id === id && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-lg z-50">
          <Button
            className="w-full gap-3"
            size="lg"
            onClick={() => setLocationPath("/customer/food/checkout")}
            data-testid="button-view-cart"
          >
            <ShoppingCart className="h-5 w-5" />
            <span>View Cart</span>
            <Badge variant="secondary" className="ml-auto" data-testid="badge-cart-count">
              {cartItemCount} item{cartItemCount !== 1 ? "s" : ""}
            </Badge>
            <span className="font-bold">${cartState.items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)}</span>
          </Button>
        </div>
      )}

      {/* Different Restaurant Dialog */}
      <AlertDialog open={showDifferentRestaurantDialog} onOpenChange={setShowDifferentRestaurantDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start new order?</AlertDialogTitle>
            <AlertDialogDescription>
              You have items from {cartState.restaurant?.name} in your cart. Starting a new order will clear your current cart.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-keep-cart">Keep current cart</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmNewRestaurant}
              data-testid="button-start-new-order"
            >
              Start new order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Gallery Modal */}
      <GalleryModal
        media={media}
        initialIndex={galleryStartIndex}
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
      />
    </div>
  );
}
