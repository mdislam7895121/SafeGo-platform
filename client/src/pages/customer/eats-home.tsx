import { useState, useRef } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Search, MapPin, Star, Clock, Heart, Filter, X,
  Flame, Sparkles, Truck, Pizza, Coffee, Salad, UtensilsCrossed,
  ShoppingCart, ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useEatsCart } from "@/contexts/EatsCartContext";
import CartDrawer from "@/components/customer/CartDrawer";

interface Restaurant {
  id: string;
  name: string;
  cuisineType: string;
  cityCode: string;
  averageRating: number;
  totalRatings: number;
  logoUrl: string | null;
  coverPhotoUrl?: string | null;
  isOpen: boolean;
  isFavorite: boolean;
  deliveryFee?: number;
  deliveryTime?: number;
  description?: string;
}

interface RestaurantsResponse {
  restaurants: Restaurant[];
  count: number;
}

// Base cuisine categories
const BASE_CUISINE_CATEGORIES = [
  { id: "all", label: "All", icon: UtensilsCrossed },
  { id: "Bengali", label: "Bengali", icon: UtensilsCrossed },
  { id: "Indian", label: "Indian", icon: Sparkles },
  { id: "American", label: "American", icon: Flame },
  { id: "Italian", label: "Italian", icon: Pizza },
  { id: "Chinese", label: "Chinese", icon: UtensilsCrossed },
  { id: "Japanese", label: "Japanese", icon: UtensilsCrossed },
  { id: "Mexican", label: "Mexican", icon: Flame },
  { id: "Thai", label: "Thai", icon: Sparkles },
  { id: "Fast Food", label: "Fast Food", icon: Truck },
  { id: "Healthy", label: "Healthy", icon: Salad },
  { id: "Coffee", label: "Coffee", icon: Coffee },
  { id: "Halal", label: "Halal", icon: UtensilsCrossed },
  { id: "Desserts", label: "Desserts", icon: Coffee },
  { id: "Pizza", label: "Pizza", icon: Pizza },
  { id: "Burgers", label: "Burgers", icon: Flame },
];

// Country-specific cuisine ordering
const BD_PRIORITY_CUISINES = ["all", "Bengali", "Indian", "Halal", "Chinese", "Thai"];
const US_PRIORITY_CUISINES = ["all", "American", "Italian", "Mexican", "Burgers", "Pizza", "Fast Food"];

function getCuisineCategories(countryCode: string | undefined) {
  const priorityCuisines = countryCode === "BD" ? BD_PRIORITY_CUISINES : US_PRIORITY_CUISINES;
  
  const prioritized = priorityCuisines
    .map(id => BASE_CUISINE_CATEGORIES.find(c => c.id === id))
    .filter(Boolean) as typeof BASE_CUISINE_CATEGORIES;
  
  const remaining = BASE_CUISINE_CATEGORIES.filter(
    c => !priorityCuisines.includes(c.id)
  );
  
  return [...prioritized, ...remaining];
}

const SORT_OPTIONS = [
  { value: "rating", label: "Top Rated" },
  { value: "name", label: "A-Z" },
  { value: "delivery", label: "Fastest Delivery" },
];

export default function EatsHome() {
  const { toast } = useToast();
  const { user, token } = useAuth();
  const { getItemCount, getTotals, state: cartState } = useEatsCart();
  
  const isLoggedIn = !!user && !!token && user.role === "customer";
  
  // Get country-specific cuisine categories (BD shows Bengali/Indian first, US shows American/Italian first)
  const userCountryCode = (user as { countryCode?: string } | null)?.countryCode;
  const cuisineCategories = getCuisineCategories(userCountryCode);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState("all");
  const [sortBy, setSortBy] = useState("rating");
  const [openNow, setOpenNow] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  const buildQueryParams = () => {
    const params = new URLSearchParams({ sortBy });
    if (selectedCuisine !== "all") {
      params.set("cuisineType", selectedCuisine);
    }
    if (openNow) {
      params.set("openNow", "true");
    }
    if (favoritesOnly && isLoggedIn) {
      params.set("favoritesOnly", "true");
    }
    if (searchQuery) {
      params.set("search", searchQuery);
    }
    return params;
  };

  const { data, isLoading, error, refetch } = useQuery<RestaurantsResponse>({
    queryKey: ['/api/eats/restaurants', sortBy, selectedCuisine, openNow, favoritesOnly, searchQuery, isLoggedIn],
    queryFn: async () => {
      const queryParams = buildQueryParams();
      
      if (isLoggedIn && token) {
        try {
          const authRes = await fetch('/api/customer/food/restaurants?' + queryParams.toString(), {
            credentials: 'include',
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (authRes.ok) {
            return await authRes.json();
          }
        } catch (e) {
          console.warn("[EatsHome] Auth endpoint failed, falling back to public");
        }
      }
      
      const res = await fetch(`/api/eats/restaurants?${queryParams.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch restaurants');
      return await res.json();
    },
    retry: 2,
    staleTime: 30000,
  });

  const toggleFavorite = useMutation({
    mutationFn: async ({ restaurantId, isFavorite }: { restaurantId: string; isFavorite: boolean }) => {
      const method = isFavorite ? 'DELETE' : 'POST';
      return apiRequest(`/api/customer/food/restaurants/${restaurantId}/favorite`, { method });
    },
    onSuccess: (_data, { isFavorite }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/eats/restaurants'] });
      toast({
        title: isFavorite ? "Removed from favorites" : "Added to favorites",
        duration: 2000,
      });
    },
  });

  const restaurants = data?.restaurants || [];
  const cartItemCount = getItemCount();
  const cartTotals = getTotals();

  // Featured sections for desktop horizontal carousels (sorted subsets)
  const topRatedRestaurants = [...restaurants]
    .sort((a, b) => b.averageRating - a.averageRating)
    .slice(0, 8);
  
  const popularRestaurants = [...restaurants]
    .sort((a, b) => b.totalRatings - a.totalRatings)
    .slice(0, 8);
  
  // Delivered Under 30 Minutes - filter by delivery time
  const fastDeliveryRestaurants = [...restaurants]
    .filter(r => r.isOpen && (r.deliveryTime || 35) <= 30)
    .sort((a, b) => (a.deliveryTime || 35) - (b.deliveryTime || 35))
    .slice(0, 8);
  
  // Recommended For You - combined score of rating and popularity
  const recommendedRestaurants = [...restaurants]
    .filter(r => r.isOpen && r.averageRating >= 4.0)
    .sort((a, b) => {
      const scoreA = a.averageRating * Math.log10(a.totalRatings + 1);
      const scoreB = b.averageRating * Math.log10(b.totalRatings + 1);
      return scoreB - scoreA;
    })
    .slice(0, 8);

  const DEFAULT_RESTAURANT_IMAGE = "/attached_assets/stock_images/italian_pizzeria_res_da132bc0.jpg";
  
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.currentTarget;
    if (target.src !== DEFAULT_RESTAURANT_IMAGE) {
      target.src = DEFAULT_RESTAURANT_IMAGE;
    }
  };

  // Mobile Card: Full-width VERTICAL layout with large stacked image (≤640px)
  // Approved Second Design: Big image on top, Name + Rating + Open badge below
  const MobileRestaurantCard = ({ restaurant }: { restaurant: Restaurant }) => (
    <Link href={`/customer/food/${restaurant.id}`}>
      <Card 
        className="overflow-hidden hover-elevate cursor-pointer transition-all group touch-manipulation"
        data-testid={`card-restaurant-mobile-${restaurant.id}`}
      >
        {/* Large Image Section - Aspect ratio ~1.6:1 with object-fit cover */}
        <div className="relative">
          <div className="h-48 bg-muted relative overflow-hidden">
            <img 
              src={restaurant.coverPhotoUrl || restaurant.logoUrl || DEFAULT_RESTAURANT_IMAGE} 
              alt={restaurant.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              onError={handleImageError}
            />
            {!restaurant.isOpen && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                <Badge variant="secondary" className="text-sm font-semibold">Currently Closed</Badge>
              </div>
            )}
          </div>
          {isLoggedIn && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 h-11 w-11 bg-background/80 backdrop-blur-sm hover:bg-background touch-manipulation"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleFavorite.mutate({ restaurantId: restaurant.id, isFavorite: restaurant.isFavorite });
              }}
              data-testid={`button-favorite-${restaurant.id}`}
            >
              <Heart className={`h-5 w-5 ${restaurant.isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
            </Button>
          )}
          {restaurant.deliveryFee === 0 && (
            <Badge className="absolute top-3 left-3 bg-green-600 text-sm font-semibold">Free Delivery</Badge>
          )}
        </div>
        {/* Content Section with proper spacing */}
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-lg truncate" data-testid={`text-restaurant-name-${restaurant.id}`}>
                {restaurant.name}
              </h3>
              <p className="text-sm text-muted-foreground truncate">{restaurant.cuisineType}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 bg-muted/50 rounded-md px-2.5 py-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium text-sm">{restaurant.averageRating.toFixed(1)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3 text-sm text-muted-foreground">
            {restaurant.isOpen && (
              <Badge variant="outline" className="border-green-500 text-green-600 text-sm font-semibold">Open</Badge>
            )}
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{restaurant.deliveryTime || '25-35'} min</span>
            </div>
            <span className="text-muted-foreground/40">·</span>
            <span>{restaurant.deliveryFee ? `$${restaurant.deliveryFee.toFixed(2)} delivery` : 'Free delivery'}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );

  // Desktop Card: Vertical layout with stacked image (≥1024px) - UNCHANGED from original
  const DesktopRestaurantCard = ({ restaurant }: { restaurant: Restaurant }) => (
    <Link href={`/customer/food/${restaurant.id}`}>
      <Card 
        className="overflow-hidden hover-elevate cursor-pointer transition-all group touch-manipulation"
        data-testid={`card-restaurant-${restaurant.id}`}
      >
        <div className="relative">
          <div className="h-44 bg-muted relative overflow-hidden">
            <img 
              src={restaurant.coverPhotoUrl || restaurant.logoUrl || DEFAULT_RESTAURANT_IMAGE} 
              alt={restaurant.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              onError={handleImageError}
            />
            {!restaurant.isOpen && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                <Badge variant="secondary">Currently Closed</Badge>
              </div>
            )}
          </div>
          {isLoggedIn && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-9 w-9 bg-background/80 backdrop-blur-sm hover:bg-background"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleFavorite.mutate({ restaurantId: restaurant.id, isFavorite: restaurant.isFavorite });
              }}
              data-testid={`button-favorite-${restaurant.id}`}
            >
              <Heart className={`h-4 w-4 ${restaurant.isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
            </Button>
          )}
          {restaurant.deliveryFee === 0 && (
            <Badge className="absolute top-2 left-2 bg-green-600">Free Delivery</Badge>
          )}
        </div>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-lg truncate" data-testid={`text-restaurant-name-${restaurant.id}`}>
                {restaurant.name}
              </h3>
              <p className="text-sm text-muted-foreground truncate">{restaurant.cuisineType}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 bg-muted/50 rounded-md px-2 py-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium text-sm">{restaurant.averageRating.toFixed(1)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{restaurant.deliveryTime || '25-35'} min</span>
            </div>
            <span className="text-muted-foreground/40">·</span>
            <span>{restaurant.deliveryFee ? `$${restaurant.deliveryFee.toFixed(2)} delivery` : 'Free delivery'}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );

  // Mobile Skeleton: Full-width vertical layout matching MobileRestaurantCard
  const MobileRestaurantSkeleton = () => (
    <Card className="overflow-hidden">
      <Skeleton className="h-48 rounded-none" />
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between gap-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
    </Card>
  );

  // Desktop Skeleton: Vertical layout (≥1024px only) - UNCHANGED from original
  const DesktopRestaurantSkeleton = () => (
    <Card className="overflow-hidden">
      <Skeleton className="h-44 rounded-none" />
      <CardContent className="p-4 space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
    </Card>
  );

  // Desktop Horizontal Carousel Card - Uses same styling as DesktopRestaurantCard for consistency
  const CarouselRestaurantCard = ({ restaurant }: { restaurant: Restaurant }) => (
    <Link href={`/customer/food/${restaurant.id}`}>
      <Card 
        className="overflow-hidden hover-elevate cursor-pointer transition-all group w-[280px] flex-shrink-0"
        data-testid={`card-restaurant-${restaurant.id}`}
      >
        <div className="relative">
          <div className="h-40 bg-muted relative overflow-hidden">
            <img 
              src={restaurant.coverPhotoUrl || restaurant.logoUrl || DEFAULT_RESTAURANT_IMAGE} 
              alt={restaurant.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              onError={handleImageError}
            />
            {!restaurant.isOpen && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                <Badge variant="secondary">Currently Closed</Badge>
              </div>
            )}
          </div>
          {restaurant.deliveryFee === 0 && (
            <Badge className="absolute top-2 left-2 bg-green-600">Free Delivery</Badge>
          )}
        </div>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-lg truncate">{restaurant.name}</h3>
              <p className="text-sm text-muted-foreground truncate">{restaurant.cuisineType}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 bg-muted/50 rounded-md px-2 py-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium text-sm">{restaurant.averageRating.toFixed(1)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{restaurant.deliveryTime || '25-35'} min</span>
            </div>
            <span className="text-muted-foreground/40">·</span>
            <span>{restaurant.deliveryFee ? `$${restaurant.deliveryFee.toFixed(2)} delivery` : 'Free delivery'}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );

  // Carousel Skeleton for featured sections - matches DesktopRestaurantSkeleton styling
  const CarouselSkeleton = () => (
    <Card className="overflow-hidden w-[280px] flex-shrink-0">
      <Skeleton className="h-40 rounded-none" />
      <CardContent className="p-4 space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
    </Card>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Header with delivery location and cart */}
      <header className="sticky top-0 z-40 bg-background border-b">
        <div className="p-2 sm:p-3 space-y-2 sm:space-y-3">
          {/* Location and Cart Row */}
          <div className="flex items-center justify-between gap-3">
            <button 
              className="flex items-center gap-2 hover-elevate rounded-lg p-2 -m-2 transition-colors min-h-[44px] touch-manipulation"
              data-testid="button-change-location"
            >
              <MapPin className="h-5 w-5 text-primary flex-shrink-0" />
              <div className="text-left min-w-0">
                <p className="text-sm text-muted-foreground leading-tight">Deliver to</p>
                <p className="font-medium text-sm flex items-center gap-1 truncate">
                  <span className="truncate">Current Location</span>
                  <ChevronDown className="h-4 w-4 flex-shrink-0" />
                </p>
              </div>
            </button>
            
            <Button
              variant="outline"
              className="relative h-11 px-4 touch-manipulation"
              onClick={() => setIsCartOpen(true)}
              data-testid="button-open-cart"
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              <span className="text-sm">Cart</span>
              {cartItemCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {cartItemCount}
                </Badge>
              )}
            </Button>
          </div>

          {/* Hero Search - 44px+ touch target */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search restaurants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-14 h-12 text-sm rounded-full bg-muted/50 border-0 focus-visible:ring-2"
              data-testid="input-search-restaurants"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0.5 top-1/2 -translate-y-1/2 h-11 w-11 touch-manipulation"
                onClick={() => setSearchQuery("")}
                data-testid="button-clear-search"
              >
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Cuisine Categories Strip - Country-specific ordering, WCAG 2.1 AA compliant 44px touch targets */}
        <ScrollArea className="w-full whitespace-nowrap border-t">
          <div className="flex gap-2 p-2 px-3">
            {cuisineCategories.map((category) => {
              const Icon = category.icon;
              const isSelected = selectedCuisine === category.id;
              return (
                <Button
                  key={category.id}
                  variant={isSelected ? "default" : "ghost"}
                  className={`rounded-full gap-1.5 flex-shrink-0 h-11 px-4 touch-manipulation ${isSelected ? '' : 'text-muted-foreground'}`}
                  onClick={() => setSelectedCuisine(category.id)}
                  data-testid={`button-cuisine-${category.id}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-sm">{category.label}</span>
                </Button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </header>

      {/* Main Content */}
      <ScrollArea className="flex-1">
        <div className="p-2 sm:p-4 space-y-3 sm:space-y-5">
          {/* Filters Row - WCAG compliant 44px touch targets */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[130px] h-11 text-sm touch-manipulation" data-testid="select-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="min-h-[44px] text-sm">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant={openNow ? "default" : "outline"}
              onClick={() => setOpenNow(!openNow)}
              className="gap-1.5 h-11 px-4 text-sm touch-manipulation"
              data-testid="button-open-now"
            >
              <Clock className="h-4 w-4" />
              <span>Open Now</span>
            </Button>

            {isLoggedIn && (
              <Button
                variant={favoritesOnly ? "default" : "outline"}
                onClick={() => setFavoritesOnly(!favoritesOnly)}
                className="gap-1.5 h-11 px-4 text-sm touch-manipulation"
                data-testid="button-favorites"
              >
                <Heart className="h-4 w-4" />
                <span>Favorites</span>
              </Button>
            )}

            {/* Desktop: Show price range inline (≥1024px) */}
            <div className="hidden lg:flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Price:</span>
              {["$", "$$", "$$$", "$$$$"].map((price, idx) => (
                <Button 
                  key={price} 
                  variant="outline" 
                  size="sm"
                  className="px-3" 
                  data-testid={`button-price-desktop-${idx + 1}`}
                >
                  {price}
                </Button>
              ))}
            </div>

            {/* Mobile/Tablet: Show Filters Sheet button (≤1023px) */}
            <Sheet open={showFilters} onOpenChange={setShowFilters}>
              <SheetTrigger asChild>
                <Button variant="outline" className="gap-1.5 h-11 px-4 text-sm touch-manipulation lg:hidden" data-testid="button-filters">
                  <Filter className="h-4 w-4" />
                  <span>Filters</span>
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[300px] sm:w-[400px]">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="py-6 space-y-6">
                  <div className="space-y-4">
                    <Label className="text-base font-medium">Dietary Preferences</Label>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3 min-h-[44px]">
                        <Checkbox id="vegetarian" className="h-5 w-5" data-testid="checkbox-vegetarian" />
                        <label htmlFor="vegetarian" className="text-sm cursor-pointer">Vegetarian</label>
                      </div>
                      <div className="flex items-center space-x-3 min-h-[44px]">
                        <Checkbox id="vegan" className="h-5 w-5" data-testid="checkbox-vegan" />
                        <label htmlFor="vegan" className="text-sm cursor-pointer">Vegan</label>
                      </div>
                      <div className="flex items-center space-x-3 min-h-[44px]">
                        <Checkbox id="halal" className="h-5 w-5" data-testid="checkbox-halal" />
                        <label htmlFor="halal" className="text-sm cursor-pointer">Halal</label>
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-4">
                    <Label className="text-base font-medium">Price Range</Label>
                    <div className="flex gap-2">
                      {["$", "$$", "$$$", "$$$$"].map((price, idx) => (
                        <Button 
                          key={price} 
                          variant="outline" 
                          className="h-11 px-4 touch-manipulation text-sm" 
                          data-testid={`button-price-${idx + 1}`}
                        >
                          {price}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-6 w-44" />
              {/* Mobile + Tablet Loading (≤1023px): Vertical cards */}
              <div className="flex flex-col gap-4 lg:hidden">
                {Array.from({ length: 6 }).map((_, i) => (
                  <MobileRestaurantSkeleton key={i} />
                ))}
              </div>
              {/* Desktop Loading (≥1024px): Grid layout - UNCHANGED */}
              <div className="hidden lg:grid lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <DesktopRestaurantSkeleton key={i} />
                ))}
              </div>
            </div>
          )}

          {/* No Results */}
          {!isLoading && restaurants.length === 0 && (
            <div className="text-center py-8 sm:py-12 px-4">
              <UtensilsCrossed className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg sm:text-xl font-semibold mb-2">No restaurants found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery 
                  ? `No results for "${searchQuery}"`
                  : "Try adjusting your filters"}
              </p>
              <Button 
                variant="outline" 
                className="h-11 px-6 touch-manipulation"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCuisine("all");
                  setOpenNow(false);
                  setFavoritesOnly(false);
                }}
                data-testid="button-clear-all-filters"
              >
                Clear Filters
              </Button>
            </div>
          )}

          {/* Desktop Featured Sections (≥1024px only) - Horizontal Carousels */}
          {/* Show only when not searching/filtering and restaurants are available */}
          {!isLoading && restaurants.length > 0 && !searchQuery && selectedCuisine === "all" && !openNow && !favoritesOnly && (
            <div className="hidden lg:block space-y-6">
              {/* Popular Near You Carousel */}
              {popularRestaurants.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <Flame className="h-5 w-5 text-orange-500" />
                      Popular Near You
                    </h2>
                  </div>
                  <ScrollArea className="w-full">
                    <div className="flex gap-4 pb-4">
                      {popularRestaurants.map((restaurant) => (
                        <CarouselRestaurantCard key={`popular-${restaurant.id}`} restaurant={restaurant} />
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </section>
              )}

              {/* Top Rated Carousel */}
              {topRatedRestaurants.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <Star className="h-5 w-5 text-yellow-500" />
                      Top Rated
                    </h2>
                  </div>
                  <ScrollArea className="w-full">
                    <div className="flex gap-4 pb-4">
                      {topRatedRestaurants.map((restaurant) => (
                        <CarouselRestaurantCard key={`rated-${restaurant.id}`} restaurant={restaurant} />
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </section>
              )}

              {/* Delivered Under 30 Minutes Carousel */}
              {fastDeliveryRestaurants.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <Truck className="h-5 w-5 text-green-500" />
                      Delivered Under 30 Minutes
                    </h2>
                  </div>
                  <ScrollArea className="w-full">
                    <div className="flex gap-4 pb-4">
                      {fastDeliveryRestaurants.map((restaurant) => (
                        <CarouselRestaurantCard key={`fast-${restaurant.id}`} restaurant={restaurant} />
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </section>
              )}

              {/* Recommended For You Carousel */}
              {recommendedRestaurants.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-purple-500" />
                      Recommended For You
                    </h2>
                  </div>
                  <ScrollArea className="w-full">
                    <div className="flex gap-4 pb-4">
                      {recommendedRestaurants.map((restaurant) => (
                        <CarouselRestaurantCard key={`recommended-${restaurant.id}`} restaurant={restaurant} />
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </section>
              )}

              <Separator />
            </div>
          )}

          {/* Desktop Carousel Loading State (≥1024px only) */}
          {isLoading && (
            <div className="hidden lg:block space-y-6">
              <section>
                <Skeleton className="h-6 w-40 mb-4" />
                <div className="flex gap-4 overflow-hidden">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <CarouselSkeleton key={`popular-skeleton-${i}`} />
                  ))}
                </div>
              </section>
              <section>
                <Skeleton className="h-6 w-32 mb-4" />
                <div className="flex gap-4 overflow-hidden">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <CarouselSkeleton key={`rated-skeleton-${i}`} />
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* Restaurant Content - Responsive Layouts */}
          {!isLoading && restaurants.length > 0 && (
            <section>
              <h2 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2">
                {searchQuery ? (
                  <>
                    <Search className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                    Results for "{searchQuery}"
                  </>
                ) : selectedCuisine !== "all" ? (
                  <>
                    <UtensilsCrossed className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    {selectedCuisine} Restaurants
                  </>
                ) : (
                  <>
                    <Flame className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
                    All Restaurants
                  </>
                )}
                <span className="text-muted-foreground font-normal text-sm ml-1">
                  ({restaurants.length})
                </span>
              </h2>
              
              {/* Mobile + Tablet Layout (≤1023px): Full-width vertical cards with 16px spacing */}
              {/* Using approved Second Design for mobile and tablet views */}
              <div className="flex flex-col gap-4 lg:hidden">
                {restaurants.map((restaurant) => (
                  <MobileRestaurantCard key={restaurant.id} restaurant={restaurant} />
                ))}
              </div>
              
              {/* Desktop Layout (≥1024px): Grid - UNCHANGED from original */}
              <div className="hidden lg:grid lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {restaurants.map((restaurant) => (
                  <DesktopRestaurantCard key={restaurant.id} restaurant={restaurant} />
                ))}
              </div>
            </section>
          )}
        </div>
      </ScrollArea>

      {/* Floating Cart Button (Mobile) - WCAG 2.1 AA compliant touch target */}
      {cartItemCount > 0 && (
        <div className="fixed bottom-4 left-3 right-3 sm:left-4 sm:right-4 md:hidden z-50 pb-safe">
          <Button
            className="w-full h-12 shadow-lg gap-2 text-sm font-medium touch-manipulation"
            onClick={() => setIsCartOpen(true)}
            data-testid="button-floating-cart"
          >
            <ShoppingCart className="h-5 w-5 flex-shrink-0" />
            <span className="truncate">View Cart ({cartItemCount} items)</span>
            <span className="ml-auto font-bold flex-shrink-0">${cartTotals.total.toFixed(2)}</span>
          </Button>
        </div>
      )}

      {/* Cart Drawer */}
      <CartDrawer open={isCartOpen} onOpenChange={setIsCartOpen} />
    </div>
  );
}
