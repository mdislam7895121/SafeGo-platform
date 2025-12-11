import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  RestaurantCardList, 
  RestaurantCardSkeleton,
  type Restaurant 
} from "./RestaurantCardVariants";

interface RestaurantListMobileProps {
  restaurants: Restaurant[];
  isLoading: boolean;
  isLoggedIn: boolean;
  onToggleFavorite?: (restaurantId: string, isFavorite: boolean) => void;
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
}

export function RestaurantListMobile({
  restaurants,
  isLoading,
  isLoggedIn,
  onToggleFavorite,
  onClearFilters,
  hasActiveFilters = false,
}: RestaurantListMobileProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <RestaurantCardSkeleton key={i} variant="list" />
        ))}
      </div>
    );
  }

  if (restaurants.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <p className="text-muted-foreground text-lg mb-2">
          No restaurants available in your area yet
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          We're working on bringing more restaurants to you soon!
        </p>
        {hasActiveFilters && onClearFilters && (
          <Button 
            variant="outline" 
            onClick={onClearFilters}
            className="gap-2"
            data-testid="button-clear-filters-mobile"
          >
            <RefreshCw className="h-4 w-4" />
            Clear Filters
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4" data-testid="restaurant-list-mobile">
      {restaurants.map((restaurant) => (
        <RestaurantCardList
          key={restaurant.id}
          restaurant={restaurant}
          isLoggedIn={isLoggedIn}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}
