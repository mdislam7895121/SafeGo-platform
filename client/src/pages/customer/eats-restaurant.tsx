import { useState, useRef, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  ArrowLeft, Star, MapPin, Clock, Heart, Plus, Minus, ShoppingCart,
  ChevronRight, ChevronDown, Info, Check, AlertCircle, Flame, Leaf, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useEatsCart, type RestaurantInfo } from "@/contexts/EatsCartContext";
import { useToast } from "@/hooks/use-toast";
import CartDrawer from "@/components/customer/CartDrawer";
import ItemDetailModal, { 
  type MenuItemDetail, 
  type MenuItemOptionGroup 
} from "@/components/customer/ItemDetailModal";

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string | null;
  isAvailable: boolean;
  isVegetarian?: boolean;
  isSpicy?: boolean;
  calories?: number;
  hasVariants?: boolean;
  hasAddOns?: boolean;
  optionGroupsCount?: number;
}

interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  items: MenuItem[];
}

interface Restaurant {
  id: string;
  name: string;
  cuisineType: string;
  description?: string;
  address?: string;
  cityCode?: string;
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

interface BrandingResponse {
  branding: {
    logoUrl: string | null;
    coverPhotoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    themeMode: string;
  };
  media: Array<{
    id: string;
    url: string;
    type: string;
    category: string;
  }>;
}

interface RestaurantHour {
  dayOfWeek: number;
  isClosed: boolean;
  openTime1: string | null;
  closeTime1: string | null;
  openTime2: string | null;
  closeTime2: string | null;
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
  hours: RestaurantHour[];
  operational: {
    deliveryEnabled: boolean;
    pickupEnabled: boolean;
    preparationTimeMinutes: number;
    minOrderAmount: number | null;
  } | null;
}

export default function EatsRestaurant() {
  const { id } = useParams() as { id: string };
  const [, setLocationPath] = useLocation();
  const { toast } = useToast();
  const { user, token } = useAuth();
  const isLoggedIn = !!user && !!token && user.role === "customer";

  const {
    addItem,
    getItemQuantity,
    updateQuantity,
    getItemCount,
    getTotals,
    isFromDifferentRestaurant,
    clearAndAddItem,
    state: cartState,
  } = useEatsCart();

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [showDifferentRestaurantDialog, setShowDifferentRestaurantDialog] = useState(false);
  const [pendingItem, setPendingItem] = useState<MenuItem | null>(null);
  const [moreInfoOpen, setMoreInfoOpen] = useState(false);
  const [isItemDetailOpen, setIsItemDetailOpen] = useState(false);
  const [itemDetailData, setItemDetailData] = useState<MenuItemDetail | null>(null);
  const [isLoadingItemDetail, setIsLoadingItemDetail] = useState(false);

  const categoryRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const categoryNavRef = useRef<HTMLDivElement>(null);

  // Fetch restaurant data
  const { data: restaurantData, isLoading: restaurantLoading } = useQuery<RestaurantResponse>({
    queryKey: [`/api/eats/restaurants/${id}`],
    queryFn: async () => {
      if (isLoggedIn && token) {
        try {
          const authRes = await fetch(`/api/customer/food/restaurants/${id}`, {
            credentials: 'include',
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (authRes.ok) return await authRes.json();
        } catch (e) {}
      }
      const res = await fetch(`/api/eats/restaurants/${id}`);
      if (!res.ok) throw new Error('Failed to fetch restaurant');
      return await res.json();
    },
  });

  // Fetch menu data
  const { data: menuData, isLoading: menuLoading } = useQuery<MenuResponse>({
    queryKey: [`/api/eats/restaurants/${id}/menu`],
    queryFn: async () => {
      if (isLoggedIn && token) {
        try {
          const authRes = await fetch(`/api/customer/food/restaurants/${id}/menu`, {
            credentials: 'include',
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (authRes.ok) return await authRes.json();
        } catch (e) {}
      }
      const res = await fetch(`/api/eats/restaurants/${id}/menu`);
      if (!res.ok) throw new Error('Failed to fetch menu');
      return await res.json();
    },
    enabled: !!id,
  });

  // Fetch branding data
  const { data: brandingData } = useQuery<BrandingResponse>({
    queryKey: [`/api/eats/restaurants/${id}/branding`],
    queryFn: async () => {
      if (isLoggedIn && token) {
        try {
          const authRes = await fetch(`/api/customer/food/restaurants/${id}/branding`, {
            credentials: 'include',
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (authRes.ok) return await authRes.json();
        } catch (e) {}
      }
      const res = await fetch(`/api/eats/restaurants/${id}/branding`);
      if (!res.ok) return null;
      return await res.json();
    },
    enabled: !!id,
  });

  // Fetch operational status
  const { data: statusData } = useQuery<OperationalStatusResponse>({
    queryKey: [`/api/customer/food/restaurants/${id}/status`],
    queryFn: async () => {
      const res = await fetch(`/api/customer/food/restaurants/${id}/status`);
      if (!res.ok) return null;
      return await res.json();
    },
    enabled: !!id && isLoggedIn,
  });

  const restaurant = restaurantData?.restaurant;
  const menu = menuData?.categories || [];
  const branding = brandingData?.branding;
  const status = statusData?.status;
  const operational = statusData?.operational;

  const cartItemCount = getItemCount();
  const cartTotals = getTotals();

  // Set initial category
  useEffect(() => {
    if (menu.length > 0 && !activeCategoryId) {
      setActiveCategoryId(menu[0].id);
    }
  }, [menu, activeCategoryId]);

  const scrollToCategory = (categoryId: string) => {
    setActiveCategoryId(categoryId);
    const element = categoryRefs.current.get(categoryId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleAddToCart = (item: MenuItem) => {
    if (isFromDifferentRestaurant(id)) {
      setPendingItem(item);
      setShowDifferentRestaurantDialog(true);
      return;
    }
    setSelectedItem(item);
    setItemQuantity(1);
    setSpecialInstructions("");
  };

  const confirmAddToCart = () => {
    if (!selectedItem || !restaurant) return;

    const restaurantInfo: RestaurantInfo = {
      id: id,
      name: restaurant.name,
      cuisineType: restaurant.cuisineType,
      logoUrl: branding?.logoUrl || null,
      deliveryFee: 2.99,
      minOrderAmount: operational?.minOrderAmount ?? 0,
      estimatedDeliveryMinutes: operational?.preparationTimeMinutes ?? 30,
    };

    const result = addItem(
      {
        menuItemId: selectedItem.id,
        name: selectedItem.name,
        description: selectedItem.description,
        price: selectedItem.price,
        quantity: itemQuantity,
        imageUrl: selectedItem.imageUrl,
        specialInstructions: specialInstructions || undefined,
      },
      restaurantInfo
    );

    if (result.success) {
      toast({
        title: "Added to cart",
        description: `${itemQuantity}x ${selectedItem.name}`,
        duration: 2000,
      });
      setSelectedItem(null);
    }
  };

  const handleClearCartAndAdd = () => {
    if (!pendingItem || !restaurant) return;

    const restaurantInfo: RestaurantInfo = {
      id: id,
      name: restaurant.name,
      cuisineType: restaurant.cuisineType,
      logoUrl: branding?.logoUrl || null,
      deliveryFee: 2.99,
      minOrderAmount: operational?.minOrderAmount ?? 0,
      estimatedDeliveryMinutes: operational?.preparationTimeMinutes ?? 30,
    };

    clearAndAddItem(
      {
        menuItemId: pendingItem.id,
        name: pendingItem.name,
        description: pendingItem.description,
        price: pendingItem.price,
        quantity: 1,
        imageUrl: pendingItem.imageUrl,
      },
      restaurantInfo
    );

    toast({
      title: "Cart updated",
      description: `Starting new order from ${restaurant.name}`,
      duration: 2000,
    });

    setShowDifferentRestaurantDialog(false);
    setPendingItem(null);
  };

  // Step 44: Open item detail modal with variants/add-ons
  const handleOpenItemDetail = async (item: MenuItem) => {
    if (!item.isAvailable) return;
    
    // If item has no variants/add-ons, use quick add
    if (!item.hasVariants && !item.hasAddOns && (!item.optionGroupsCount || item.optionGroupsCount === 0)) {
      handleAddToCart(item);
      return;
    }

    // Fetch full item details with variants/add-ons
    setIsLoadingItemDetail(true);
    try {
      const res = await fetch(`/api/eats/restaurants/${id}/items/${item.id}`);
      if (!res.ok) throw new Error('Failed to fetch item details');
      const data = await res.json();
      setItemDetailData(data);
      setIsItemDetailOpen(true);
    } catch (error) {
      console.error('Error fetching item details:', error);
      // Fallback to quick add
      handleAddToCart(item);
    } finally {
      setIsLoadingItemDetail(false);
    }
  };

  // Step 44: Handle add to cart from item detail modal
  const handleAddFromItemDetail = (
    item: MenuItemDetail,
    quantity: number,
    selectedOptions: Array<{
      groupId: string;
      groupName: string;
      optionId: string;
      optionLabel: string;
      priceDelta: number;
      quantity: number;
    }>,
    instructions: string,
    totalPrice: number
  ) => {
    if (!restaurant) return;

    // Check for different restaurant
    if (isFromDifferentRestaurant(id)) {
      // For now, show the dialog - later can enhance to pass options
      setPendingItem({
        id: item.id,
        name: item.name,
        description: item.shortDescription || '',
        price: item.basePrice,
        imageUrl: item.imageUrl || null,
        isAvailable: true,
      });
      setShowDifferentRestaurantDialog(true);
      return;
    }

    const restaurantInfo: RestaurantInfo = {
      id: id,
      name: restaurant.name,
      cuisineType: restaurant.cuisineType,
      logoUrl: branding?.logoUrl || null,
      deliveryFee: 2.99,
      minOrderAmount: operational?.minOrderAmount ?? 0,
      estimatedDeliveryMinutes: operational?.preparationTimeMinutes ?? 30,
    };

    // Convert selected options to modifiers for cart
    const modifiers = selectedOptions.map((opt) => ({
      id: opt.optionId,
      name: `${opt.groupName}: ${opt.optionLabel}${opt.quantity > 1 ? ` x${opt.quantity}` : ''}`,
      price: opt.priceDelta * opt.quantity,
    }));

    const result = addItem(
      {
        menuItemId: item.id,
        name: item.name,
        description: item.shortDescription || item.longDescription || '',
        price: totalPrice / quantity, // Unit price including options
        quantity: quantity,
        imageUrl: item.imageUrl,
        specialInstructions: instructions || undefined,
        modifiers: modifiers.length > 0 ? modifiers : undefined,
      },
      restaurantInfo
    );

    if (result.success) {
      toast({
        title: "Added to cart",
        description: `${quantity}x ${item.name}${modifiers.length > 0 ? ' with options' : ''}`,
        duration: 2000,
      });
    }
  };

  // Step 44: Handle upsell item click - open its detail
  const handleUpsellItemClick = async (itemId: string) => {
    setIsItemDetailOpen(false);
    setIsLoadingItemDetail(true);
    try {
      const res = await fetch(`/api/eats/restaurants/${id}/items/${itemId}`);
      if (!res.ok) throw new Error('Failed to fetch item details');
      const data = await res.json();
      setItemDetailData(data);
      setIsItemDetailOpen(true);
    } catch (error) {
      console.error('Error fetching upsell item:', error);
      toast({
        title: "Error",
        description: "Could not load item details",
        variant: "destructive",
      });
    } finally {
      setIsLoadingItemDetail(false);
    }
  };

  const isLoading = restaurantLoading || menuLoading;
  const canOrder = status?.canAcceptOrders !== false;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="h-48 w-full" />
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-10 w-full" />
          <div className="grid gap-4 mt-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-6">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">Restaurant not found</h2>
          <p className="text-muted-foreground mb-4">This restaurant may no longer be available</p>
          <Button onClick={() => setLocationPath("/customer/food")}>
            Browse Restaurants
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16 sm:pb-20">
      {/* Cover Photo Header - Compact mobile height */}
      <div className="relative h-32 sm:h-44 lg:h-56 bg-muted">
        {branding?.coverPhotoUrl ? (
          <img 
            src={branding.coverPhotoUrl} 
            alt={restaurant.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        
        {/* Back Button - Touch-friendly */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 left-2 sm:top-3 sm:left-3 h-8 w-8 sm:h-9 sm:w-9 bg-background/80 backdrop-blur-sm hover:bg-background touch-manipulation"
          onClick={() => setLocationPath("/customer/food")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>

        {/* Cart Button - Touch-friendly */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 sm:top-3 sm:right-3 h-8 w-8 sm:h-9 sm:w-9 bg-background/80 backdrop-blur-sm hover:bg-background touch-manipulation"
          onClick={() => setIsCartOpen(true)}
          data-testid="button-cart-header"
        >
          <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
          {cartItemCount > 0 && (
            <Badge className="absolute -top-0.5 -right-0.5 h-4 w-4 sm:h-5 sm:w-5 p-0 flex items-center justify-center text-[10px] sm:text-xs">
              {cartItemCount}
            </Badge>
          )}
        </Button>

        {/* Logo - Compact mobile size */}
        <div className="absolute -bottom-6 sm:-bottom-8 left-2 sm:left-3">
          <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-lg bg-background shadow-lg overflow-hidden border-2 sm:border-4 border-background">
            {branding?.logoUrl ? (
              <img 
                src={branding.logoUrl} 
                alt={restaurant.name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="h-full w-full bg-primary/10 flex items-center justify-center text-lg sm:text-xl font-bold text-primary">
                {restaurant.name.charAt(0)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Restaurant Info - Compact mobile layout */}
      <div className="pt-8 sm:pt-10 px-2 sm:px-3 pb-2 sm:pb-3">
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-xl font-bold truncate leading-tight" data-testid="text-restaurant-name">{restaurant.name}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate" data-testid="text-restaurant-cuisine">{restaurant.cuisineType}</p>
          </div>
          <div className="flex items-center gap-0.5 bg-muted px-1.5 py-0.5 rounded flex-shrink-0" data-testid="rating-badge">
            <Star className="h-3 w-3 sm:h-4 sm:w-4 fill-yellow-400 text-yellow-400" />
            <span className="font-semibold text-xs sm:text-sm" data-testid="text-restaurant-rating">{restaurant.averageRating.toFixed(1)}</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground">({restaurant.totalRatings})</span>
          </div>
        </div>

        {/* Info Row - Compact */}
        <div className="flex items-center gap-2 sm:gap-3 mt-1.5 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
          {operational && (
            <div className="flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              <span>{operational.preparationTimeMinutes} min</span>
            </div>
          )}
          {restaurant.cityCode && (
            <div className="flex items-center gap-0.5">
              <MapPin className="h-3 w-3" />
              <span>{restaurant.cityCode}</span>
            </div>
          )}
          {!canOrder && (
            <Badge variant="destructive" className="text-[10px] py-0">Unavailable</Badge>
          )}
        </div>

        {/* Collapsible More Info Section */}
        <Collapsible open={moreInfoOpen} onOpenChange={setMoreInfoOpen} className="mt-2">
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-between h-9 px-2 text-xs text-muted-foreground hover:text-foreground touch-manipulation"
              data-testid="button-more-info"
            >
              <span className="flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" />
                More Info
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${moreInfoOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 pb-1 px-1">
            <div className="space-y-3 text-xs">
              {/* Description */}
              {restaurant.description && (
                <div>
                  <h4 className="font-medium text-foreground mb-1">About</h4>
                  <p className="text-muted-foreground leading-relaxed">{restaurant.description}</p>
                </div>
              )}
              
              {/* Opening Hours - Dynamic from API */}
              <div>
                <h4 className="font-medium text-foreground mb-1.5">Opening Hours</h4>
                {statusData?.hours && statusData.hours.length > 0 ? (
                  <div className="space-y-1 text-muted-foreground">
                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((dayName, dayIndex) => {
                      const dayHours = statusData.hours.find(h => h.dayOfWeek === dayIndex);
                      const formatTime = (time: string | null) => {
                        if (!time) return '';
                        const [hours, minutes] = time.split(':').map(Number);
                        const period = hours >= 12 ? 'PM' : 'AM';
                        const displayHours = hours % 12 || 12;
                        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
                      };
                      
                      let hoursText = 'Closed';
                      if (dayHours && !dayHours.isClosed) {
                        if (dayHours.openTime1 && dayHours.closeTime1) {
                          hoursText = `${formatTime(dayHours.openTime1)} - ${formatTime(dayHours.closeTime1)}`;
                          if (dayHours.openTime2 && dayHours.closeTime2) {
                            hoursText += `, ${formatTime(dayHours.openTime2)} - ${formatTime(dayHours.closeTime2)}`;
                          }
                        }
                      }
                      
                      const isToday = new Date().getDay() === dayIndex;
                      
                      return (
                        <div 
                          key={dayIndex} 
                          className={`flex justify-between py-0.5 ${isToday ? 'text-foreground font-medium' : ''}`}
                        >
                          <span>{dayName}{isToday && ' (Today)'}</span>
                          <span className={dayHours?.isClosed ? 'text-muted-foreground/60' : ''}>
                            {hoursText}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Hours not available</p>
                )}
              </div>

              {/* Address */}
              {restaurant.address && (
                <div>
                  <h4 className="font-medium text-foreground mb-1">Location</h4>
                  <p className="text-muted-foreground flex items-start gap-1.5">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    {restaurant.address}
                  </p>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <Separator />

      {/* Desktop Layout: Sidebar + Content */}
      <div className="flex">
        {/* Desktop Sidebar - Category Navigation (hidden on mobile/tablet) */}
        <aside className="hidden lg:block w-48 xl:w-56 flex-shrink-0 border-r bg-background">
          <div className="sticky top-0 p-3 space-y-0.5 max-h-screen overflow-y-auto">
            <h3 className="text-xs font-semibold text-muted-foreground mb-2 px-2">Categories</h3>
            {menu.map((category) => (
              <button
                key={category.id}
                className={`w-full flex items-center justify-between px-2 py-2 min-h-[40px] rounded-lg text-left text-sm transition-colors touch-manipulation ${
                  activeCategoryId === category.id 
                    ? 'bg-primary text-primary-foreground' 
                    : 'hover:bg-muted text-foreground'
                }`}
                onClick={() => scrollToCategory(category.id)}
                data-testid={`sidebar-category-${category.id}`}
              >
                <span className="truncate text-xs">{category.name}</span>
                <Badge variant={activeCategoryId === category.id ? "secondary" : "outline"} className="ml-1 flex-shrink-0 text-[10px]">
                  {category.items.length}
                </Badge>
              </button>
            ))}
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          {/* Mobile Category Navigation - Enhanced sticky bar with 44px touch targets */}
          <div 
            ref={categoryNavRef}
            className="lg:hidden sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b shadow-sm"
          >
            <ScrollArea className="w-full">
              <div className="flex gap-2 p-2 px-3">
                {menu.map((category) => (
                  <Button
                    key={category.id}
                    variant={activeCategoryId === category.id ? "default" : "outline"}
                    className={`flex-shrink-0 rounded-full h-11 px-4 text-sm touch-manipulation whitespace-nowrap ${
                      activeCategoryId === category.id 
                        ? 'shadow-md' 
                        : 'bg-background hover:bg-muted'
                    }`}
                    onClick={() => scrollToCategory(category.id)}
                    data-testid={`button-category-${category.id}`}
                  >
                    {category.name}
                    <Badge 
                      variant={activeCategoryId === category.id ? "secondary" : "outline"} 
                      className="ml-1.5 h-5 text-xs px-1.5"
                    >
                      {category.items.length}
                    </Badge>
                  </Button>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>

          {/* Menu Content - Compact mobile padding */}
          <div className="p-2 sm:p-3 lg:p-5 space-y-4 sm:space-y-6">
            {menu.length === 0 ? (
              <div className="text-center py-6 sm:py-10">
                <Info className="h-8 w-8 sm:h-10 sm:w-10 mx-auto text-muted-foreground/50 mb-3" />
                <h3 className="font-semibold mb-1.5 text-xs sm:text-sm">Menu coming soon</h3>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  Setting up menu
                </p>
              </div>
            ) : (
              menu.map((category) => (
                <div
                  key={category.id}
                  ref={(el) => el && categoryRefs.current.set(category.id, el)}
                  className="scroll-mt-12 lg:scroll-mt-4"
                >
                  <h2 className="text-sm sm:text-base font-bold mb-0.5">{category.name}</h2>
                  {category.description && (
                    <p className="text-[10px] sm:text-xs text-muted-foreground mb-2">{category.description}</p>
                  )}
                  
                  <div className="space-y-1.5 sm:space-y-2">
                    {category.items.map((item) => {
                      const quantityInCart = getItemQuantity(item.id);
                      
                      return (
                        <Card 
                          key={item.id} 
                          className={`overflow-hidden touch-manipulation ${!item.isAvailable ? 'opacity-50' : 'hover-elevate cursor-pointer'}`}
                          onClick={() => item.isAvailable && handleOpenItemDetail(item)}
                          data-testid={`card-menu-item-${item.id}`}
                        >
                          <CardContent className="p-0">
                            <div className="flex gap-2 sm:gap-3 p-2 sm:p-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start gap-1 flex-wrap">
                                  <h3 className="font-medium text-xs sm:text-sm leading-tight">{item.name}</h3>
                                  {item.isVegetarian && (
                                    <Leaf className="h-3 w-3 text-green-500 flex-shrink-0" />
                                  )}
                                  {item.isSpicy && (
                                    <Flame className="h-3 w-3 text-red-500 flex-shrink-0" />
                                  )}
                                </div>
                                {item.description && (
                                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                    {item.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="font-semibold text-xs sm:text-sm">${item.price.toFixed(2)}</span>
                                  {item.calories && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {item.calories} cal
                                    </span>
                                  )}
                                </div>
                                {!item.isAvailable && (
                                  <Badge variant="secondary" className="mt-1 text-[10px] py-0">Unavailable</Badge>
                                )}
                              </div>
                              
                              <div className="relative flex-shrink-0">
                                <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-lg bg-muted overflow-hidden">
                                  {item.imageUrl ? (
                                    <img 
                                      src={item.imageUrl} 
                                      alt={item.name}
                                      className="h-full w-full object-cover"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center text-muted-foreground/50 text-[9px]">
                                      No image
                                    </div>
                                  )}
                                </div>
                                {quantityInCart > 0 && (
                                  <Badge className="absolute -top-1.5 -right-1.5 h-4 w-4 sm:h-5 sm:w-5 p-0 flex items-center justify-center text-[10px]">
                                    {quantityInCart}
                                  </Badge>
                                )}
                                {item.isAvailable && quantityInCart === 0 && (
                                  <Button
                                    size="icon"
                                    className="absolute -bottom-1 -right-1 h-8 w-8 sm:h-9 sm:w-9 rounded-full shadow-lg touch-manipulation"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenItemDetail(item);
                                    }}
                                    data-testid={`button-quick-add-${item.id}`}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Floating Cart Button - Compact mobile */}
      {cartItemCount > 0 && (
        <div className="fixed bottom-3 left-2 right-2 sm:left-3 sm:right-3 z-50 pb-safe">
          <Button
            className="w-full h-11 sm:h-12 shadow-lg gap-1.5 text-xs sm:text-sm touch-manipulation"
            onClick={() => setIsCartOpen(true)}
            data-testid="button-floating-cart"
          >
            <ShoppingCart className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">Cart ({cartItemCount})</span>
            <span className="ml-auto font-bold flex-shrink-0">${cartTotals.total.toFixed(2)}</span>
          </Button>
        </div>
      )}

      {/* Add to Cart Dialog - Compact mobile */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-[calc(100vw-16px)] sm:max-w-md rounded-lg p-4 sm:p-6">
          {selectedItem && (
            <>
              {selectedItem.imageUrl && (
                <div className="h-28 sm:h-36 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-3 bg-muted overflow-hidden">
                  <img 
                    src={selectedItem.imageUrl} 
                    alt={selectedItem.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">{selectedItem.name}</DialogTitle>
                {selectedItem.description && (
                  <DialogDescription className="text-xs sm:text-sm">{selectedItem.description}</DialogDescription>
                )}
              </DialogHeader>
              
              <div className="space-y-3 py-2 sm:py-3">
                <div>
                  <label className="text-xs sm:text-sm font-medium">Special Instructions</label>
                  <Textarea
                    placeholder="Allergies or requests?"
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    className="mt-1 min-h-[60px] sm:min-h-[70px] text-sm"
                    data-testid="input-special-instructions"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-medium text-xs sm:text-sm">Quantity</span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 sm:h-10 sm:w-10 touch-manipulation"
                      onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                      disabled={itemQuantity <= 1}
                      data-testid="button-decrease-quantity"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-6 text-center font-semibold text-sm sm:text-base" data-testid="text-item-quantity">{itemQuantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 sm:h-10 sm:w-10 touch-manipulation"
                      onClick={() => setItemQuantity(itemQuantity + 1)}
                      data-testid="button-increase-quantity"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button 
                  className="w-full h-10 sm:h-11 text-sm touch-manipulation"
                  onClick={confirmAddToCart}
                  data-testid="button-confirm-add-to-cart"
                >
                  Add to Cart - ${(selectedItem.price * itemQuantity).toFixed(2)}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Different Restaurant Dialog - Responsive */}
      <AlertDialog open={showDifferentRestaurantDialog} onOpenChange={setShowDifferentRestaurantDialog}>
        <AlertDialogContent className="max-w-[calc(100vw-24px)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">Start a new order?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Your cart contains items from {cartState.restaurant?.name}. 
              Would you like to clear your cart and start a new order from {restaurant.name}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="h-10 touch-manipulation" data-testid="button-keep-cart">Keep current cart</AlertDialogCancel>
            <AlertDialogAction className="h-10 touch-manipulation" onClick={handleClearCartAndAdd} data-testid="button-start-new-order">
              Start new order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cart Drawer */}
      <CartDrawer open={isCartOpen} onOpenChange={setIsCartOpen} />

      {/* Step 44: Item Detail Modal with variants/add-ons */}
      <ItemDetailModal
        item={itemDetailData}
        isOpen={isItemDetailOpen}
        onClose={() => {
          setIsItemDetailOpen(false);
          setItemDetailData(null);
        }}
        onAddToCart={handleAddFromItemDetail}
        onUpsellItemClick={handleUpsellItemClick}
      />
    </div>
  );
}
