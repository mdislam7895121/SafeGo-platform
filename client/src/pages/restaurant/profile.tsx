import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, UtensilsCrossed, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function RestaurantProfile() {
  const { data: restaurantData, isLoading } = useQuery({
    queryKey: ["/api/restaurant/home"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const profile = (restaurantData as any)?.profile;

  return (
    <div className="space-y-6">
        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5" />
              Restaurant Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium" data-testid="text-email">{profile?.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Restaurant Name</p>
              <p className="font-medium" data-testid="text-restaurant-name">{profile?.restaurantName || "Not set"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Country</p>
              <p className="font-medium" data-testid="text-country">
                {profile?.countryCode === "BD" ? "🇧🇩 Bangladesh" : "🇺🇸 United States"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Verification Status</p>
              <Badge variant={profile?.isVerified ? "default" : "secondary"} data-testid="badge-verification">
                {profile?.verificationStatus || "pending"}
              </Badge>
            </div>
            {profile?.rejectionReason && (
              <div className="bg-destructive/10 p-3 rounded-lg">
                <p className="text-sm text-destructive font-medium">Rejection Reason:</p>
                <p className="text-sm">{profile.rejectionReason}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Business Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Business Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile?.cuisine && (
              <div>
                <p className="text-sm text-muted-foreground">Cuisine Type</p>
                <p className="font-medium">{profile.cuisine}</p>
              </div>
            )}
            {profile?.address && (
              <div>
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="font-medium">{profile.address}</p>
              </div>
            )}
            {profile?.phone && (
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{profile.phone}</p>
              </div>
            )}
            {profile?.ownerName && (
              <div>
                <p className="text-sm text-muted-foreground">Owner Name</p>
                <p className="font-medium">{profile.ownerName}</p>
              </div>
            )}
            {!profile?.isVerified && (
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Your restaurant is pending verification. Please wait for admin approval.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
