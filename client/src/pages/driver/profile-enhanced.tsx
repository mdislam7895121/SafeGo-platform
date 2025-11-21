import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft, User, Car, FileText, Wallet, Shield, Star, DollarSign,
  CheckCircle2, Clock, AlertCircle, Upload, Edit, TrendingUp, Power, MapPin
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

// Utility function to mask sensitive identifiers (SSN, NID, License)
function maskIdentifier(value: string | null | undefined): string {
  if (!value) return "Not provided";
  if (value.length <= 4) return "****";
  return "****" + value.slice(-4);
}

export default function DriverProfileEnhanced() {
  const [activeTab, setActiveTab] = useState("overview");

  const { data: driverData, isLoading } = useQuery({
    queryKey: ["/api/driver/home"],
  });

  const { data: vehicleDocuments } = useQuery({
    queryKey: ["/api/driver/vehicle-documents"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-6">
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
        <div className="p-6 space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  const profile = (driverData as any)?.profile;
  const vehicle = (driverData as any)?.vehicle;
  const stats = (driverData as any)?.stats;
  const wallet = (driverData as any)?.wallet;

  // Extract driver name
  const driverName = profile?.firstName && profile?.lastName
    ? `${profile.firstName} ${profile.lastName}`
    : profile?.fullName || profile?.email?.split('@')[0] || 'Driver';
  
  const username = profile?.email?.split('@')[0] || 'driver';
  const initials = driverName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const cityName = profile?.usaCity || (profile?.countryCode === 'BD' ? 'Dhaka' : 'New York');
  const countryCode = profile?.countryCode || 'US';

  // Calculate onboarding progress
  const onboardingSteps = [
    {
      id: 1,
      label: "Personal Info",
      status: (profile?.firstName || profile?.fullName) ? "completed" : "pending",
      icon: User,
    },
    {
      id: 2,
      label: "KYC Documents",
      status: profile?.profilePhotoUrl && (profile?.dmvLicenseImageUrl || profile?.nidEncrypted) 
        ? "completed" 
        : profile?.profilePhotoUrl 
        ? "in_progress" 
        : "pending",
      icon: FileText,
    },
    {
      id: 3,
      label: "Vehicle Added",
      status: vehicle ? "completed" : "pending",
      icon: Car,
    },
    {
      id: 4,
      label: "Vehicle Documents",
      status: (vehicleDocuments as any)?.documents?.length > 0 ? "completed" : "pending",
      icon: Upload,
    },
    {
      id: 5,
      label: "Account Approval",
      status: profile?.isVerified ? "completed" : profile?.verificationStatus === "rejected" ? "attention" : "pending",
      icon: CheckCircle2,
    },
  ];

  const completedSteps = onboardingSteps.filter(s => s.status === "completed").length;
  const progressPercent = (completedSteps / onboardingSteps.length) * 100;

  // Real earnings from API only (no fallbacks to wallet balance)
  const earnings = {
    today: stats?.todayEarnings ? Number(stats.todayEarnings) : 0,
    thisWeek: stats?.weekEarnings ? Number(stats.weekEarnings) : 0,
    thisMonth: stats?.monthEarnings ? Number(stats.monthEarnings) : 0,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0 gap-1" data-testid={`badge-status-completed`}>
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </Badge>
        );
      case "in_progress":
        return (
          <Badge variant="secondary" className="gap-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" data-testid={`badge-status-in-progress`}>
            <Clock className="h-3 w-3" />
            In Progress
          </Badge>
        );
      case "attention":
        return (
          <Badge variant="destructive" className="gap-1" data-testid={`badge-status-attention`}>
            <AlertCircle className="h-3 w-3" />
            Needs Attention
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1 text-muted-foreground" data-testid={`badge-status-pending`}>
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Uber-Style Blue Gradient Header - Fixed on scroll */}
      <div className="sticky top-0 z-40 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white shadow">
        <div className="p-4 md:p-6 max-w-6xl mx-auto">
          {/* Back Button */}
          <div className="flex items-center gap-4 mb-4">
            <Link href="/driver">
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white hover:bg-white/20" 
                data-testid="button-back"
              >
                <ArrowLeft className="h-6 w-6" />
              </Button>
            </Link>
            <h1 className="text-xl md:text-2xl font-bold">Driver Profile</h1>
          </div>

          {/* Profile Header - Uber Style */}
          <Card className="bg-white/10 backdrop-blur-sm border-0">
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                {/* Large Profile Photo - Left */}
                <Avatar className="h-24 w-24 md:h-28 md:w-28 border-4 border-white/30 flex-shrink-0">
                  <AvatarImage src={profile?.profilePhotoUrl} alt={driverName} data-testid="img-driver-avatar" />
                  <AvatarFallback className="text-3xl md:text-4xl font-bold bg-white/20 text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                {/* Driver Info - Center */}
                <div className="flex-1 min-w-0 w-full md:w-auto">
                  {/* Username */}
                  <p className="text-sm text-white/70 mb-1" data-testid="text-driver-username">@{username}</p>
                  
                  {/* Full Name */}
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-2" data-testid="text-driver-name">
                    {driverName}
                  </h2>
                  
                  {/* Location with Icon */}
                  <div className="flex items-center gap-2 mb-4">
                    <MapPin className="h-4 w-4 text-white/70" />
                    <p className="text-sm text-white/90" data-testid="text-driver-location">
                      {cityName}, {countryCode}
                    </p>
                  </div>

                  {/* Stats Row - Rating, Trips, Earnings */}
                  <div className="flex items-center gap-4 md:gap-6 flex-wrap">
                    {/* Rating */}
                    <div className="flex items-center gap-1.5">
                      <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                      <span className="text-lg font-bold text-white" data-testid="text-driver-rating">
                        {stats?.rating ? Number(stats.rating).toFixed(1) : "5.0"}
                      </span>
                    </div>
                    
                    <Separator orientation="vertical" className="h-5 bg-white/30" />
                    
                    {/* Total Trips */}
                    <div>
                      <p className="text-xs text-white/70">Total Trips</p>
                      <p className="text-lg font-bold text-white" data-testid="text-driver-trips">
                        {stats?.totalTrips || 0}
                      </p>
                    </div>
                    
                    <Separator orientation="vertical" className="h-5 bg-white/30" />
                    
                    {/* Today's Earnings */}
                    <div>
                      <p className="text-xs text-white/70">Today</p>
                      <p className="text-lg font-bold text-green-300" data-testid="text-earnings-today">
                        ${earnings.today.toFixed(2)}
                      </p>
                    </div>
                    
                    <Separator orientation="vertical" className="h-5 bg-white/30" />
                    
                    {/* This Week Earnings */}
                    <div>
                      <p className="text-xs text-white/70">This Week</p>
                      <p className="text-lg font-bold text-green-300" data-testid="text-earnings-week">
                        ${earnings.thisWeek.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Online Status Toggle - Right */}
                <div className="flex flex-col items-start md:items-end gap-3 w-full md:w-auto">
                  <Badge 
                    variant={vehicle?.isOnline ? "default" : "secondary"}
                    className="gap-2 px-4 py-2 text-sm font-semibold"
                    data-testid="badge-online-status"
                  >
                    <Power className="h-4 w-4" />
                    {vehicle?.isOnline ? "Online" : "Offline"}
                  </Badge>
                  <Link href="/driver">
                    <Button 
                      variant="secondary" 
                      size="sm"
                      className="bg-white/20 hover:bg-white/30 text-white border-white/30 w-full md:w-auto"
                      data-testid="button-go-online"
                    >
                      {vehicle?.isOnline ? "Go Offline" : "Go Online"}
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content - With top padding to prevent sticky header overlap */}
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 pt-6">
        {/* Onboarding Progress - Redesigned as Cards */}
        {!profile?.isVerified && (
          <Card className="rounded-2xl">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                  Onboarding Progress
                </CardTitle>
                <Badge variant="secondary" className="text-base px-3 py-1" data-testid="badge-progress-percent">
                  {Math.round(progressPercent)}%
                </Badge>
              </div>
              <CardDescription className="text-base">Complete all steps to start earning with SafeGo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Thick Progress Bar - Uber Style */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm font-medium">
                  <span data-testid="text-progress-steps">{completedSteps} of {onboardingSteps.length} completed</span>
                  <span className="text-blue-600 font-bold">{Math.round(progressPercent)}%</span>
                </div>
                <Progress 
                  value={progressPercent} 
                  className="h-3 rounded-full bg-gray-200 dark:bg-gray-700" 
                  data-testid="progress-onboarding"
                />
              </div>

              {/* Steps as Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {onboardingSteps.map((step) => (
                  <Card 
                    key={step.id} 
                    className={`rounded-xl hover-elevate transition-all ${
                      step.status === 'completed' 
                        ? 'border-green-500 bg-green-50 dark:bg-green-950/20' 
                        : step.status === 'in_progress'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                        : step.status === 'attention'
                        ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                        : 'border-gray-300 dark:border-gray-700'
                    }`}
                    data-testid={`onboarding-step-${step.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                          step.status === 'completed' 
                            ? 'bg-green-500 text-white' 
                            : step.status === 'in_progress'
                            ? 'bg-blue-500 text-white'
                            : step.status === 'attention'
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}>
                          <step.icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate" data-testid={`text-step-${step.id}-label`}>
                            {step.label}
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-center">
                        {getStatusBadge(step.status)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 4 Horizontal Tabs - Uber Style (Overview, Vehicle, Documents, Payouts) */}
        <Card className="rounded-2xl">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 h-12 bg-muted/50 rounded-t-2xl">
              <TabsTrigger 
                value="overview" 
                className="text-base font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"
                data-testid="tab-overview"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger 
                value="vehicle" 
                className="text-base font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"
                data-testid="tab-vehicle"
              >
                Vehicle
              </TabsTrigger>
              <TabsTrigger 
                value="documents" 
                className="text-base font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"
                data-testid="tab-documents"
              >
                Documents
              </TabsTrigger>
              <TabsTrigger 
                value="payouts" 
                className="text-base font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"
                data-testid="tab-payouts"
              >
                Payouts
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="p-6 space-y-6" data-testid="tab-content-overview">
              {/* Account Status */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Account Status</h3>
                <Card className="rounded-xl">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium mb-2">Verification Status</p>
                        <Badge 
                          variant={profile?.isVerified ? "default" : "secondary"}
                          className={profile?.isVerified ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-base px-3 py-1" : "text-base px-3 py-1"}
                          data-testid="badge-verification-status"
                        >
                          {profile?.isVerified ? "Verified" : (profile?.verificationStatus || "Pending Review")}
                        </Badge>
                      </div>
                      <Link href="/driver/kyc-documents">
                        <Button variant="outline" data-testid="button-manage-documents">
                          Manage Documents
                        </Button>
                      </Link>
                    </div>

                    {profile?.rejectionReason && (
                      <div className="mt-4 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                        <p className="font-semibold text-red-800 dark:text-red-400 mb-1">Action Required</p>
                        <p className="text-sm text-red-700 dark:text-red-300">{profile.rejectionReason}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Earnings Statistics */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Earnings & Statistics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card className="rounded-xl">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Total Balance</p>
                          <p className="text-3xl font-bold text-green-600" data-testid="text-total-balance">
                            ${wallet?.balance ? Number(wallet.balance).toFixed(2) : "0.00"}
                          </p>
                        </div>
                        <DollarSign className="h-12 w-12 text-green-600 opacity-20" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-xl">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Total Trips</p>
                          <p className="text-3xl font-bold text-blue-600" data-testid="text-overview-trips">
                            {stats?.totalTrips || 0}
                          </p>
                        </div>
                        <Car className="h-12 w-12 text-blue-600 opacity-20" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-xl">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Average Rating</p>
                          <div className="flex items-center gap-2">
                            <p className="text-3xl font-bold text-yellow-600" data-testid="text-overview-rating">
                              {stats?.rating ? Number(stats.rating).toFixed(1) : "5.0"}
                            </p>
                            <Star className="h-8 w-8 fill-yellow-500 text-yellow-500" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Quick Actions */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Link href="/driver/wallet">
                    <Button variant="outline" className="w-full justify-start h-auto p-4" data-testid="button-view-wallet">
                      <Wallet className="h-5 w-5 mr-3" />
                      <div className="text-left">
                        <p className="font-semibold">View Full Wallet</p>
                        <p className="text-xs text-muted-foreground">Transactions & payouts</p>
                      </div>
                    </Button>
                  </Link>
                  <Link href="/driver/vehicle">
                    <Button variant="outline" className="w-full justify-start h-auto p-4" data-testid="button-manage-vehicle">
                      <Car className="h-5 w-5 mr-3" />
                      <div className="text-left">
                        <p className="font-semibold">Manage Vehicle</p>
                        <p className="text-xs text-muted-foreground">Edit vehicle details</p>
                      </div>
                    </Button>
                  </Link>
                </div>
              </div>
            </TabsContent>

            {/* Vehicle Tab */}
            <TabsContent value="vehicle" className="p-6 space-y-4" data-testid="tab-content-vehicle">
              {vehicle ? (
                <Card className="rounded-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Car className="h-6 w-6 text-blue-600" />
                      Active Vehicle
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Vehicle Type</p>
                        <Badge className="text-base px-3 py-1" data-testid="badge-vehicle-type">{vehicle.vehicleType}</Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Model</p>
                        <p className="font-semibold text-lg" data-testid="text-vehicle-model">{vehicle.vehicleModel}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">License Plate</p>
                        <p className="font-semibold text-lg" data-testid="text-vehicle-plate">{maskIdentifier(vehicle.vehiclePlate)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Vehicle Earnings</p>
                        <p className="font-bold text-2xl text-green-600" data-testid="text-vehicle-earnings">
                          ${vehicle.totalEarnings ? Number(vehicle.totalEarnings).toFixed(2) : "0.00"}
                        </p>
                      </div>
                    </div>
                    <Link href="/driver/vehicle">
                      <Button className="w-full" size="lg" data-testid="button-edit-vehicle">
                        <Edit className="h-5 w-5 mr-2" />
                        Edit Vehicle Details
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-dashed rounded-xl">
                  <CardContent className="p-12 text-center">
                    <Car className="h-20 w-20 mx-auto mb-6 text-muted-foreground opacity-30" />
                    <h3 className="font-bold text-2xl mb-3">No Vehicle Registered</h3>
                    <p className="text-muted-foreground mb-6 text-base">
                      Register your vehicle to start accepting rides and earning with SafeGo
                    </p>
                    <Link href="/driver/vehicle">
                      <Button size="lg" data-testid="button-register-vehicle">
                        <Car className="h-5 w-5 mr-2" />
                        Register Vehicle Now
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="p-6 space-y-4" data-testid="tab-content-documents">
              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle className="text-xl">Required Documents</CardTitle>
                  <CardDescription className="text-base">Upload and manage your verification documents</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Profile Photo */}
                  <div className="flex items-center justify-between p-4 rounded-xl border">
                    <div className="flex items-center gap-4">
                      <div className={`h-14 w-14 rounded-full flex items-center justify-center ${
                        profile?.profilePhotoUrl ? 'bg-green-100 dark:bg-green-950/30' : 'bg-gray-100 dark:bg-gray-800'
                      }`}>
                        <User className={`h-7 w-7 ${
                          profile?.profilePhotoUrl ? 'text-green-600 dark:text-green-400' : 'text-gray-400'
                        }`} />
                      </div>
                      <div>
                        <p className="font-semibold text-base">Profile Photo</p>
                        <p className="text-sm text-muted-foreground" data-testid="text-doc-profile-status">
                          {profile?.profilePhotoUrl ? "Uploaded" : "Not uploaded"}
                        </p>
                      </div>
                    </div>
                    {profile?.profilePhotoUrl ? (
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    ) : (
                      <AlertCircle className="h-6 w-6 text-yellow-600" />
                    )}
                  </div>

                  {/* Driver License */}
                  <div className="flex items-center justify-between p-4 rounded-xl border">
                    <div className="flex items-center gap-4">
                      <div className={`h-14 w-14 rounded-full flex items-center justify-center ${
                        (profile?.dmvLicenseImageUrl || profile?.driverLicenseImageUrl) ? 'bg-green-100 dark:bg-green-950/30' : 'bg-gray-100 dark:bg-gray-800'
                      }`}>
                        <FileText className={`h-7 w-7 ${
                          (profile?.dmvLicenseImageUrl || profile?.driverLicenseImageUrl) ? 'text-green-600 dark:text-green-400' : 'text-gray-400'
                        }`} />
                      </div>
                      <div>
                        <p className="font-semibold text-base">Driver License</p>
                        <p className="text-sm text-muted-foreground" data-testid="text-doc-license-status">
                          {(profile?.dmvLicenseImageUrl || profile?.driverLicenseImageUrl) ? "Uploaded" : "Not uploaded"}
                        </p>
                      </div>
                    </div>
                    {(profile?.dmvLicenseImageUrl || profile?.driverLicenseImageUrl) ? (
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    ) : (
                      <AlertCircle className="h-6 w-6 text-yellow-600" />
                    )}
                  </div>

                  {/* Vehicle Documents */}
                  <div className="flex items-center justify-between p-4 rounded-xl border">
                    <div className="flex items-center gap-4">
                      <div className={`h-14 w-14 rounded-full flex items-center justify-center ${
                        (vehicleDocuments as any)?.documents?.length > 0 ? 'bg-green-100 dark:bg-green-950/30' : 'bg-gray-100 dark:bg-gray-800'
                      }`}>
                        <Car className={`h-7 w-7 ${
                          (vehicleDocuments as any)?.documents?.length > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'
                        }`} />
                      </div>
                      <div>
                        <p className="font-semibold text-base">Vehicle Documents</p>
                        <p className="text-sm text-muted-foreground" data-testid="text-doc-vehicle-count">
                          {(vehicleDocuments as any)?.documents?.length || 0} uploaded
                        </p>
                      </div>
                    </div>
                    {(vehicleDocuments as any)?.documents?.length > 0 ? (
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    ) : (
                      <AlertCircle className="h-6 w-6 text-yellow-600" />
                    )}
                  </div>

                  <Link href="/driver/kyc-documents">
                    <Button className="w-full mt-4" size="lg" data-testid="button-upload-documents">
                      <Upload className="h-5 w-5 mr-2" />
                      Upload & Manage Documents
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Payouts Tab */}
            <TabsContent value="payouts" className="p-6 space-y-4" data-testid="tab-content-payouts">
              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Wallet className="h-6 w-6 text-blue-600" />
                    Wallet Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Available Balance */}
                    <div className="p-6 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                      <p className="text-sm text-green-700 dark:text-green-400 font-medium mb-2">Available Balance</p>
                      <p className="text-4xl font-bold text-green-600 dark:text-green-400" data-testid="text-available-balance">
                        ${wallet?.balance ? Number(wallet.balance).toFixed(2) : "0.00"}
                      </p>
                      <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-2">Ready for payout</p>
                    </div>

                    {/* Negative Balance */}
                    <div className="p-6 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                      <p className="text-sm text-red-700 dark:text-red-400 font-medium mb-2">Negative Balance</p>
                      <p className="text-4xl font-bold text-red-600 dark:text-red-400" data-testid="text-negative-balance">
                        ${wallet?.negativeBalance ? Number(wallet.negativeBalance).toFixed(2) : "0.00"}
                      </p>
                      <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-2">Outstanding amount</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Weekly Earnings Preview */}
                  <div className="p-6 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">Weekly Earnings</p>
                        <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1" data-testid="text-weekly-earnings">
                          ${earnings.thisWeek.toFixed(2)}
                        </p>
                      </div>
                      <TrendingUp className="h-12 w-12 text-blue-600 opacity-20" />
                    </div>
                    <p className="text-xs text-blue-600/70 dark:text-blue-400/70">
                      This week's total earnings before commission
                    </p>
                  </div>

                  <Link href="/driver/wallet">
                    <Button variant="outline" size="lg" className="w-full" data-testid="button-full-wallet">
                      <Wallet className="h-5 w-5 mr-2" />
                      View Full Wallet & Transaction History
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
