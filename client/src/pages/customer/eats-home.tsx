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
  const [demoSeeded, setDemoSeeded] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Seed demo data on first load
  useEffect(() => {
    if (!demoSeeded) {
      fetch("/api/eats/seed-demo", { method: "POST" })
        .then(() => {
          setDemoSeeded(true);
          queryClient.invalidateQueries({ queryKey: ['/api/eats/restaurants'] });
        })
        .catch(() => setDemoSeeded(true));
    }
  }, [demoSeeded]);

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
        className={`overflow-hidden hover-elevate cursor-pointer transition-all group touch-manipulation ${featured ? 'min-w-[220px] xs:min-w-[240px] sm:min-w-[280px]' : ''}`}
        data-testid={`card-restaurant-${restaurant.id}`}
      >
        <div className="relative">
          <div className={`${featured ? 'h-32 sm:h-36' : 'h-28 sm:h-32'} bg-muted relative overflow-hidden`}>
            {restaurant.logoUrl ? (
              <img 
                src={restaurant.logoUrl} 
                alt={restaurant.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/40">
                <UtensilsCrossed className="h-10 w-10 sm:h-12 sm:w-12 text-primary/60" />
              </div>
            )}
            {!restaurant.isOpen && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                <Badge variant="secondary" className="text-xs sm:text-sm">Currently Closed</Badge>
              </div>
            )}
          </div>
          {isLoggedIn && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-10 w-10 sm:h-9 sm:w-9 bg-background/80 backdrop-blur-sm hover:bg-background touch-manipulation"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleFavorite.mutate({ restaurantId: restaurant.id, isFavorite: restaurant.isFavorite });
              }}
              data-testid={`button-favorite-${restaurant.id}`}
            >
              <Heart className={`h-5 w-5 sm:h-4 sm:w-4 ${restaurant.isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
            </Button>
          )}
          {restaurant.deliveryFee === 0 && (
            <Badge className="absolute top-2 left-2 bg-green-600 text-xs">Free Delivery</Badge>
          )}
        </div>
        <CardContent className="p-3 sm:p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-sm sm:text-base truncate" data-testid={`text-restaurant-name-${restaurant.id}`}>
                {restaurant.name}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">{restaurant.cuisineType}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium text-sm">{restaurant.averageRating.toFixed(1)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{restaurant.deliveryTime || '25-35'} min</span>
            </div>
            <div className="flex items-center gap-1">
              <Truck className="h-3 w-3" />
              <span>{restaurant.deliveryFee ? `$${restaurant.deliveryFee.toFixed(2)}` : 'Free'}</span>
            </div>
            <span className="text-muted-foreground/60">({restaurant.totalRatings})</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );

  const RestaurantSkeleton = ({ featured = false }: { featured?: boolean }) => (
    <Card className={`overflow-hidden ${featured ? 'min-w-[220px] xs:min-w-[240px] sm:min-w-[280px]' : ''}`}>
      <Skeleton className={`${featured ? 'h-32 sm:h-36' : 'h-28 sm:h-32'} rounded-none`} />
      <CardContent className="p-3 space-y-2">
        <Skeleton className="h-4 sm:h-5 w-3/4" />
        <Skeleton className="h-3 sm:h-4 w-1/2" />
        <Skeleton className="h-3 sm:h-4 w-2/3" />
      </CardContent>
    </Card>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Header with delivery location and cart */}
      <header className="sticky top-0 z-40 bg-background border-b">
        <div className="p-3 sm:p-4 space-y-3">
          {/* Location and Cart Row */}
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <button 
              className="flex items-center gap-2 hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors min-h-[44px] touch-manipulation"
              data-testid="button-change-location"
            >
              <MapPin className="h-5 w-5 text-primary flex-shrink-0" />
              <div className="text-left min-w-0">
                <p className="text-xs text-muted-foreground">Deliver to</p>
                <p className="font-medium text-sm flex items-center gap-1 truncate">
                  <span className="truncate">Current Location</span>
                  <ChevronDown className="h-4 w-4 flex-shrink-0" />
                </p>
              </div>
            </button>
            
            <Button
              variant="outline"
              className="relative h-10 sm:h-9 px-3 sm:px-4 touch-manipulation"
              onClick={() => setIsCartOpen(true)}
              data-testid="button-open-cart"
            >
              <ShoppingCart className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Cart</span>
              {cartItemCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {cartItemCount}
                </Badge>
              )}
            </Button>
          </div>

          {/* Hero Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search restaurants, cuisines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 h-11 sm:h-12 text-base rounded-full bg-muted/50 border-0 focus-visible:ring-2"
              data-testid="input-search-restaurants"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 touch-manipulation"
                onClick={() => setSearchQuery("")}
                data-testid="button-clear-search"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Cuisine Categories Strip - Touch-friendly horizontal scroll */}
        <ScrollArea className="w-full whitespace-nowrap border-t">
          <div className="flex gap-1.5 sm:gap-1 p-2 px-3 sm:px-2">
            {CUISINE_CATEGORIES.map((category) => {
              const Icon = category.icon;
              const isSelected = selectedCuisine === category.id;
              return (
                <Button
                  key={category.id}
                  variant={isSelected ? "default" : "ghost"}
                  className={`rounded-full gap-1.5 sm:gap-2 flex-shrink-0 h-9 sm:h-8 px-3 sm:px-3 text-sm touch-manipulation ${isSelected ? '' : 'text-muted-foreground'}`}
                  onClick={() => setSelectedCuisine(category.id)}
                  data-testid={`button-cuisine-${category.id}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-xs sm:text-sm">{category.label}</span>
                </Button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </header>

      {/* Main Content */}
      <ScrollArea className="flex-1">
        <div className="p-3 sm:p-4 space-y-5 sm:space-y-6">
          {/* Filters Row - Touch-friendly with proper spacing */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[130px] sm:w-[140px] h-10 sm:h-9 text-sm touch-manipulation" data-testid="select-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="min-h-[44px] sm:min-h-[36px]">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant={openNow ? "default" : "outline"}
              onClick={() => setOpenNow(!openNow)}
              className="gap-1.5 sm:gap-2 h-10 sm:h-9 px-3 text-sm touch-manipulation"
              data-testid="button-open-now"
            >
              <Clock className="h-4 w-4" />
              <span className="hidden xs:inline">Open Now</span>
              <span className="xs:hidden">Open</span>
            </Button>

            {isLoggedIn && (
              <Button
                variant={favoritesOnly ? "default" : "outline"}
                onClick={() => setFavoritesOnly(!favoritesOnly)}
                className="gap-1.5 sm:gap-2 h-10 sm:h-9 px-3 text-sm touch-manipulation"
                data-testid="button-favorites"
              >
                <Heart className="h-4 w-4" />
                <span className="hidden sm:inline">Favorites</span>
              </Button>
            )}

            <Sheet open={showFilters} onOpenChange={setShowFilters}>
              <SheetTrigger asChild>
                <Button variant="outline" className="gap-1.5 sm:gap-2 h-10 sm:h-9 px-3 text-sm touch-manipulation" data-testid="button-filters">
                  <Filter className="h-4 w-4" />
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
            <div className="space-y-5 sm:space-y-6">
              <div className="space-y-3">
                <Skeleton className="h-5 sm:h-6 w-32" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <RestaurantSkeleton key={i} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* No Results */}
          {!isLoading && restaurants.length === 0 && (
            <div className="text-center py-8 sm:py-12 px-4">
              <UtensilsCrossed className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-base sm:text-lg font-semibold mb-2">No restaurants found</h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-4">
                {searchQuery 
                  ? `No results for "${searchQuery}"`
                  : "Try adjusting your filters or check back later"}
              </p>
              <Button 
                variant="outline" 
                className="h-10 touch-manipulation"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCuisine("all");
                  setOpenNow(false);
                  setFavoritesOnly(false);
                }}
                data-testid="button-clear-all-filters"
              >
                Clear All Filters
              </Button>
            </div>
          )}

          {/* Restaurant Content */}
          {!isLoading && restaurants.length > 0 && (
            <>
              {/* Popular Near You - Horizontal Scroll */}
              {!searchQuery && selectedCuisine === "all" && popularRestaurants.length > 0 && (
                <section>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h2 className="text-base sm:text-lg font-bold flex items-center gap-1.5 sm:gap-2">
                      <Flame className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500 flex-shrink-0" />
                      <span>Popular Near You</span>
                    </h2>
                    <Button variant="ghost" className="gap-1 text-muted-foreground h-9 px-2 sm:px-3 text-sm touch-manipulation" data-testid="button-see-all-popular">
                      <span className="hidden sm:inline">See all</span>
                      <span className="sm:hidden">All</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <ScrollArea className="w-full whitespace-nowrap -mx-3 px-3 sm:-mx-4 sm:px-4">
                    <div className="flex gap-3 sm:gap-4">
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
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h2 className="text-base sm:text-lg font-bold flex items-center gap-1.5 sm:gap-2">
                      <Star className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500 flex-shrink-0" />
                      <span>Top Rated</span>
                    </h2>
                    <Button variant="ghost" className="gap-1 text-muted-foreground h-9 px-2 sm:px-3 text-sm touch-manipulation" data-testid="button-see-all-top-rated">
                      <span className="hidden sm:inline">See all</span>
                      <span className="sm:hidden">All</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <ScrollArea className="w-full whitespace-nowrap -mx-3 px-3 sm:-mx-4 sm:px-4">
                    <div className="flex gap-3 sm:gap-4">
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
                <h2 className="text-base sm:text-lg font-bold mb-3">
                  {searchQuery 
                    ? `Results for "${searchQuery}"` 
                    : selectedCuisine !== "all"
                      ? `${selectedCuisine} Restaurants`
                      : "All Restaurants"}
                  <span className="text-muted-foreground font-normal text-xs sm:text-sm ml-2">
                    ({restaurants.length})
                  </span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
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
        <div className="fixed bottom-4 left-3 right-3 sm:left-4 sm:right-4 md:hidden z-50 pb-safe">
          <Button
            className="w-full h-14 shadow-lg gap-2 text-sm sm:text-base touch-manipulation"
            onClick={() => setIsCartOpen(true)}
            data-testid="button-floating-cart"
          >
            <ShoppingCart className="h-5 w-5 flex-shrink-0" />
            <span className="truncate">View Cart ({cartItemCount})</span>
            <span className="ml-auto font-bold flex-shrink-0">${cartTotals.total.toFixed(2)}</span>
          </Button>
        </div>
      )}

      {/* Cart Drawer */}
      <CartDrawer open={isCartOpen} onOpenChange={setIsCartOpen} />
    </div>
  );
}
