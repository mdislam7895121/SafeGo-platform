import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Ban, Star, Loader2, Store, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface BlockedRestaurant {
  id: string;
  restaurantId: string;
  restaurantName: string;
  cuisineType: string | null;
  averageRating: number | null;
  logoUrl: string | null;
  reason: string | null;
  blockedAt: string;
}

interface BlockedRestaurantsResponse {
  blockedRestaurants: BlockedRestaurant[];
}

export default function BlockedRestaurants() {
  const { toast } = useToast();

  const { data, isLoading } = useQuery<BlockedRestaurantsResponse>({
    queryKey: ["/api/customer/food/blocked-restaurants"],
    retry: 1,
  });

  const unblockMutation = useMutation({
    mutationFn: async (blockId: string) => {
      return apiRequest(`/api/customer/food/blocked-restaurants/${blockId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Restaurant unblocked",
        description: "You can now see this restaurant in your feed again.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/customer/food/blocked-restaurants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customer/food/restaurants"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to unblock",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const blockedRestaurants = data?.blockedRestaurants || [];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/customer/profile">
            <Button variant="ghost" size="icon" className="text-primary-foreground" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Blocked Restaurants</h1>
            <p className="text-sm opacity-90">Manage restaurants you've blocked</p>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-4 max-w-2xl mx-auto">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-1/2 mb-2" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                  <Skeleton className="h-9 w-24" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : blockedRestaurants.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Ban className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No blocked restaurants</h3>
              <p className="text-muted-foreground mb-6">
                You haven't blocked any restaurants yet. Restaurants you block won't appear in your feed.
              </p>
              <Link href="/customer/food">
                <Button data-testid="button-browse-restaurants">
                  Browse Restaurants
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          blockedRestaurants.map((restaurant) => (
            <Card key={restaurant.id} data-testid={`card-blocked-${restaurant.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    {restaurant.logoUrl ? (
                      <AvatarImage src={restaurant.logoUrl} alt={restaurant.restaurantName} />
                    ) : null}
                    <AvatarFallback className="bg-primary/10">
                      <Store className="h-6 w-6 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate" data-testid={`text-name-${restaurant.id}`}>
                      {restaurant.restaurantName}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {restaurant.cuisineType && (
                        <Badge variant="secondary" className="text-xs">
                          {restaurant.cuisineType}
                        </Badge>
                      )}
                      {restaurant.averageRating && (
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          {restaurant.averageRating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    {restaurant.reason && (
                      <p className="text-xs text-muted-foreground mt-1 truncate" data-testid={`text-reason-${restaurant.id}`}>
                        Reason: {restaurant.reason}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground" data-testid={`text-date-${restaurant.id}`}>
                      Blocked on {new Date(restaurant.blockedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={unblockMutation.isPending}
                        data-testid={`button-unblock-${restaurant.id}`}
                      >
                        {unblockMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Unlock className="h-4 w-4 mr-1" />
                            Unblock
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Unblock {restaurant.restaurantName}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This restaurant will appear in your feed again and you'll be able to order from them.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel data-testid="button-cancel-unblock">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => unblockMutation.mutate(restaurant.id)}
                          data-testid="button-confirm-unblock"
                        >
                          Yes, Unblock
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
