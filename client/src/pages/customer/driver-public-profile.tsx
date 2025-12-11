import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DriverPreviewCard } from "@/components/DriverPreviewCard";
import { ArrowLeft } from "lucide-react";

type DriverPublicProfile = {
  name: string;
  pronouns: string | null;
  profilePhotoUrl: string | null;
  vehicle: {
    type: string;
    model: string;
    color: string;
    plateNumber: string;
  } | null;
  stats: {
    totalRides: number;
    rating: number;
    yearsActive: number;
  };
};

export default function DriverPublicProfile() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/customer/driver/:driver_profile_id");
  const driverProfileId = params?.driver_profile_id;

  // Fetch driver public profile
  const { data: driverProfile, isLoading, error } = useQuery<DriverPublicProfile>({
    queryKey: [`/api/driver/public-profile/${driverProfileId}`],
    enabled: !!driverProfileId,
  });

  if (!driverProfileId) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-6">
            <p className="text-muted-foreground">No driver profile ID provided</p>
            <Button onClick={() => setLocation("/customer")} className="mt-4" data-testid="button-home">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-12 w-full" />
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-24 w-24 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !driverProfile) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-6">
            <p className="text-destructive mb-2">Driver profile not found</p>
            <p className="text-sm text-muted-foreground mb-4">
              {error instanceof Error ? error.message : "Unable to load driver profile"}
            </p>
            <Button onClick={() => setLocation("/customer")} data-testid="button-home">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/customer")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Driver Profile</h1>
            <p className="text-sm text-muted-foreground">Public driver information</p>
          </div>
        </div>

        <DriverPreviewCard 
          profile={driverProfile} 
          show3DViewer={true}
          viewerHeight={250}
        />

        <Button
          onClick={() => setLocation("/customer")}
          variant="outline"
          className="w-full"
          data-testid="button-done"
        >
          Done
        </Button>
      </div>
    </div>
  );
}
