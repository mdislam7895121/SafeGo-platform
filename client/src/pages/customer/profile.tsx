import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  ArrowLeft, User, MapPin, Phone, CreditCard, Shield, 
  Edit, Star, Clock, Home, Briefcase, Heart, Bell, Globe, CheckCircle2 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

export default function CustomerProfile() {
  const { data: profileData, isLoading } = useQuery({
    queryKey: ["/api/customer/home"],
  });

  // Fetch customer ride stats (demo data for now)
  const { data: statsData } = useQuery({
    queryKey: ["/api/customer/stats"],
    enabled: false, // Use demo data
  });

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
  
  // Demo stats (will be replaced with real API data)
  const customerStats = {
    rating: 4.8,
    totalTrips: 42,
    memberSince: profile?.createdAt ? new Date(profile.createdAt) : new Date(),
  };

  // Extract full name or use email as fallback
  const displayName = profile?.fullName || profile?.email?.split('@')[0] || 'User';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  
  // Get city name (default to capital for now)
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

          <Card className="hover-elevate active-elevate-2 cursor-pointer" data-testid="card-saved-places">
            <CardContent className="p-4 text-center">
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center mx-auto mb-2">
                <MapPin className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-sm font-medium">Places</p>
            </CardContent>
          </Card>

          <Link href="/customer/profile/kyc">
            <Card className="hover-elevate active-elevate-2 cursor-pointer" data-testid="card-kyc-status">
              <CardContent className="p-4 text-center">
                <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-950 flex items-center justify-center mx-auto mb-2">
                  <Shield className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-sm font-medium">Safety</p>
              </CardContent>
            </Card>
          </Link>

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
        <Card>
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
              <Button variant="ghost" size="sm" data-testid="button-edit-home">
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
                <p className="text-sm text-muted-foreground">Add your work address</p>
              </div>
              <Button variant="ghost" size="sm" data-testid="button-edit-work">
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
              <Button variant="ghost" size="sm" data-testid="button-add-favorite">
                <Edit className="h-4 w-4" />
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
                <p>✓ Identity verified on {new Date().toLocaleDateString()}</p>
                <p className="mt-1">Your account is fully verified and secure.</p>
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
              <Button variant="ghost" size="sm" data-testid="button-change-language">
                Change
              </Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Notifications</p>
                  <p className="text-sm text-muted-foreground">Email & Push enabled</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" data-testid="button-notification-settings">
                Manage
              </Button>
            </div>
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
    </div>
  );
}
