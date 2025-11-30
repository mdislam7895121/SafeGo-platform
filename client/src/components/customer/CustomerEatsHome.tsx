import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Star, MapPin, Heart, Clock, Filter, Search, ChevronRight, RefreshCw, UtensilsCrossed } from "lucide-react";
import { CustomerHomeButton } from "./EatsNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface Restaurant {
  id: string;
  name: string;
  cuisineType: string;
  cityCode: string;
  averageRating: number;
  totalRatings: number;
  logoUrl: string | null;
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

export function CustomerEatsHome() {
  const [sortBy, setSortBy] = useState<string>("name");
  const [cuisineType, setCuisineType] = useState<string>("all");
  const [openNow, setOpenNow] = useState<boolean>(false);
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const { toast } = useToast();
  const { user, token } = useAuth();
  
  const isLoggedIn = !!user && !!token && user.role === "customer";

  const buildQueryParams = () => {
    const params = new URLSearchParams({ sortBy });
    if (cuisineType !== "all") {
      params.set("cuisineType", cuisineType);
    }
    if (openNow) {
      params.set("openNow", "true");
    }
    if (favoritesOnly && isLoggedIn) {
      params.set("favoritesOnly", "true");
    }
    return params;
  };

  const { data, isLoading, error, refetch } = useQuery<RestaurantsResponse>({
    queryKey: ['/api/eats/restaurants', sortBy, cuisineType, openNow, favoritesOnly, isLoggedIn, searchQuery],
    queryFn: async () => {
      const queryParams = buildQueryParams();
      
      if (isLoggedIn && token) {
        const authRes = await fetch('/api/customer/food/restaurants?' + queryParams.toString(), {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (authRes.ok) {
          const data = await authRes.json();
          return data;
        } else if (authRes.status !== 401 && authRes.status !== 403) {
          const errData = await authRes.json().catch(() => ({ error: 'Failed to fetch' }));
          throw new Error(errData.error || 'Failed to fetch restaurants');
        }
      }
      
      if (searchQuery) {
        queryParams.set("search", searchQuery);
      }
      const res = await fetch(`/api/eats/restaurants?${queryParams.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Failed to fetch' }));
        throw new Error(errData.error || 'Failed to fetch restaurants');
      }
      return await res.json();
    },
    retry: 2,
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
  
  const filteredRestaurants = searchQuery
    ? restaurants.filter(r => 
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.cuisineType.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : restaurants;

  const lastErrorRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (error && !isLoading) {
      const errorMessage = (error as Error)?.message || "Failed to load restaurants";
      if (lastErrorRef.current !== errorMessage) {
        lastErrorRef.current = errorMessage;
        toast({
          title: "Unable to Load Restaurants",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } else {
      lastErrorRef.current = null;
    }
  }, [error, isLoading, toast]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-1 bg-background">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">SafeGo Eats</h1>
        </div>
        <CustomerHomeButton variant="ghost" size="sm" />
      </div>
      <div className="px-4 pb-3 pt-2 space-y-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search restaurants or cuisines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-restaurants"
          />
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={cuisineType} onValueChange={setCuisineType}>
            <SelectTrigger className="w-[140px]" data-testid="select-cuisine">
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

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[130px]" data-testid="select-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name (A-Z)</SelectItem>
              <SelectItem value="rating">Highest Rated</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Switch
              id="open-now-inline"
              checked={openNow}
              onCheckedChange={setOpenNow}
              data-testid="switch-open-now"
            />
            <Label htmlFor="open-now-inline" className="flex items-center gap-1 cursor-pointer text-sm">
              <Clock className="h-3 w-3" />
              Open
            </Label>
          </div>

          {isLoggedIn && (
            <div className="flex items-center gap-2">
              <Switch
                id="favorites-inline"
                checked={favoritesOnly}
                onCheckedChange={setFavoritesOnly}
                data-testid="switch-favorites"
              />
              <Label htmlFor="favorites-inline" className="flex items-center gap-1 cursor-pointer text-sm">
                <Heart className="h-3 w-3" />
                Favorites
              </Label>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <Skeleton className="h-20 w-20 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredRestaurants.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg mb-2">
              No restaurants available in your area yet
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              We're working on bringing more restaurants to you soon!
            </p>
            {(searchQuery || cuisineType !== "all" || openNow) && (
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchQuery("");
                  setCuisineType("all");
                  setOpenNow(false);
                }}
                className="gap-2"
                data-testid="button-clear-filters"
              >
                <RefreshCw className="h-4 w-4" />
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          filteredRestaurants.map((restaurant) => (
            <Link 
              key={restaurant.id} 
              href={`/customer/food/${restaurant.id}`}
            >
              <Card 
                className="overflow-hidden hover-elevate cursor-pointer transition-all"
                data-testid={`card-restaurant-${restaurant.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div 
                      className="h-20 w-20 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-bold text-xl bg-primary"
                    >
                      {restaurant.logoUrl ? (
                        <img 
                          src={restaurant.logoUrl} 
                          alt={restaurant.name}
                          className="h-full w-full object-cover rounded-lg"
                        />
                      ) : (
                        restaurant.name.charAt(0).toUpperCase()
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-base truncate" data-testid={`text-restaurant-name-${restaurant.id}`}>
                            {restaurant.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">{restaurant.cuisineType}</p>
                        </div>
                        {isLoggedIn && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="flex-shrink-0 h-8 w-8"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleFavorite.mutate({ 
                                restaurantId: restaurant.id, 
                                isFavorite: restaurant.isFavorite 
                              });
                            }}
                            data-testid={`button-favorite-${restaurant.id}`}
                          >
                            <Heart 
                              className={`h-4 w-4 ${restaurant.isFavorite ? 'fill-red-500 text-red-500' : ''}`} 
                            />
                          </Button>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-2 text-sm">
                        <div className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">{restaurant.averageRating.toFixed(1)}</span>
                          <span className="text-muted-foreground">({restaurant.totalRatings})</span>
                        </div>
                        
                        <Badge 
                          variant={restaurant.isOpen ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {restaurant.isOpen ? "Open" : "Closed"}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{restaurant.cityCode}</span>
                      </div>
                    </div>

                    <ChevronRight className="h-5 w-5 text-muted-foreground self-center flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
