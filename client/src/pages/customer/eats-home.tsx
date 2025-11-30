import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Search, MapPin, Star, Clock, Heart, ChevronRight, Filter, X,
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

const CUISINE_CATEGORIES = [
  { id: "all", label: "All", icon: UtensilsCrossed },
  { id: "American", label: "American", icon: Flame },
  { id: "Italian", label: "Italian", icon: Pizza },
  { id: "Indian", label: "Indian", icon: Sparkles },
  { id: "Chinese", label: "Chinese", icon: UtensilsCrossed },
  { id: "Bengali", label: "Bengali", icon: UtensilsCrossed },
  { id: "Japanese", label: "Japanese", icon: UtensilsCrossed },
  { id: "Mexican", label: "Mexican", icon: Flame },
  { id: "Thai", label: "Thai", icon: Sparkles },
  { id: "Fast Food", label: "Fast Food", icon: Truck },
  { id: "Healthy", label: "Healthy", icon: Salad },
  { id: "Coffee", label: "Coffee", icon: Coffee },
];

const SORT_OPTIONS = [
  { value: "rating", label: "Top Rated" },
  { value: "name", label: "A-Z" },
  { value: "delivery", label: "Fastest Delivery" },
];

export default function EatsHome() {
  const [, setLocationPath] = useLocation();
  const { toast } = useToast();
  const { user, token } = useAuth();
  const { getItemCount, getTotals, state: cartState } = useEatsCart();
  
  const isLoggedIn = !!user && !!token && user.role === "customer";
  
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

  // Featured sections
  const popularRestaurants = [...restaurants].sort((a, b) => b.totalRatings - a.totalRatings).slice(0, 6);
  const topRatedRestaurants = [...restaurants].sort((a, b) => b.averageRating - a.averageRating).slice(0, 6);
  const openRestaurants = restaurants.filter(r => r.isOpen);

  const RestaurantCard = ({ restaurant, featured = false }: { restaurant: Restaurant; featured?: boolean }) => (
    <Link href={`/customer/food/${restaurant.id}`}>
      <Card 
        className={`overflow-hidden hover-elevate cursor-pointer transition-all group touch-manipulation ${featured ? 'min-w-[180px] sm:min-w-[240px]' : ''}`}
        data-testid={`card-restaurant-${restaurant.id}`}
      >
        <div className="relative">
          <div className={`${featured ? 'h-24 sm:h-32' : 'h-24 sm:h-28'} bg-muted relative overflow-hidden`}>
            {(restaurant.coverPhotoUrl || restaurant.logoUrl) ? (
              <img 
                src={restaurant.coverPhotoUrl || restaurant.logoUrl || ''} 
                alt={restaurant.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/40">
                <UtensilsCrossed className="h-8 w-8 sm:h-10 sm:w-10 text-primary/60" />
              </div>
            )}
            {!restaurant.isOpen && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                <Badge variant="secondary" className="text-[10px] sm:text-xs">Closed</Badge>
              </div>
            )}
          </div>
          {isLoggedIn && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-1.5 right-1.5 h-8 w-8 sm:h-9 sm:w-9 bg-background/80 backdrop-blur-sm hover:bg-background touch-manipulation"
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
            <Badge className="absolute top-1.5 left-1.5 bg-green-600 text-[10px] sm:text-xs py-0.5 px-1.5">Free</Badge>
          )}
        </div>
        <CardContent className="p-2 sm:p-3">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-xs sm:text-sm truncate leading-tight" data-testid={`text-restaurant-name-${restaurant.id}`}>
                {restaurant.name}
              </h3>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{restaurant.cuisineType}</p>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0 bg-muted/50 rounded px-1 py-0.5">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span className="font-medium text-xs">{restaurant.averageRating.toFixed(1)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-[10px] sm:text-xs text-muted-foreground">
            <div className="flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              <span>{restaurant.deliveryTime || '25-35'} min</span>
            </div>
            <span className="text-muted-foreground/40">·</span>
            <span>{restaurant.deliveryFee ? `$${restaurant.deliveryFee.toFixed(2)}` : 'Free'}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );

  const RestaurantSkeleton = ({ featured = false }: { featured?: boolean }) => (
    <Card className={`overflow-hidden ${featured ? 'min-w-[180px] sm:min-w-[240px]' : ''}`}>
      <Skeleton className={`${featured ? 'h-24 sm:h-32' : 'h-24 sm:h-28'} rounded-none`} />
      <CardContent className="p-2 sm:p-3 space-y-1.5">
        <Skeleton className="h-3.5 sm:h-4 w-3/4" />
        <Skeleton className="h-2.5 sm:h-3 w-1/2" />
        <Skeleton className="h-2.5 sm:h-3 w-2/3" />
      </CardContent>
    </Card>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Header with delivery location and cart */}
      <header className="sticky top-0 z-40 bg-background border-b">
        <div className="p-2 sm:p-3 space-y-2 sm:space-y-3">
          {/* Location and Cart Row */}
          <div className="flex items-center justify-between gap-2">
            <button 
              className="flex items-center gap-1.5 hover:bg-muted/50 rounded-lg p-1.5 -m-1.5 transition-colors min-h-[40px] touch-manipulation"
              data-testid="button-change-location"
            >
              <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
              <div className="text-left min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">Deliver to</p>
                <p className="font-medium text-xs sm:text-sm flex items-center gap-0.5 truncate">
                  <span className="truncate">Current Location</span>
                  <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                </p>
              </div>
            </button>
            
            <Button
              variant="outline"
              size="sm"
              className="relative h-9 px-2.5 sm:px-3 touch-manipulation"
              onClick={() => setIsCartOpen(true)}
              data-testid="button-open-cart"
            >
              <ShoppingCart className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline text-sm">Cart</span>
              {cartItemCount > 0 && (
                <Badge className="absolute -top-1.5 -right-1.5 h-4 w-4 sm:h-5 sm:w-5 p-0 flex items-center justify-center text-[10px] sm:text-xs">
                  {cartItemCount}
                </Badge>
              )}
            </Button>
          </div>

          {/* Hero Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search restaurants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 sm:pl-10 pr-8 sm:pr-10 h-9 sm:h-10 text-sm sm:text-base rounded-full bg-muted/50 border-0 focus-visible:ring-2"
              data-testid="input-search-restaurants"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 sm:h-8 sm:w-8 touch-manipulation"
                onClick={() => setSearchQuery("")}
                data-testid="button-clear-search"
              >
                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Cuisine Categories Strip - Touch-friendly horizontal scroll */}
        <ScrollArea className="w-full whitespace-nowrap border-t">
          <div className="flex gap-1 p-1.5 px-2 sm:p-2 sm:px-3">
            {CUISINE_CATEGORIES.map((category) => {
              const Icon = category.icon;
              const isSelected = selectedCuisine === category.id;
              return (
                <Button
                  key={category.id}
                  variant={isSelected ? "default" : "ghost"}
                  size="sm"
                  className={`rounded-full gap-1 flex-shrink-0 h-7 sm:h-8 px-2 sm:px-3 touch-manipulation ${isSelected ? '' : 'text-muted-foreground'}`}
                  onClick={() => setSelectedCuisine(category.id)}
                  data-testid={`button-cuisine-${category.id}`}
                >
                  <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="text-[11px] sm:text-xs">{category.label}</span>
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
          {/* Filters Row - Touch-friendly with proper spacing */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[100px] sm:w-[130px] h-8 sm:h-9 text-xs sm:text-sm touch-manipulation" data-testid="select-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="min-h-[40px] sm:min-h-[36px] text-sm">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant={openNow ? "default" : "outline"}
              size="sm"
              onClick={() => setOpenNow(!openNow)}
              className="gap-1 h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm touch-manipulation"
              data-testid="button-open-now"
            >
              <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>Open</span>
            </Button>

            {isLoggedIn && (
              <Button
                variant={favoritesOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setFavoritesOnly(!favoritesOnly)}
                className="gap-1 h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm touch-manipulation"
                data-testid="button-favorites"
              >
                <Heart className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Favorites</span>
              </Button>
            )}

            <Sheet open={showFilters} onOpenChange={setShowFilters}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm touch-manipulation" data-testid="button-filters">
                  <Filter className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Filters</span>
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[300px] sm:w-[400px]">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="py-4 space-y-4">
                  <div className="space-y-3">
                    <Label>Dietary Preferences</Label>
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
                  <div className="space-y-3">
                    <Label>Price Range</Label>
                    <div className="flex gap-2">
                      {["$", "$$", "$$$", "$$$$"].map((price, idx) => (
                        <Button 
                          key={price} 
                          variant="outline" 
                          className="h-10 px-4 touch-manipulation" 
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
            <div className="space-y-3 sm:space-y-5">
              <div className="space-y-2 sm:space-y-3">
                <Skeleton className="h-4 sm:h-5 w-28 sm:w-32" />
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <RestaurantSkeleton key={i} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* No Results */}
          {!isLoading && restaurants.length === 0 && (
            <div className="text-center py-6 sm:py-10 px-3">
              <UtensilsCrossed className="h-10 w-10 sm:h-14 sm:w-14 mx-auto text-muted-foreground/50 mb-3" />
              <h3 className="text-sm sm:text-lg font-semibold mb-1.5">No restaurants found</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mb-3">
                {searchQuery 
                  ? `No results for "${searchQuery}"`
                  : "Try adjusting your filters"}
              </p>
              <Button 
                variant="outline" 
                size="sm"
                className="h-8 sm:h-9 text-xs sm:text-sm touch-manipulation"
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

          {/* Restaurant Content */}
          {!isLoading && restaurants.length > 0 && (
            <>
              {/* Popular Near You - Horizontal Scroll */}
              {!searchQuery && selectedCuisine === "all" && popularRestaurants.length > 0 && (
                <section>
                  <div className="flex items-center justify-between gap-1 mb-2 sm:mb-3">
                    <h2 className="text-sm sm:text-base font-bold flex items-center gap-1 sm:gap-1.5">
                      <Flame className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-500 flex-shrink-0" />
                      <span>Popular</span>
                    </h2>
                    <Button variant="ghost" size="sm" className="gap-0.5 text-muted-foreground h-7 sm:h-8 px-1.5 sm:px-2 text-xs touch-manipulation" data-testid="button-see-all-popular">
                      <span>All</span>
                      <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </div>
                  <ScrollArea className="w-full whitespace-nowrap -mx-2 px-2 sm:-mx-4 sm:px-4">
                    <div className="flex gap-2 sm:gap-3">
                      {popularRestaurants.map((restaurant) => (
                        <RestaurantCard key={restaurant.id} restaurant={restaurant} featured />
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </section>
              )}

              {/* Top Rated */}
              {!searchQuery && selectedCuisine === "all" && topRatedRestaurants.length > 0 && (
                <section>
                  <div className="flex items-center justify-between gap-1 mb-2 sm:mb-3">
                    <h2 className="text-sm sm:text-base font-bold flex items-center gap-1 sm:gap-1.5">
                      <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-500 flex-shrink-0" />
                      <span>Top Rated</span>
                    </h2>
                    <Button variant="ghost" size="sm" className="gap-0.5 text-muted-foreground h-7 sm:h-8 px-1.5 sm:px-2 text-xs touch-manipulation" data-testid="button-see-all-top-rated">
                      <span>All</span>
                      <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </div>
                  <ScrollArea className="w-full whitespace-nowrap -mx-2 px-2 sm:-mx-4 sm:px-4">
                    <div className="flex gap-2 sm:gap-3">
                      {topRatedRestaurants.map((restaurant) => (
                        <RestaurantCard key={restaurant.id} restaurant={restaurant} featured />
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </section>
              )}

              {/* All Restaurants Grid - Responsive columns */}
              <section>
                <h2 className="text-sm sm:text-base font-bold mb-2 sm:mb-3">
                  {searchQuery 
                    ? `Results for "${searchQuery}"` 
                    : selectedCuisine !== "all"
                      ? `${selectedCuisine}`
                      : "All Restaurants"}
                  <span className="text-muted-foreground font-normal text-[10px] sm:text-xs ml-1.5">
                    ({restaurants.length})
                  </span>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                  {restaurants.map((restaurant) => (
                    <RestaurantCard key={restaurant.id} restaurant={restaurant} />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </ScrollArea>

      {/* Floating Cart Button (Mobile) - Safe area aware */}
      {cartItemCount > 0 && (
        <div className="fixed bottom-3 left-2 right-2 sm:left-4 sm:right-4 md:hidden z-50 pb-safe">
          <Button
            className="w-full h-12 shadow-lg gap-1.5 text-xs sm:text-sm touch-manipulation"
            onClick={() => setIsCartOpen(true)}
            data-testid="button-floating-cart"
          >
            <ShoppingCart className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">Cart ({cartItemCount})</span>
            <span className="ml-auto font-bold flex-shrink-0">${cartTotals.total.toFixed(2)}</span>
          </Button>
        </div>
      )}

      {/* Cart Drawer */}
      <CartDrawer open={isCartOpen} onOpenChange={setIsCartOpen} />
    </div>
  );
}
