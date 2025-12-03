import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Clock, Filter, Search, RefreshCw, UtensilsCrossed, Heart } from "lucide-react";
import { CustomerHomeButton } from "./EatsNavigation";
import { CustomerBackButton } from "./CustomerBackButton";
import { RestaurantListMobile } from "./RestaurantListMobile";
import { RestaurantGridDesktop } from "./RestaurantGridDesktop";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
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
import type { Restaurant } from "./RestaurantCardVariants";

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

interface CustomerEatsHomeProps {
  onBack?: () => void;
}

export function CustomerEatsHome({ onBack }: CustomerEatsHomeProps) {
  const [sortBy, setSortBy] = useState<string>("name");
  const [cuisineType, setCuisineType] = useState<string>("all");
  const [openNow, setOpenNow] = useState<boolean>(false);
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const { toast } = useToast();
  const { user, token } = useAuth();
  const isMobile = useIsMobile();
  
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
          <CustomerBackButton
            fallbackRoute="/customer"
            fallbackTab="eats"
            onBack={() => {
              if (onBack) {
                onBack();
                return true;
              }
              return false;
            }}
          />
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

      <div className="flex-1 overflow-y-auto">
        {isMobile ? (
          <RestaurantListMobile
            restaurants={filteredRestaurants}
            isLoading={isLoading}
            isLoggedIn={isLoggedIn}
            onToggleFavorite={(restaurantId, isFavorite) => 
              toggleFavorite.mutate({ restaurantId, isFavorite })
            }
            onClearFilters={() => {
              setSearchQuery("");
              setCuisineType("all");
              setOpenNow(false);
            }}
            hasActiveFilters={!!searchQuery || cuisineType !== "all" || openNow}
          />
        ) : (
          <RestaurantGridDesktop
            restaurants={filteredRestaurants}
            isLoading={isLoading}
            isLoggedIn={isLoggedIn}
            onToggleFavorite={(restaurantId, isFavorite) => 
              toggleFavorite.mutate({ restaurantId, isFavorite })
            }
            onClearFilters={() => {
              setSearchQuery("");
              setCuisineType("all");
              setOpenNow(false);
            }}
            hasActiveFilters={!!searchQuery || cuisineType !== "all" || openNow}
          />
        )}
      </div>
    </div>
  );
}
