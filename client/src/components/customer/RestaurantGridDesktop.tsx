import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  RestaurantCardGrid, 
  RestaurantCardSkeleton,
  type Restaurant 
} from "./RestaurantCardVariants";

interface RestaurantGridDesktopProps {
  restaurants: Restaurant[];
  isLoading: boolean;
  isLoggedIn: boolean;
  onToggleFavorite?: (restaurantId: string, isFavorite: boolean) => void;
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
}

interface CarouselSectionProps {
  title: string;
  restaurants: Restaurant[];
  isLoggedIn: boolean;
  onToggleFavorite?: (restaurantId: string, isFavorite: boolean) => void;
  testIdPrefix: string;
}

function CarouselSection({ 
  title, 
  restaurants, 
  isLoggedIn, 
  onToggleFavorite,
  testIdPrefix 
}: CarouselSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    const ref = scrollRef.current;
    if (ref) {
      ref.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
    }
    return () => {
      if (ref) {
        ref.removeEventListener('scroll', checkScroll);
      }
      window.removeEventListener('resize', checkScroll);
    };
  }, [restaurants]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (restaurants.length === 0) return null;

  return (
    <div className="space-y-3" data-testid={`${testIdPrefix}-section`}>
      <div className="flex items-center justify-between px-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            data-testid={`${testIdPrefix}-scroll-left`}
            aria-label={`Scroll ${title} left`}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            data-testid={`${testIdPrefix}-scroll-right`}
            aria-label={`Scroll ${title} right`}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div 
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto px-4 pb-2 scrollbar-hide snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {restaurants.map((restaurant) => (
          <div 
            key={restaurant.id} 
            className="flex-shrink-0 w-[200px] lg:w-[220px] snap-start"
          >
            <RestaurantCardGrid
              restaurant={restaurant}
              isLoggedIn={isLoggedIn}
              onToggleFavorite={onToggleFavorite}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function RestaurantGridDesktop({
  restaurants,
  isLoading,
  isLoggedIn,
  onToggleFavorite,
  onClearFilters,
  hasActiveFilters = false,
}: RestaurantGridDesktopProps) {
  if (isLoading) {
    return (
      <div className="space-y-6 p-4">
        <div className="space-y-3">
          <div className="h-6 bg-muted rounded animate-pulse w-40 mx-4" />
          <div className="flex gap-4 px-4 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[200px] lg:w-[220px]">
                <RestaurantCardSkeleton variant="grid" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-6 bg-muted rounded animate-pulse w-32 mx-4" />
          <div className="flex gap-4 px-4 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[200px] lg:w-[220px]">
                <RestaurantCardSkeleton variant="grid" />
              </div>
            ))}
          </div>
        </div>
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
            data-testid="button-clear-filters-desktop"
          >
            <RefreshCw className="h-4 w-4" />
            Clear Filters
          </Button>
        )}
      </div>
    );
  }

  const sortedByRating = [...restaurants].sort((a, b) => b.averageRating - a.averageRating);
  const topRated = sortedByRating.slice(0, 8);
  const popularNearYou = restaurants.slice(0, 8);

  return (
    <div className="space-y-6 py-4" data-testid="restaurant-grid-desktop">
      <CarouselSection
        title="Popular Near You"
        restaurants={popularNearYou}
        isLoggedIn={isLoggedIn}
        onToggleFavorite={onToggleFavorite}
        testIdPrefix="carousel-popular"
      />
      
      <CarouselSection
        title="Top Rated"
        restaurants={topRated}
        isLoggedIn={isLoggedIn}
        onToggleFavorite={onToggleFavorite}
        testIdPrefix="carousel-top-rated"
      />

      <div className="px-4 pt-4">
        <h2 className="text-lg font-semibold mb-4">All Restaurants</h2>
        <div 
          className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          data-testid="restaurant-grid-all"
        >
          {restaurants.map((restaurant) => (
            <RestaurantCardGrid
              key={restaurant.id}
              restaurant={restaurant}
              isLoggedIn={isLoggedIn}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
