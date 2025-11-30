import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { 
  ArrowLeft, User, MapPin, Phone, CreditCard, Shield, 
  Edit, Star, Clock, Home, Briefcase, Heart, Bell, Globe, CheckCircle2, Headphones,
  X, Save, Loader2, Plus, Lock, Unlock, ShieldAlert, AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { GooglePlacesInput } from "@/components/rider/GooglePlacesInput";

interface LocationData {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
}

interface SavedPlace {
  id: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
}

export default function CustomerProfile() {
  const [, setLocationRoute] = useLocation();
  const { toast } = useToast();
  const savedPlacesRef = useRef<HTMLDivElement>(null);
  
  const [editAddressType, setEditAddressType] = useState<"home" | "work" | null>(null);
  const [editAddress, setEditAddress] = useState("");
  const [editLocation, setEditLocation] = useState<LocationData | null>(null);
  
  const [showNotificationsDialog, setShowNotificationsDialog] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  
  const [showLanguageDialog, setShowLanguageDialog] = useState(false);
  
  const [showSafetyDialog, setShowSafetyDialog] = useState(false);
  
  const [showLockAccountDialog, setShowLockAccountDialog] = useState(false);
  const [lockConfirmText, setLockConfirmText] = useState("");
  const [lockPassword, setLockPassword] = useState("");
  
  const [showUnlockAccountDialog, setShowUnlockAccountDialog] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockOtp, setUnlockOtp] = useState("");
  const [unlockStep, setUnlockStep] = useState<"password" | "otp">("password");
  
  const { data: profileData, isLoading } = useQuery({
    queryKey: ["/api/customer/home"],
  });
  
  const { data: lockStatusData, refetch: refetchLockStatus } = useQuery({
    queryKey: ["/api/customer/account/lock-status"],
  });

  const { data: statsData } = useQuery({
    queryKey: ["/api/customer/stats"],
    enabled: false,
  });

  const updateAddressMutation = useMutation({
    mutationFn: async (data: { 
      homeAddress?: string; 
      workAddress?: string;
      homeLat?: number;
      homeLng?: number;
      workLat?: number;
      workLng?: number;
    }) => {
      const response = await apiRequest("/api/customer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/home"] });
      toast({
        title: "Address saved",
        description: `Your ${editAddressType} address has been updated.`,
      });
      setEditAddressType(null);
      setEditAddress("");
      setEditLocation(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message || "Could not save your address. Please try again.",
        variant: "destructive",
      });
    },
  });

  const lockAccountMutation = useMutation({
    mutationFn: async (data: { password: string; confirmationText: string }) => {
      const response = await apiRequest("/api/customer/account/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/account/lock-status"] });
      toast({
        title: "Account locked",
        description: "Your account has been locked. You cannot make any bookings until you unlock it.",
      });
      setShowLockAccountDialog(false);
      setLockConfirmText("");
      setLockPassword("");
      refetchLockStatus();
    },
    onError: (error: Error) => {
      toast({
        title: "Lock failed",
        description: error.message || "Could not lock your account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const requestUnlockOtpMutation = useMutation({
    mutationFn: async (data: { password: string }) => {
      const response = await apiRequest("/api/customer/account/unlock/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: () => {
      setUnlockStep("otp");
      toast({
        title: "Verification code sent",
        description: "Please check your email or phone for the verification code.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Request failed",
        description: error.message || "Could not send verification code. Please try again.",
        variant: "destructive",
      });
    },
  });

  const unlockAccountMutation = useMutation({
    mutationFn: async (data: { password: string; otpCode: string }) => {
      const response = await apiRequest("/api/customer/account/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/account/lock-status"] });
      toast({
        title: "Account unlocked",
        description: "Your account has been unlocked. You can now make bookings again.",
      });
      setShowUnlockAccountDialog(false);
      setUnlockPassword("");
      setUnlockOtp("");
      setUnlockStep("password");
      refetchLockStatus();
    },
    onError: (error: Error) => {
      toast({
        title: "Unlock failed",
        description: error.message || "Could not unlock your account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLockAccount = () => {
    if (lockConfirmText !== "LOCK") {
      toast({
        title: "Confirmation required",
        description: "Please type LOCK to confirm.",
        variant: "destructive",
      });
      return;
    }
    if (!lockPassword.trim()) {
      toast({
        title: "Password required",
        description: "Please enter your password to confirm.",
        variant: "destructive",
      });
      return;
    }
    lockAccountMutation.mutate({ password: lockPassword, confirmationText: lockConfirmText });
  };

  const handleRequestUnlockOtp = () => {
    if (!unlockPassword.trim()) {
      toast({
        title: "Password required",
        description: "Please enter your password.",
        variant: "destructive",
      });
      return;
    }
    requestUnlockOtpMutation.mutate({ password: unlockPassword });
  };

  const handleUnlockAccount = () => {
    if (!unlockOtp.trim()) {
      toast({
        title: "Code required",
        description: "Please enter the verification code.",
        variant: "destructive",
      });
      return;
    }
    unlockAccountMutation.mutate({ password: unlockPassword, otpCode: unlockOtp });
  };

  const isAccountLocked = (lockStatusData as any)?.isAccountLocked === true;
  const lockedAt = (lockStatusData as any)?.accountLockedAt;

  const handleSaveAddress = () => {
    if (!editAddress.trim()) {
      toast({
        title: "Address required",
        description: "Please enter an address.",
        variant: "destructive",
      });
      return;
    }

    if (editAddressType === "home") {
      const updateData: Record<string, any> = { homeAddress: editAddress };
      if (editLocation) {
        updateData.homeLat = editLocation.lat;
        updateData.homeLng = editLocation.lng;
      }
      updateAddressMutation.mutate(updateData);
    } else if (editAddressType === "work") {
      const updateData: Record<string, any> = { workAddress: editAddress };
      if (editLocation) {
        updateData.workLat = editLocation.lat;
        updateData.workLng = editLocation.lng;
      }
      updateAddressMutation.mutate(updateData);
    }
  };

  const handleLocationSelect = (location: LocationData) => {
    setEditLocation(location);
    setEditAddress(location.address);
  };

  const scrollToSavedPlaces = () => {
    savedPlacesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-6 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  const profile = (profileData as any)?.profile;
  
  const customerStats = {
    rating: 4.8,
    totalTrips: 42,
    memberSince: profile?.createdAt ? new Date(profile.createdAt) : new Date(),
  };

  const displayName = profile?.fullName || profile?.email?.split('@')[0] || 'User';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  
  const cityName = profile?.cityCode || (profile?.countryCode === 'BD' ? 'Dhaka' : 'New York');
  const countryFlag = profile?.countryCode === 'BD' ? '🇧🇩' : '🇺🇸';
  const countryName = profile?.countryCode === 'BD' ? 'Bangladesh' : 'United States';

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/customer">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-primary-foreground hover:bg-primary-foreground/20" 
              data-testid="button-back"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Profile</h1>
        </div>

        {/* Modern Profile Header Card */}
        <Card className="bg-background/95 backdrop-blur">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <Avatar className="h-20 w-20 border-4 border-primary/20">
                <AvatarImage src={profile?.profilePhotoUrl} alt={displayName} />
                <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>

              {/* Profile Info */}
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold text-foreground mb-1" data-testid="text-display-name">
                  {displayName}
                </h2>
                
                {/* Location */}
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <MapPin className="h-4 w-4" />
                  <span className="text-sm" data-testid="text-location">
                    {countryFlag} {cityName}, {countryName}
                  </span>
                </div>

                {/* Email with Verified Badge */}
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className="text-sm text-muted-foreground" data-testid="text-email">
                    {profile?.email}
                  </span>
                  {profile?.isVerified && (
                    <Badge variant="default" className="gap-1" data-testid="badge-verified">
                      <CheckCircle2 className="h-3 w-3" />
                      Verified
                    </Badge>
                  )}
                </div>

                {/* Rating and Trips */}
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1" data-testid="customer-rating">
                    <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                    <span className="font-semibold">{customerStats.rating.toFixed(1)}</span>
                    <span className="text-sm text-muted-foreground">rating</span>
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <div className="flex items-center gap-1" data-testid="customer-trips">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{customerStats.totalTrips}</span>
                    <span className="text-sm text-muted-foreground">trips</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="p-6 space-y-6">
        {/* Quick Action Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link href="/customer/payment-methods">
            <Card className="hover-elevate active-elevate-2 cursor-pointer" data-testid="card-payment-methods">
              <CardContent className="p-4 text-center">
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center mx-auto mb-2">
                  <CreditCard className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-sm font-medium">Payment</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/customer/delivery-addresses">
            <Card 
              className="hover-elevate active-elevate-2 cursor-pointer" 
              data-testid="card-saved-places"
            >
              <CardContent className="p-4 text-center">
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center mx-auto mb-2">
                  <MapPin className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-sm font-medium">Addresses</p>
              </CardContent>
            </Card>
          </Link>

          <Card 
            className="hover-elevate active-elevate-2 cursor-pointer" 
            onClick={() => setShowSafetyDialog(true)}
            data-testid="card-kyc-status"
          >
            <CardContent className="p-4 text-center">
              <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-950 flex items-center justify-center mx-auto mb-2">
                <Shield className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-sm font-medium">Safety</p>
            </CardContent>
          </Card>

          <Link href="/customer/profile/settings">
            <Card className="hover-elevate active-elevate-2 cursor-pointer" data-testid="card-edit-profile">
              <CardContent className="p-4 text-center">
                <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center mx-auto mb-2">
                  <Edit className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <p className="text-sm font-medium">Edit</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Personal Information Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
            <CardDescription>Your basic account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Full Name</p>
                <p className="font-medium" data-testid="text-fullname">
                  {profile?.fullName || "Not provided"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Phone Number</p>
                <p className="font-medium" data-testid="text-phone">
                  {profile?.phoneNumber || "Not provided"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Email Address</p>
                <p className="font-medium" data-testid="text-email-detail">
                  {profile?.email}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Date of Birth</p>
                <p className="font-medium" data-testid="text-dob">
                  {profile?.dateOfBirth 
                    ? new Date(profile.dateOfBirth).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })
                    : "Not provided"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Addresses & Saved Places Section */}
        <Card ref={savedPlacesRef}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Addresses & Saved Places
            </CardTitle>
            <CardDescription>Manage your favorite locations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Home Address */}
            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center flex-shrink-0">
                <Home className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium mb-1">Home</p>
                <p className="text-sm text-muted-foreground" data-testid="text-home-address">
                  {profile?.homeAddress || profile?.presentAddress || "Add your home address"}
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setEditAddressType("home");
                  setEditAddress(profile?.homeAddress || profile?.presentAddress || "");
                }}
                data-testid="button-edit-home"
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>

            {/* Work Address */}
            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center flex-shrink-0">
                <Briefcase className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium mb-1">Work</p>
                <p className="text-sm text-muted-foreground" data-testid="text-work-address">
                  {profile?.workAddress || "Add your work address"}
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setEditAddressType("work");
                  setEditAddress(profile?.workAddress || "");
                }}
                data-testid="button-edit-work"
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>

            {/* Favorites */}
            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center flex-shrink-0">
                <Heart className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium mb-1">Favorites</p>
                <p className="text-sm text-muted-foreground">0 saved locations</p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  toast({
                    title: "Coming soon",
                    description: "Favorites feature will be available soon!",
                  });
                }}
                data-testid="button-add-favorite"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* KYC & Verification Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              KYC & Verification
            </CardTitle>
            <CardDescription>Identity verification and account security</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                  profile?.isVerified 
                    ? 'bg-green-100 dark:bg-green-950' 
                    : 'bg-yellow-100 dark:bg-yellow-950'
                }`}>
                  <Shield className={`h-6 w-6 ${
                    profile?.isVerified 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-yellow-600 dark:text-yellow-400'
                  }`} />
                </div>
                <div>
                  <p className="font-medium mb-1">Verification Status</p>
                  <Badge 
                    variant={profile?.isVerified ? "default" : "secondary"}
                    data-testid="badge-verification-status"
                  >
                    {profile?.verificationStatus || "pending"}
                  </Badge>
                </div>
              </div>
              <Link href="/customer/profile/kyc">
                <Button variant="outline" size="sm" data-testid="button-manage-kyc">
                  Manage
                </Button>
              </Link>
            </div>

            {profile?.verificationStatus === "approved" && (
              <div className="text-sm text-muted-foreground">
                <p>Your account is fully verified and secure.</p>
              </div>
            )}

            {profile?.verificationStatus === "pending" && (
              <div className="text-sm text-muted-foreground">
                <p>Your KYC documents are under review.</p>
                <p className="mt-1">This typically takes 24-48 hours.</p>
              </div>
            )}

            {profile?.verificationStatus === "rejected" && profile?.rejectionReason && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <p className="font-medium mb-1">Action Required</p>
                <p>{profile.rejectionReason}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security & Account Lock Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Security & Account Lock
            </CardTitle>
            <CardDescription>Protect your account with additional security</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Account Lock Status */}
            <div className={`flex items-center justify-between p-4 rounded-lg ${
              isAccountLocked 
                ? 'bg-destructive/10 border border-destructive/30' 
                : 'bg-muted/50'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                  isAccountLocked 
                    ? 'bg-destructive/20' 
                    : 'bg-green-100 dark:bg-green-950'
                }`}>
                  {isAccountLocked ? (
                    <Lock className="h-6 w-6 text-destructive" />
                  ) : (
                    <Unlock className="h-6 w-6 text-green-600 dark:text-green-400" />
                  )}
                </div>
                <div>
                  <p className="font-medium mb-1">Account Status</p>
                  <Badge 
                    variant={isAccountLocked ? "destructive" : "default"}
                    data-testid="badge-account-lock-status"
                  >
                    {isAccountLocked ? "Locked" : "Active"}
                  </Badge>
                  {isAccountLocked && lockedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Locked on {new Date(lockedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              {isAccountLocked ? (
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={() => setShowUnlockAccountDialog(true)}
                  data-testid="button-unlock-account"
                >
                  <Unlock className="h-4 w-4 mr-2" />
                  Unlock
                </Button>
              ) : (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => setShowLockAccountDialog(true)}
                  data-testid="button-lock-account"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Lock
                </Button>
              )}
            </div>

            {isAccountLocked && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium mb-1">Account is Locked</p>
                    <p>You cannot book rides, order food, or request deliveries while your account is locked. To restore access, click "Unlock" and verify your identity.</p>
                  </div>
                </div>
              </div>
            )}

            {!isAccountLocked && (
              <div className="text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Your account is active and secure
                </p>
                <p className="mt-2 text-xs">
                  If you suspect unauthorized access, you can lock your account immediately. You'll need to verify your identity to unlock it.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preferences Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Preferences
            </CardTitle>
            <CardDescription>Customize your experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Language</p>
                  <p className="text-sm text-muted-foreground">English (US)</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowLanguageDialog(true)}
                data-testid="button-change-language"
              >
                Change
              </Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    {emailNotifications && pushNotifications ? "Email & Push enabled" : 
                     emailNotifications ? "Email enabled" : 
                     pushNotifications ? "Push enabled" : "Disabled"}
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowNotificationsDialog(true)}
                data-testid="button-notification-settings"
              >
                Manage
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Support Center Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Headphones className="h-5 w-5" />
              Support Center
            </CardTitle>
            <CardDescription>Get help with your account or rides</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/customer/support">
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                data-testid="button-contact-support-profile"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Headphones className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Contact Support</p>
                  <p className="text-sm text-muted-foreground">Chat with our support team</p>
                </div>
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border h-16 flex items-center justify-around px-6 z-10">
        <Link href="/customer">
          <Button variant="ghost" size="sm" className="flex flex-col gap-1 h-auto" data-testid="nav-home">
            <Home className="h-5 w-5" />
            <span className="text-xs">Home</span>
          </Button>
        </Link>
        <Link href="/customer/activity">
          <Button variant="ghost" size="sm" className="flex flex-col gap-1 h-auto" data-testid="nav-activity">
            <Clock className="h-5 w-5" />
            <span className="text-xs">Activity</span>
          </Button>
        </Link>
        <Link href="/customer/wallet">
          <Button variant="ghost" size="sm" className="flex flex-col gap-1 h-auto" data-testid="nav-wallet">
            <CreditCard className="h-5 w-5" />
            <span className="text-xs">Wallet</span>
          </Button>
        </Link>
        <Link href="/customer/profile">
          <Button variant="ghost" size="sm" className="flex flex-col gap-1 h-auto" data-testid="nav-profile">
            <User className="h-5 w-5 text-primary" />
            <span className="text-xs text-primary font-medium">Profile</span>
          </Button>
        </Link>
      </div>

      {/* Edit Address Dialog */}
      <Dialog open={editAddressType !== null} onOpenChange={(open) => !open && setEditAddressType(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editAddressType === "home" ? (
                <><Home className="h-5 w-5" /> Edit Home Address</>
              ) : (
                <><Briefcase className="h-5 w-5" /> Edit Work Address</>
              )}
            </DialogTitle>
            <DialogDescription>
              Enter your {editAddressType} address for quick access when booking rides.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <GooglePlacesInput
                value={editAddress}
                onChange={setEditAddress}
                onLocationSelect={handleLocationSelect}
                placeholder={`Enter your ${editAddressType} address`}
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setEditAddressType(null)}
              data-testid="button-cancel-address"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveAddress}
              disabled={updateAddressMutation.isPending}
              data-testid="button-save-address"
            >
              {updateAddressMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                <><Save className="h-4 w-4 mr-2" /> Save</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notifications Settings Dialog */}
      <Dialog open={showNotificationsDialog} onOpenChange={setShowNotificationsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" /> Notification Settings
            </DialogTitle>
            <DialogDescription>
              Manage how you receive notifications from SafeGo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive trip receipts and updates via email</p>
              </div>
              <Switch
                checked={emailNotifications}
                onCheckedChange={setEmailNotifications}
                data-testid="switch-email-notifications"
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Push Notifications</Label>
                <p className="text-sm text-muted-foreground">Get real-time updates on your device</p>
              </div>
              <Switch
                checked={pushNotifications}
                onCheckedChange={setPushNotifications}
                data-testid="switch-push-notifications"
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>SMS Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive driver updates via text message</p>
              </div>
              <Switch
                checked={smsNotifications}
                onCheckedChange={setSmsNotifications}
                data-testid="switch-sms-notifications"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => {
                toast({
                  title: "Preferences saved",
                  description: "Your notification settings have been updated.",
                });
                setShowNotificationsDialog(false);
              }}
              data-testid="button-save-notifications"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Language Dialog */}
      <Dialog open={showLanguageDialog} onOpenChange={setShowLanguageDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" /> Language Settings
            </DialogTitle>
            <DialogDescription>
              Choose your preferred language.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-primary/5 border-primary">
              <div className="flex items-center gap-3">
                <span className="text-lg">🇺🇸</span>
                <span className="font-medium">English (US)</span>
              </div>
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border opacity-50">
              <div className="flex items-center gap-3">
                <span className="text-lg">🇧🇩</span>
                <span className="font-medium">Bengali</span>
              </div>
              <Badge variant="secondary">Coming Soon</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border opacity-50">
              <div className="flex items-center gap-3">
                <span className="text-lg">🇪🇸</span>
                <span className="font-medium">Spanish</span>
              </div>
              <Badge variant="secondary">Coming Soon</Badge>
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => setShowLanguageDialog(false)}
              data-testid="button-close-language"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Safety Dialog */}
      <Dialog open={showSafetyDialog} onOpenChange={setShowSafetyDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" /> Safety Center
            </DialogTitle>
            <DialogDescription>
              Your safety is our priority.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
              <h4 className="font-semibold text-red-700 dark:text-red-400 mb-2">Emergency Contacts</h4>
              <p className="text-sm text-red-600 dark:text-red-400">
                In case of emergency, dial 911 (US) or 999 (BD) immediately.
              </p>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium">Safety Features</h4>
              <div className="grid gap-3">
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Trip Sharing</p>
                    <p className="text-sm text-muted-foreground">Share your trip details with trusted contacts</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Verified Drivers</p>
                    <p className="text-sm text-muted-foreground">All drivers undergo background checks</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">24/7 Support</p>
                    <p className="text-sm text-muted-foreground">Our support team is always available to help</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Link href="/customer/support">
              <Button variant="outline" data-testid="button-safety-support">
                Contact Support
              </Button>
            </Link>
            <Button onClick={() => setShowSafetyDialog(false)} data-testid="button-close-safety">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lock Account Dialog */}
      <Dialog open={showLockAccountDialog} onOpenChange={(open) => {
        setShowLockAccountDialog(open);
        if (!open) {
          setLockConfirmText("");
          setLockPassword("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Lock className="h-5 w-5" /> Lock Your Account
            </DialogTitle>
            <DialogDescription>
              Locking your account will prevent anyone from booking rides, ordering food, or requesting deliveries. You will need to verify your identity to unlock it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Warning</p>
                  <p>This action will immediately lock your account. You won't be able to use SafeGo services until you unlock it.</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="lock-confirm">Type "LOCK" to confirm</Label>
              <Input
                id="lock-confirm"
                value={lockConfirmText}
                onChange={(e) => setLockConfirmText(e.target.value.toUpperCase())}
                placeholder="Type LOCK"
                data-testid="input-lock-confirm"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="lock-password">Enter your password</Label>
              <Input
                id="lock-password"
                type="password"
                value={lockPassword}
                onChange={(e) => setLockPassword(e.target.value)}
                placeholder="Enter your password"
                data-testid="input-lock-password"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowLockAccountDialog(false);
                setLockConfirmText("");
                setLockPassword("");
              }}
              data-testid="button-cancel-lock"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleLockAccount}
              disabled={lockConfirmText !== "LOCK" || !lockPassword.trim() || lockAccountMutation.isPending}
              data-testid="button-confirm-lock"
            >
              {lockAccountMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Lock className="h-4 w-4 mr-2" />
              )}
              Lock Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlock Account Dialog */}
      <Dialog open={showUnlockAccountDialog} onOpenChange={(open) => {
        setShowUnlockAccountDialog(open);
        if (!open) {
          setUnlockPassword("");
          setUnlockOtp("");
          setUnlockStep("password");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="h-5 w-5" /> Unlock Your Account
            </DialogTitle>
            <DialogDescription>
              {unlockStep === "password" 
                ? "Enter your password to receive a verification code."
                : "Enter the verification code sent to your email or phone."
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {unlockStep === "password" ? (
              <div className="space-y-2">
                <Label htmlFor="unlock-password">Password</Label>
                <Input
                  id="unlock-password"
                  type="password"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  placeholder="Enter your password"
                  data-testid="input-unlock-password"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-primary/10 text-sm">
                  <p>A verification code has been sent to your registered email or phone number.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unlock-otp">Verification Code</Label>
                  <Input
                    id="unlock-otp"
                    value={unlockOtp}
                    onChange={(e) => setUnlockOtp(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    data-testid="input-unlock-otp"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => {
                if (unlockStep === "otp") {
                  setUnlockStep("password");
                  setUnlockOtp("");
                } else {
                  setShowUnlockAccountDialog(false);
                  setUnlockPassword("");
                  setUnlockOtp("");
                  setUnlockStep("password");
                }
              }}
              data-testid="button-cancel-unlock"
            >
              {unlockStep === "otp" ? "Back" : "Cancel"}
            </Button>
            {unlockStep === "password" ? (
              <Button 
                onClick={handleRequestUnlockOtp}
                disabled={!unlockPassword.trim() || requestUnlockOtpMutation.isPending}
                data-testid="button-request-otp"
              >
                {requestUnlockOtpMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Send Code
              </Button>
            ) : (
              <Button 
                onClick={handleUnlockAccount}
                disabled={!unlockOtp.trim() || unlockAccountMutation.isPending}
                data-testid="button-confirm-unlock"
              >
                {unlockAccountMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Unlock className="h-4 w-4 mr-2" />
                )}
                Unlock Account
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
