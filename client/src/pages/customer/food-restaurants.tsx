import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Star, MapPin, UtensilsCrossed, Heart, Clock, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Restaurant {
  id: string;
  name: string;
  cuisineType: string;
  description: string;
  address: string;
  cityCode: string;
  averageRating: number;
  totalRatings: number;
  logoUrl: string | null;
  primaryColor: string | null;
  isOpen: boolean;
  isFavorite: boolean;
}

interface RestaurantsResponse {
  restaurants: Restaurant[];
  count: number;
}

const CUISINE_TYPES = [
  { value: "all", label: "All Cuisines" },
  { value: "American", label: "American" },
  { value: "Chinese", label: "Chinese" },
  { value: "Indian", label: "Indian" },
  { value: "Italian", label: "Italian" },
  { value: "Japanese", label: "Japanese" },
  { value: "Mexican", label: "Mexican" },
  { value: "Thai", label: "Thai" },
  { value: "Mediterranean", label: "Mediterranean" },
  { value: "Fast Food", label: "Fast Food" },
  { value: "Healthy", label: "Healthy" },
  { value: "Desserts", label: "Desserts" },
];

export default function FoodRestaurants() {
  const [sortBy, setSortBy] = useState<string>("name");
  const [cuisineType, setCuisineType] = useState<string>("all");
  const [openNow, setOpenNow] = useState<boolean>(false);
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(false);
  const { toast } = useToast();

  // Build query params
  const queryParams = new URLSearchParams({ sortBy });
  if (cuisineType !== "all") {
    queryParams.set("cuisineType", cuisineType);
  }
  if (openNow) {
    queryParams.set("openNow", "true");
  }
  if (favoritesOnly) {
    queryParams.set("favoritesOnly", "true");
  }

  const { data, isLoading, error } = useQuery<RestaurantsResponse>({
    queryKey: ['/api/customer/food/restaurants', sortBy, cuisineType, openNow, favoritesOnly],
    queryFn: async () => {
      return apiRequest(`/api/customer/food/restaurants?${queryParams.toString()}`);
    },
    retry: 1,
  });

  // Favorites toggle mutation
  const toggleFavorite = useMutation({
    mutationFn: async ({ restaurantId, isFavorite }: { restaurantId: string; isFavorite: boolean }) => {
      const method = isFavorite ? 'DELETE' : 'POST';
      return apiRequest(`/api/customer/food/restaurants/${restaurantId}/favorite`, { method });
    },
    onSuccess: (_data, { isFavorite }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer/food/restaurants'] });
      toast({
        title: isFavorite ? "Removed from favorites" : "Added to favorites",
        description: isFavorite 
          ? "Restaurant removed from your favorites" 
          : "Restaurant added to your favorites",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update favorite",
        variant: "destructive",
      });
    },
  });

  const restaurants = data?.restaurants || [];

  if (error) {
    const errorMessage = (error as any)?.message || "Failed to load restaurants";
    const requiresVerification = (error as any)?.response?.data?.requiresVerification;

    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <Link href="/customer/home">
              <Button variant="ghost" size="icon" className="text-primary-foreground" data-testid="button-back">
                <ArrowLeft className="h-6 w-6" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Order Food</h1>
              <p className="text-sm opacity-90">Choose from top restaurants</p>
            </div>
          </div>
        </header>

        <div className="p-6">
          <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
            <CardContent className="p-6">
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-200">
                {requiresVerification ? "Verification Required" : "Error"}
              </h3>
              <p className="text-sm text-yellow-800 dark:text-yellow-300 mt-2">
                {requiresVerification
                  ? "You must complete KYC verification to order food."
                  : errorMessage}
              </p>
              {requiresVerification && (
                <Link href="/customer/profile/kyc">
                  <Button variant="outline" size="sm" className="mt-3" data-testid="button-complete-kyc">
                    Complete Verification
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/customer/home">
            <Button variant="ghost" size="icon" className="text-primary-foreground" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Order Food</h1>
            <p className="text-sm opacity-90">Choose from top restaurants</p>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="p-4 bg-background sticky top-[120px] z-10 border-b space-y-4">
        {/* Primary filters row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[140px]">
            <Select value={cuisineType} onValueChange={setCuisineType}>
              <SelectTrigger data-testid="select-cuisine">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Cuisine" />
              </SelectTrigger>
              <SelectContent>
                {CUISINE_TYPES.map((cuisine) => (
                  <SelectItem key={cuisine.value} value={cuisine.value}>
                    {cuisine.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[120px]">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger data-testid="select-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name (A-Z)</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Toggle filters row */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch
              id="open-now"
              checked={openNow}
              onCheckedChange={setOpenNow}
              data-testid="switch-open-now"
            />
            <Label htmlFor="open-now" className="flex items-center gap-1 cursor-pointer">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Open Now</span>
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="favorites-only"
              checked={favoritesOnly}
              onCheckedChange={setFavoritesOnly}
              data-testid="switch-favorites"
            />
            <Label htmlFor="favorites-only" className="flex items-center gap-1 cursor-pointer">
              <Heart className="h-4 w-4" />
              <span className="text-sm">Favorites</span>
            </Label>
          </div>
        </div>
      </div>

      {/* Restaurant List */}
      <div className="p-6 space-y-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-3/4 mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))
        ) : restaurants.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <UtensilsCrossed className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">No Restaurants Available</h3>
              <p className="text-sm text-muted-foreground">
                There are no restaurants in your area yet. Check back soon!
              </p>
            </CardContent>
          </Card>
        ) : (
          restaurants.map((restaurant) => {
            // Apply custom accent if primary color exists
            const accentStyle = restaurant.primaryColor 
              ? { borderLeftColor: restaurant.primaryColor, borderLeftWidth: '4px' }
              : {};
            
            return (
              <Card
                key={restaurant.id}
                className="hover-elevate active-elevate-2 cursor-pointer transition-all"
                style={accentStyle}
                data-testid={`card-restaurant-${restaurant.id}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-3 mb-3">
                    {restaurant.logoUrl && (
                      <Link href={`/customer/food/${restaurant.id}`}>
                        <div className="flex-shrink-0 h-14 w-14 rounded-lg overflow-hidden border border-border">
                          <img
                            src={restaurant.logoUrl}
                            alt={`${restaurant.name} logo`}
                            className="w-full h-full object-cover"
                            data-testid={`img-logo-${restaurant.id}`}
                          />
                        </div>
                      </Link>
                    )}
                    <Link href={`/customer/food/${restaurant.id}`} className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg mb-1" data-testid={`text-restaurant-name-${restaurant.id}`}>
                        {restaurant.name}
                      </h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs" data-testid={`badge-cuisine-${restaurant.id}`}>
                          {restaurant.cuisineType}
                        </Badge>
                        {restaurant.isOpen ? (
                          <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700" data-testid={`badge-open-${restaurant.id}`}>
                            <Clock className="h-3 w-3 mr-1" />
                            Open
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground" data-testid={`badge-closed-${restaurant.id}`}>
                            <Clock className="h-3 w-3 mr-1" />
                            Closed
                          </Badge>
                        )}
                      </div>
                    </Link>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1 text-sm">
                        <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                        <span className="font-medium" data-testid={`text-rating-${restaurant.id}`}>
                          {restaurant.averageRating.toFixed(1)}
                        </span>
                        <span className="text-muted-foreground">({restaurant.totalRatings})</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-1"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleFavorite.mutate({ 
                            restaurantId: restaurant.id, 
                            isFavorite: restaurant.isFavorite 
                          });
                        }}
                        disabled={toggleFavorite.isPending}
                        data-testid={`button-favorite-${restaurant.id}`}
                      >
                        <Heart 
                          className={`h-5 w-5 transition-colors ${
                            restaurant.isFavorite 
                              ? 'fill-red-500 text-red-500' 
                              : 'text-muted-foreground hover:text-red-500'
                          }`} 
                        />
                      </Button>
                    </div>
                  </div>

                  <Link href={`/customer/food/${restaurant.id}`}>
                    {restaurant.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {restaurant.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span className="line-clamp-1">{restaurant.address}</span>
                      {restaurant.cityCode !== "Nationwide" && (
                        <Badge variant="outline" className="text-xs ml-auto">
                          {restaurant.cityCode}
                        </Badge>
                      )}
                    </div>
                  </Link>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Results Count */}
      {!isLoading && restaurants.length > 0 && (
        <div className="px-6 pb-6 text-center text-sm text-muted-foreground">
          Showing {restaurants.length} restaurant{restaurants.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
