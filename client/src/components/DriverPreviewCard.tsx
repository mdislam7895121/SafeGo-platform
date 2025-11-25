import { Suspense, lazy, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Star, Car, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

const VehicleViewer = lazy(() => import("@/components/3d/VehicleViewer"));

export type DriverPublicProfile = {
  name: string;
  pronouns: string | null;
  profilePhotoUrl: string | null;
  vehicle: {
    type: string;
    make: string | null; // Vehicle brand/manufacturer
    model: string; // Can be "Brand Model" combined or just model
    color: string;
    plateNumber: string;
  } | null;
  stats: {
    totalRides: number;
    rating: number;
    yearsActive: number;
  };
};

interface DriverPreviewCardProps {
  profile: DriverPublicProfile;
  className?: string;
  show3DPreview?: boolean;
}

export function DriverPreviewCard({ 
  profile, 
  className = "",
  show3DPreview = true,
}: DriverPreviewCardProps) {
  const [show3D, setShow3D] = useState(show3DPreview);

  const formatRideCount = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k+`;
    }
    return count.toString();
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatYearsActive = (years: number) => {
    if (years < 1) {
      const months = Math.max(1, Math.round(years * 12));
      return `${months} ${months === 1 ? 'Month' : 'Months'}`;
    }
    return `${years.toFixed(1)} Years`;
  };

  return (
    <Card className={`overflow-hidden ${className}`} data-testid="card-driver-preview">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-green-600" />
          <span>Verified Driver</span>
        </div>
        <Badge variant="outline" className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400">
          <Star className="h-3 w-3 fill-current mr-1" />
          {profile.stats.rating.toFixed(1)}
        </Badge>
      </CardHeader>

      <CardContent className="p-6 pt-2 space-y-5">
        <div className="flex items-center gap-4">
          <Avatar className="h-24 w-24 border-4 border-primary/20 ring-2 ring-primary/10 shadow-lg" data-testid="avatar-driver">
            <AvatarImage src={profile.profilePhotoUrl || undefined} alt={profile.name} />
            <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
              {getInitials(profile.name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-1">
            <h3 className="text-2xl font-bold tracking-tight" data-testid="text-driver-name">
              {profile.name}
            </h3>
            {profile.pronouns && (
              <p className="text-sm text-muted-foreground" data-testid="text-driver-pronouns">
                {profile.pronouns}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <span className="font-medium">{formatRideCount(profile.stats.totalRides)} rides</span>
              <span className="text-muted-foreground/50">•</span>
              <span>{formatYearsActive(profile.stats.yearsActive)} with SafeGo</span>
            </div>
          </div>
        </div>

        {profile.vehicle && (
          <div className="space-y-3">
            {show3D ? (
              <div className="relative">
                <Suspense fallback={
                  <div className="w-full h-[180px] bg-muted rounded-lg flex items-center justify-center">
                    <Skeleton className="h-full w-full rounded-lg" />
                  </div>
                }>
                  <VehicleViewer
                    vehicleType={profile.vehicle.type}
                    vehicleColor={profile.vehicle.color}
                    height={180}
                    autoRotate={true}
                    showControls={false}
                  />
                </Suspense>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 bg-background/80 hover:bg-background"
                  onClick={() => setShow3D(false)}
                  data-testid="button-toggle-3d"
                >
                  <EyeOff className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="w-full bg-muted rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-background rounded-lg">
                    <Car className="h-8 w-8 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-lg" data-testid="text-vehicle-info">
                      {profile.vehicle.color} {profile.vehicle.model || profile.vehicle.type}
                    </p>
                    {profile.vehicle.make && !profile.vehicle.model.includes(profile.vehicle.make) && (
                      <p className="text-sm text-muted-foreground" data-testid="text-vehicle-make">
                        {profile.vehicle.make}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShow3D(true)}
                  data-testid="button-show-3d"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">License Plate</p>
                <Badge
                  variant="outline"
                  className="font-mono text-lg px-4 py-1.5 bg-yellow-100 dark:bg-yellow-900 border-yellow-400 dark:border-yellow-600 text-yellow-800 dark:text-yellow-200"
                  data-testid="badge-license-plate"
                >
                  {profile.vehicle.plateNumber}
                </Badge>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Vehicle</p>
                <p className="font-medium text-sm">{profile.vehicle.model}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-4 text-sm font-medium py-4 border-t border-b bg-muted/30 rounded-lg">
          <div className="flex flex-col items-center" data-testid="stat-rides">
            <span className="text-xl font-bold text-primary">{formatRideCount(profile.stats.totalRides)}</span>
            <span className="text-xs text-muted-foreground">Rides</span>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex flex-col items-center" data-testid="stat-rating">
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
              <span className="text-xl font-bold">{profile.stats.rating.toFixed(1)}</span>
            </div>
            <span className="text-xs text-muted-foreground">Rating</span>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex flex-col items-center" data-testid="stat-experience">
            <span className="text-xl font-bold">{profile.stats.yearsActive.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">Years</span>
          </div>
        </div>

        <div className="flex items-start gap-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm text-orange-800 dark:text-orange-200" data-testid="text-safety-title">
              Safety Reminder
            </p>
            <p className="text-sm text-orange-700 dark:text-orange-300 mt-0.5" data-testid="text-safety-message">
              Always confirm the license plate <span className="font-semibold">{profile.vehicle?.plateNumber}</span> and your driver's photo before getting in.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default DriverPreviewCard;
