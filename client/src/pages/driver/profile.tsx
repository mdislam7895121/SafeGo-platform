import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, CheckCircle2, Phone, Mail } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function DriverProfile() {
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);

  const { data: driverData, isLoading } = useQuery({
    queryKey: ["/api/driver/home"],
  });

  const profile = (driverData as any)?.profile;

  // Extract driver name
  const driverName = profile?.firstName && profile?.lastName
    ? `${profile.firstName} ${profile.lastName}`
    : profile?.fullName || "Driver";

  const initials = driverName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex items-start gap-6">
          <Skeleton className="h-[120px] w-[120px] rounded-full" />
          <div className="space-y-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-5 w-56" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Profile Header - Uber Style */}
      <div className="flex items-start gap-6">
        {/* Large Circular Avatar */}
        <button
          onClick={() => setPhotoDialogOpen(true)}
          className="relative group"
          data-testid="button-avatar"
        >
          <Avatar className="h-[120px] w-[120px] border-4 border-border transition-opacity group-hover:opacity-80">
            <AvatarImage src={profile?.profilePhotoUrl} alt={driverName} />
            <AvatarFallback className="bg-muted text-muted-foreground">
              <User className="h-12 w-12" />
            </AvatarFallback>
          </Avatar>
        </button>

        {/* Driver Info */}
        <div className="flex-1 pt-2">
          {/* Full Name */}
          <h1 className="text-3xl font-bold mb-2" data-testid="text-driver-name">
            {driverName}
          </h1>

          {/* Email with Verification Badge */}
          <div className="flex items-center gap-2 mb-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground" data-testid="text-driver-email">
              {profile?.email}
            </span>
            {profile?.isVerified && (
              <Badge variant="outline" className="gap-1 px-2 py-0 h-5 text-xs">
                <CheckCircle2 className="h-3 w-3 text-green-600" />
                Verified
              </Badge>
            )}
          </div>

          {/* Phone (if available) */}
          {profile?.phoneNumber && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground" data-testid="text-driver-phone">
                {profile.phoneNumber}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Support Modal for Photo Changes */}
      <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
        <DialogContent data-testid="dialog-photo-support">
          <DialogHeader>
            <DialogTitle>Profile Photo Change</DialogTitle>
            <DialogDescription className="pt-4 text-base">
              Profile photo changes require support assistance. Please contact SafeGo Support.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
