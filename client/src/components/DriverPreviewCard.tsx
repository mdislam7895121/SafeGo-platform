import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Star, Car } from "lucide-react";

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

interface DriverPreviewCardProps {
  profile: DriverPublicProfile;
  className?: string;
}

export function DriverPreviewCard({ 
  profile, 
  className = "",
}: DriverPreviewCardProps) {
  const formatRideCount = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k+`;
    }
    return count.toString();
  };

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card className={`overflow-hidden ${className}`} data-testid="card-driver-preview">
      <CardContent className="p-6 space-y-6">
        {/* Driver Info Section */}
        <div className="flex items-center gap-4">
          {/* Driver Photo */}
          <Avatar className="h-20 w-20 border-2 border-border" data-testid="avatar-driver">
            <AvatarImage src={profile.profilePhotoUrl || undefined} alt={profile.name} />
            <AvatarFallback className="text-xl font-semibold bg-primary text-primary-foreground">
              {getInitials(profile.name)}
            </AvatarFallback>
          </Avatar>

          {/* Driver Name & Pronouns */}
          <div className="flex-1">
            <h3 className="text-xl font-bold" data-testid="text-driver-name">
              {profile.name}
            </h3>
            {profile.pronouns && (
              <p className="text-sm text-muted-foreground" data-testid="text-driver-pronouns">
                ({profile.pronouns})
              </p>
            )}
          </div>
        </div>

        {/* Vehicle Section */}
        {profile.vehicle && (
          <div className="space-y-3">
            {/* Vehicle Icon */}
            <div className="w-full bg-muted rounded-lg p-4 flex items-center justify-center">
              <div className="flex items-center gap-3">
                <Car className="h-8 w-8 text-muted-foreground" />
                <div className="text-left">
                  <p className="font-medium">{profile.vehicle.color} {profile.vehicle.type}</p>
                  <p className="text-sm text-muted-foreground">{profile.vehicle.model}</p>
                </div>
              </div>
            </div>

            {/* License Plate */}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">License Plate</p>
              <Badge
                variant="outline"
                className="font-mono text-base px-4 py-2 bg-yellow-100 dark:bg-yellow-950 border-yellow-400 dark:border-yellow-600"
                data-testid="badge-license-plate"
              >
                {profile.vehicle.plateNumber}
              </Badge>
            </div>
          </div>
        )}

        {/* Stats Section - Lyft Style */}
        <div className="flex items-center justify-center gap-3 text-sm font-medium text-muted-foreground py-3 border-t border-b">
          <div className="flex items-center gap-1" data-testid="stat-rides">
            <span>{formatRideCount(profile.stats.totalRides)} Rides</span>
          </div>
          <span className="text-muted-foreground/50">|</span>
          <div className="flex items-center gap-1" data-testid="stat-rating">
            <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
            <span>{profile.stats.rating.toFixed(1)}</span>
          </div>
          <span className="text-muted-foreground/50">|</span>
          <div className="flex items-center gap-1" data-testid="stat-experience">
            <span>{profile.stats.yearsActive.toFixed(1)} Years</span>
          </div>
        </div>

        {/* Safety Message */}
        <div className="flex items-start gap-2 bg-muted rounded-lg p-4">
          <AlertCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground" data-testid="text-safety-message">
            Always confirm the license plate and your driver before getting in.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
