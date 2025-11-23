import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Star, MapPin, UtensilsCrossed, Plus, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import GalleryModal from "@/components/customer/GalleryModal";

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string | null;
  isAvailable: boolean;
}

interface MenuCategory {
  id: string;
  name: string;
  description: string;
  items: MenuItem[];
}

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

interface RestaurantResponse {
  restaurant: Restaurant;
}

interface MenuResponse {
  restaurantId: string;
  restaurantName: string;
  categories: MenuCategory[];
  totalCategories: number;
  totalItems: number;
}

interface MediaItem {
  id: string;
  url: string;
  type: string;
  category: string;
  displayOrder: number;
}

interface BrandingResponse {
  branding: {
    logoUrl: string | null;
    coverPhotoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    themeMode: string;
  };
  media: MediaItem[];
}

export default function FoodRestaurantDetails() {
  const { id } = useParams() as { id: string };
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryStartIndex, setGalleryStartIndex] = useState(0);

  const { data: restaurantData, isLoading: restaurantLoading, error: restaurantError } = useQuery<RestaurantResponse>({
    queryKey: [`/api/customer/food/restaurants/${id}`],
    retry: 1,
  });

  const { data: menuData, isLoading: menuLoading, error: menuError } = useQuery<MenuResponse>({
    queryKey: [`/api/customer/food/restaurants/${id}/menu`],
    retry: 1,
  });

  const { data: brandingData, isLoading: brandingLoading } = useQuery<BrandingResponse>({
    queryKey: [`/api/customer/food/restaurants/${id}/branding`],
    retry: 1,
  });

  const restaurant = restaurantData?.restaurant;
  const categories = menuData?.categories || [];
  const branding = brandingData?.branding;
  const media = brandingData?.media || [];
  const isLoading = restaurantLoading || menuLoading;
  const error = restaurantError || menuError;

  // Get theme colors with fallback
  const headerBgColor = branding?.primaryColor || undefined;
  const headerStyle = headerBgColor ? { backgroundColor: headerBgColor } : {};

  const openGallery = (index: number = 0) => {
    setGalleryStartIndex(index);
    setIsGalleryOpen(true);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
          <div className="flex items-center gap-4">
            <Link href="/customer/food">
              <Button variant="ghost" size="icon" className="text-primary-foreground" data-testid="button-back">
                <ArrowLeft className="h-6 w-6" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Restaurant</h1>
          </div>
        </header>

        <div className="p-6">
          <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
            <CardContent className="p-6">
              <h3 className="font-semibold text-red-900 dark:text-red-200">Error</h3>
              <p className="text-sm text-red-800 dark:text-red-300 mt-2">
                {(error as any)?.message || "Failed to load restaurant details"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Cover Photo Banner */}
      {branding?.coverPhotoUrl && (
        <div className="relative h-48 md:h-64 overflow-hidden">
          <img
            src={branding.coverPhotoUrl}
            alt="Restaurant cover"
            className="w-full h-full object-cover"
            data-testid="img-cover-photo"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent" />
          
          {/* Back button overlay */}
          <div className="absolute top-4 left-4">
            <Link href="/customer/food">
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white bg-black/30 hover:bg-black/50"
                data-testid="button-back"
              >
                <ArrowLeft className="h-6 w-6" />
              </Button>
            </Link>
          </div>

          {/* Logo overlay */}
          {branding.logoUrl && (
            <div className="absolute bottom-0 left-6 transform translate-y-1/2">
              <div className="h-24 w-24 md:h-32 md:w-32 rounded-xl overflow-hidden border-4 border-background bg-background shadow-lg">
                <img
                  src={branding.logoUrl}
                  alt="Restaurant logo"
                  className="w-full h-full object-cover"
                  data-testid="img-logo"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Header (shown when no cover photo) */}
      {!branding?.coverPhotoUrl && (
        <header 
          className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg sticky top-0 z-10"
          style={headerStyle}
        >
          <div className="flex items-center gap-4">
            <Link href="/customer/food">
              <Button variant="ghost" size="icon" className="text-primary-foreground" data-testid="button-back">
                <ArrowLeft className="h-6 w-6" />
              </Button>
            </Link>
            <div className="flex-1 flex items-center gap-3">
              {branding?.logoUrl && (
                <div className="h-12 w-12 rounded-lg overflow-hidden border-2 border-primary-foreground/20">
                  <img
                    src={branding.logoUrl}
                    alt="Restaurant logo"
                    className="w-full h-full object-cover"
                    data-testid="img-logo"
                  />
                </div>
              )}
              {isLoading ? (
                <Skeleton className="h-8 w-48 bg-primary-foreground/20" />
              ) : (
                <div>
                  <h1 className="text-2xl font-bold" data-testid="text-restaurant-name">
                    {restaurant?.name}
                  </h1>
                  <p className="text-sm opacity-90">{restaurant?.cuisineType}</p>
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Restaurant Info Card */}
      <div className={`p-6 ${branding?.coverPhotoUrl && branding?.logoUrl ? 'mt-14' : ''}`}>
        {restaurantLoading ? (
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-3/4 mb-3" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ) : restaurant ? (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  {branding?.coverPhotoUrl && (
                    <h2 className="text-2xl font-bold mb-2" data-testid="text-restaurant-name">
                      {restaurant.name}
                    </h2>
                  )}
                  <Badge variant="secondary" className="mb-2">{restaurant.cuisineType}</Badge>
                  {restaurant.description && (
                    <p className="text-sm text-muted-foreground">{restaurant.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                  <span className="font-semibold" data-testid="text-rating">
                    {restaurant.averageRating.toFixed(1)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    ({restaurant.totalRatings})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{restaurant.address}</span>
                {restaurant.cityCode !== "Nationwide" && (
                  <Badge variant="outline" className="text-xs ml-auto">
                    {restaurant.cityCode}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Gallery Section */}
      {!brandingLoading && media.length > 0 && (
        <div className="px-6 pb-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Gallery ({media.length} photos)
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openGallery(0)}
                  data-testid="button-view-all-photos"
                >
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {media.slice(0, 12).map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => openGallery(idx)}
                    className="aspect-square rounded-lg overflow-hidden hover-elevate active-elevate-2"
                    data-testid={`button-gallery-${idx}`}
                  >
                    <img
                      src={item.url}
                      alt={`Gallery ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
                {media.length > 12 && (
                  <button
                    onClick={() => openGallery(12)}
                    className="aspect-square rounded-lg bg-muted flex items-center justify-center hover-elevate active-elevate-2"
                    data-testid="button-view-more"
                  >
                    <div className="text-center">
                      <p className="font-semibold">+{media.length - 12}</p>
                      <p className="text-xs text-muted-foreground">more</p>
                    </div>
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Menu Section */}
      <div className="px-6 pb-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">Menu</h2>
          {menuLoading ? (
            <Skeleton className="h-4 w-32" />
          ) : (
            <p className="text-sm text-muted-foreground">
              {menuData?.totalCategories} categories • {menuData?.totalItems} items
            </p>
          )}
        </div>

        {menuLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full mb-3" />
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))
        ) : categories.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <UtensilsCrossed className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">No Menu Available</h3>
              <p className="text-sm text-muted-foreground">
                This restaurant hasn't added their menu yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          categories.map((category) => (
            <Card key={category.id} data-testid={`card-category-${category.id}`}>
              <CardHeader>
                <CardTitle className="text-lg" data-testid={`text-category-name-${category.id}`}>
                  {category.name}
                </CardTitle>
                {category.description && (
                  <p className="text-sm text-muted-foreground">{category.description}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {category.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-4 pb-4 border-b last:border-0 last:pb-0"
                    data-testid={`item-${item.id}`}
                  >
                    {item.imageUrl && (
                      <div className="flex-shrink-0">
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="h-20 w-20 rounded-lg object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-medium" data-testid={`text-item-name-${item.id}`}>
                          {item.name}
                        </h4>
                        {!item.isAvailable && (
                          <Badge variant="destructive" className="text-xs">
                            Out of Stock
                          </Badge>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-lg" data-testid={`text-item-price-${item.id}`}>
                          ${item.price.toFixed(2)}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled
                          className="gap-2"
                          data-testid={`button-add-cart-${item.id}`}
                        >
                          <Plus className="h-4 w-4" />
                          Add to Cart
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Coming Soon Notice */}
      {!isLoading && categories.length > 0 && (
        <div className="px-6 pb-6">
          <Card className="bg-muted/50">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Cart and checkout coming soon! Browse our menu and check back later to place your order.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gallery Modal */}
      <GalleryModal
        media={media}
        initialIndex={galleryStartIndex}
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
      />
    </div>
  );
}
