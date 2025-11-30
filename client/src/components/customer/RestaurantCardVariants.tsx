import { Link } from "wouter";
import { Star, MapPin, Heart, ChevronRight, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface Restaurant {
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

interface RestaurantCardBaseProps {
  restaurant: Restaurant;
  isLoggedIn: boolean;
  onToggleFavorite?: (restaurantId: string, isFavorite: boolean) => void;
}

function RestaurantLogo({ 
  restaurant, 
  className = "h-20 w-20" 
}: { 
  restaurant: Restaurant; 
  className?: string;
}) {
  return (
    <div 
      className={`${className} rounded-lg flex-shrink-0 flex items-center justify-center text-white font-bold text-xl bg-primary`}
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
  );
}

function FavoriteButton({
  restaurant,
  isLoggedIn,
  onToggleFavorite,
  className = "",
}: {
  restaurant: Restaurant;
  isLoggedIn: boolean;
  onToggleFavorite?: (restaurantId: string, isFavorite: boolean) => void;
  className?: string;
}) {
  if (!isLoggedIn || !onToggleFavorite) return null;
  
  return (
    <Button
      variant="ghost"
      size="icon"
      className={`flex-shrink-0 h-8 w-8 ${className}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggleFavorite(restaurant.id, restaurant.isFavorite);
      }}
      data-testid={`button-favorite-${restaurant.id}`}
      aria-label={restaurant.isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart 
        className={`h-4 w-4 ${restaurant.isFavorite ? 'fill-red-500 text-red-500' : ''}`} 
      />
    </Button>
  );
}

function RatingBadge({ restaurant }: { restaurant: Restaurant }) {
  return (
    <div className="flex items-center gap-1">
      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
      <span className="font-medium">{restaurant.averageRating.toFixed(1)}</span>
      <span className="text-muted-foreground">({restaurant.totalRatings})</span>
    </div>
  );
}

function OpenStatusBadge({ isOpen }: { isOpen: boolean }) {
  return (
    <Badge 
      variant={isOpen ? "default" : "secondary"}
      className="text-xs"
    >
      {isOpen ? "Open" : "Closed"}
    </Badge>
  );
}

export function RestaurantCardList({ 
  restaurant, 
  isLoggedIn, 
  onToggleFavorite 
}: RestaurantCardBaseProps) {
  return (
    <Link href={`/customer/food/${restaurant.id}`}>
      <Card 
        className="overflow-hidden hover-elevate cursor-pointer transition-all w-full"
        data-testid={`card-restaurant-list-${restaurant.id}`}
      >
        <CardContent className="p-4">
          <div className="flex gap-4">
            <RestaurantLogo restaurant={restaurant} className="h-20 w-20" />

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 
                    className="font-semibold text-base truncate" 
                    data-testid={`text-restaurant-name-${restaurant.id}`}
                  >
                    {restaurant.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">{restaurant.cuisineType}</p>
                </div>
                <FavoriteButton 
                  restaurant={restaurant} 
                  isLoggedIn={isLoggedIn} 
                  onToggleFavorite={onToggleFavorite} 
                />
              </div>

              <div className="flex items-center gap-3 mt-2 text-sm flex-wrap">
                <RatingBadge restaurant={restaurant} />
                <OpenStatusBadge isOpen={restaurant.isOpen} />
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
  );
}

export function RestaurantCardGrid({ 
  restaurant, 
  isLoggedIn, 
  onToggleFavorite 
}: RestaurantCardBaseProps) {
  return (
    <Link href={`/customer/food/${restaurant.id}`}>
      <Card 
        className="overflow-hidden hover-elevate cursor-pointer transition-all h-full"
        data-testid={`card-restaurant-grid-${restaurant.id}`}
      >
        <div className="relative aspect-[4/3] bg-muted">
          {restaurant.logoUrl ? (
            <img 
              src={restaurant.logoUrl} 
              alt={restaurant.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-primary text-white text-4xl font-bold">
              {restaurant.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="absolute top-2 right-2">
            <FavoriteButton 
              restaurant={restaurant} 
              isLoggedIn={isLoggedIn} 
              onToggleFavorite={onToggleFavorite}
              className="bg-background/80 backdrop-blur-sm"
            />
          </div>
          <div className="absolute bottom-2 left-2">
            <OpenStatusBadge isOpen={restaurant.isOpen} />
          </div>
        </div>
        <CardContent className="p-3">
          <h3 
            className="font-semibold text-sm truncate mb-1" 
            data-testid={`text-restaurant-name-grid-${restaurant.id}`}
          >
            {restaurant.name}
          </h3>
          <p className="text-xs text-muted-foreground mb-2">{restaurant.cuisineType}</p>
          
          <div className="flex items-center justify-between gap-2 text-xs">
            <RatingBadge restaurant={restaurant} />
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span className="truncate max-w-[80px]">{restaurant.cityCode}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function RestaurantCardSkeleton({ variant = "list" }: { variant?: "list" | "grid" }) {
  if (variant === "grid") {
    return (
      <Card className="overflow-hidden">
        <div className="aspect-[4/3] bg-muted animate-pulse" />
        <CardContent className="p-3 space-y-2">
          <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
          <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
          <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div className="h-20 w-20 rounded-lg flex-shrink-0 bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-muted rounded animate-pulse w-3/4" />
            <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
            <div className="h-4 bg-muted rounded animate-pulse w-1/3" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
