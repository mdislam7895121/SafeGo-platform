import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, User, MapPin, Phone, CreditCard, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function CustomerProfile() {
  const { data: profileData, isLoading } = useQuery({
    queryKey: ["/api/customer/home"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const profile = (profileData as any)?.profile;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/customer">
            <Button variant="ghost" size="icon" className="text-primary-foreground" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Profile</h1>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium" data-testid="text-email">{profile?.email}</p>
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
          </CardContent>
        </Card>

        {/* KYC Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              KYC Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile?.dateOfBirth && (
              <div>
                <p className="text-sm text-muted-foreground">Date of Birth</p>
                <p className="font-medium">{new Date(profile.dateOfBirth).toLocaleDateString()}</p>
              </div>
            )}
            {profile?.countryCode === "BD" && (
              <>
                {profile?.nid && (
                  <div>
                    <p className="text-sm text-muted-foreground">National ID (NID)</p>
                    <p className="font-medium">{profile.nid}</p>
                  </div>
                )}
                {profile?.presentAddress && (
                  <div>
                    <p className="text-sm text-muted-foreground">Present Address</p>
                    <p className="font-medium">{profile.presentAddress}</p>
                  </div>
                )}
              </>
            )}
            {profile?.countryCode === "US" && (
              <>
                {profile?.governmentId && (
                  <div>
                    <p className="text-sm text-muted-foreground">Government ID</p>
                    <p className="font-medium">{profile.governmentId}</p>
                  </div>
                )}
                {profile?.homeAddress && (
                  <div>
                    <p className="text-sm text-muted-foreground">Home Address</p>
                    <p className="font-medium">{profile.homeAddress}</p>
                  </div>
                )}
              </>
            )}
            {!profile?.isVerified && (
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Your account is pending verification. Please wait for admin approval.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border h-16 flex items-center justify-around px-6">
        <Link href="/customer">
          <Button variant="ghost" size="sm" className="flex flex-col gap-1 h-auto" data-testid="nav-home">
            <Shield className="h-5 w-5" />
            <span className="text-xs">Home</span>
          </Button>
        </Link>
        <Link href="/customer/activity">
          <Button variant="ghost" size="sm" className="flex flex-col gap-1 h-auto" data-testid="nav-activity">
            <CreditCard className="h-5 w-5" />
            <span className="text-xs">Activity</span>
          </Button>
        </Link>
        <Link href="/customer/profile">
          <Button variant="ghost" size="sm" className="flex flex-col gap-1 h-auto" data-testid="nav-profile">
            <User className="h-5 w-5 text-primary" />
            <span className="text-xs text-primary font-medium">Profile</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
