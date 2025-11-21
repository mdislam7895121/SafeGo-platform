import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Star, MapPin, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Restaurant {
  id: string;
  name: string;
  cuisineType: string;
  description: string;
  address: string;
  cityCode: string;
  averageRating: number;
  totalRatings: number;
}

interface RestaurantsResponse {
  restaurants: Restaurant[];
  count: number;
}

export default function FoodRestaurants() {
  const [sortBy, setSortBy] = useState<string>("name");

  const { data, isLoading, error } = useQuery<RestaurantsResponse>({
    queryKey: [`/api/customer/food/restaurants?sortBy=${sortBy}`],
    retry: 1,
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
      <div className="p-6 bg-background sticky top-[120px] z-10 border-b">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Sort By</label>
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
          restaurants.map((restaurant) => (
            <Link key={restaurant.id} href={`/customer/food/${restaurant.id}`}>
              <Card
                className="hover-elevate active-elevate-2 cursor-pointer transition-all"
                data-testid={`card-restaurant-${restaurant.id}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1" data-testid={`text-restaurant-name-${restaurant.id}`}>
                        {restaurant.name}
                      </h3>
                      <Badge variant="secondary" className="text-xs" data-testid={`badge-cuisine-${restaurant.id}`}>
                        {restaurant.cuisineType}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                      <span className="font-medium" data-testid={`text-rating-${restaurant.id}`}>
                        {restaurant.averageRating.toFixed(1)}
                      </span>
                      <span className="text-muted-foreground">({restaurant.totalRatings})</span>
                    </div>
                  </div>

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
                </CardContent>
              </Card>
            </Link>
          ))
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
