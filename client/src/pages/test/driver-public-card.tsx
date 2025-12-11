import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { DriverPreviewCard } from "@/components/DriverPreviewCard";

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

export default function TestDriverPublicCard() {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const driverId = params.get("id");

  const { data: profile, isLoading, error } = useQuery<DriverPublicProfile>({
    queryKey: [`/api/driver/public-profile/${driverId}`],
    enabled: !!driverId,
  });

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Driver Public Profile Card Test</h1>
            <p className="text-sm text-muted-foreground">
              Test page for D2 Driver Public Profile implementation
            </p>
          </div>
        </div>

        {!driverId && (
          <Card className="p-6">
            <h2 className="font-semibold mb-2">No Driver ID Provided</h2>
            <p className="text-sm text-muted-foreground">
              Please add a driver ID to the URL: <code>?id=DRIVER_ID</code>
            </p>
          </Card>
        )}

        {driverId && isLoading && (
          <Card className="p-6">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm text-muted-foreground">Loading driver profile...</span>
            </div>
          </Card>
        )}

        {driverId && error && (
          <Card className="p-6">
            <h2 className="font-semibold text-destructive mb-2">Error Loading Profile</h2>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Failed to fetch driver profile"}
            </p>
          </Card>
        )}

        {driverId && profile && (
          <div className="space-y-4">
            <DriverPreviewCard profile={profile} />
            
            <Card className="p-6">
              <h2 className="font-semibold mb-4">Raw Profile Data</h2>
              <pre className="text-xs bg-muted p-4 rounded-md overflow-auto">
                {JSON.stringify(profile, null, 2)}
              </pre>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
