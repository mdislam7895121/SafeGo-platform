import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ArrowLeft, User, Mail, Phone, MapPin, Save, Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { GooglePlacesInput } from "@/components/rider/GooglePlacesInput";

interface LocationData {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
}

interface ProfileData {
  profile?: {
    id: string;
    userId: string;
    fullName?: string;
    phoneNumber?: string;
    email?: string;
    homeAddress?: string;
    countryCode?: string;
    isVerified?: boolean;
    createdAt?: string;
  };
}

export default function ProfileSettings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [homeAddress, setHomeAddress] = useState("");
  const [homeLocation, setHomeLocation] = useState<LocationData | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: profileData, isLoading } = useQuery<ProfileData>({
    queryKey: ["/api/customer/home"],
  });

  const profile = profileData?.profile;

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || "");
      setPhoneNumber(profile.phoneNumber || "");
      setHomeAddress(profile.homeAddress || "");
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      const nameChanged = fullName !== (profile.fullName || "");
      const phoneChanged = phoneNumber !== (profile.phoneNumber || "");
      const addressChanged = homeAddress !== (profile.homeAddress || "");
      setHasChanges(nameChanged || phoneChanged || addressChanged);
    }
  }, [fullName, phoneNumber, homeAddress, profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { fullName?: string; phoneNumber?: string; homeAddress?: string }) => {
      const response = await apiRequest("/api/customer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/home"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customer/profile"] });
      toast({
        title: "Profile updated",
        description: "Your profile has been saved successfully.",
      });
      setHasChanges(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message || "Could not save your profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const updates: { fullName?: string; phoneNumber?: string; homeAddress?: string } = {};
    
    if (fullName !== (profile?.fullName || "")) {
      updates.fullName = fullName;
    }
    if (phoneNumber !== (profile?.phoneNumber || "")) {
      updates.phoneNumber = phoneNumber;
    }
    if (homeAddress !== (profile?.homeAddress || "")) {
      updates.homeAddress = homeAddress;
    }

    if (Object.keys(updates).length > 0) {
      updateProfileMutation.mutate(updates);
    }
  };

  const handleHomeLocationSelect = (location: LocationData) => {
    setHomeLocation(location);
    setHomeAddress(location.address);
  };

  const displayName = profile?.fullName || profile?.email?.split('@')[0] || 'User';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-6 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center gap-4 p-4">
          <Link href="/customer">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Profile Settings</h1>
        </div>
      </div>

      <div className="p-4 space-y-6 max-w-lg mx-auto">
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center mb-6">
              <Avatar className="h-20 w-20 border-4 border-primary/20 mb-4">
                <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-semibold" data-testid="text-display-name">{displayName}</h2>
              <div className="flex items-center gap-2 text-muted-foreground mt-1">
                <Mail className="h-4 w-4" />
                <span className="text-sm" data-testid="text-email">{profile?.email}</span>
                {profile?.isVerified && (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                data-testid="input-full-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="pl-10"
                  data-testid="input-phone"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Used for ride updates and driver communication
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  value={profile?.email || ""}
                  disabled
                  className="pl-10 bg-muted"
                  data-testid="input-email"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Email cannot be changed. Contact support if needed.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Default Pickup Location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="homeAddress">Home Address</Label>
              <GooglePlacesInput
                value={homeAddress}
                onChange={setHomeAddress}
                onLocationSelect={handleHomeLocationSelect}
                placeholder="Enter your home address"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                This will be suggested as your default pickup location
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
          <div className="max-w-lg mx-auto">
            <Button
              className="w-full h-12"
              onClick={handleSave}
              disabled={!hasChanges || updateProfileMutation.isPending}
              data-testid="button-save-profile"
            >
              {updateProfileMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
