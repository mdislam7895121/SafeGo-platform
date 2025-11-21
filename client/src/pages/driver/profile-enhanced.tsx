import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft, User, Car, FileText, Wallet, Shield, Star, DollarSign,
  CheckCircle2, Clock, AlertCircle, Upload, Edit, TrendingUp, Power
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

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
        <div className="p-6 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-48 w-full" />
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
  
  const initials = driverName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const cityName = profile?.usaCity || (profile?.countryCode === 'BD' ? 'Dhaka' : 'New York');
  const countryFlag = profile?.countryCode === 'BD' ? '🇧🇩' : '🇺🇸';

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

  // Demo earnings (will be replaced with real API)
  const earnings = {
    today: Number(wallet?.balance || 0) * 0.1, // Demo: 10% of balance
    thisWeek: Number(wallet?.balance || 0) * 0.3, // Demo: 30% of balance
    thisMonth: Number(wallet?.balance || 0),
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />Completed</Badge>;
      case "in_progress":
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />In Progress</Badge>;
      case "attention":
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Needs Attention</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Uber-Style Header */}
      <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/driver">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-primary-foreground hover:bg-primary-foreground/20" 
              data-testid="button-back"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Driver Profile</h1>
        </div>

        {/* Profile Header Card */}
        <Card className="bg-background/95 backdrop-blur">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <Avatar className="h-20 w-20 border-4 border-primary/20">
                <AvatarImage src={profile?.profilePhotoUrl} alt={driverName} />
                <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>

              {/* Driver Info */}
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold text-foreground mb-1" data-testid="text-driver-name">
                  {driverName}
                </h2>
                
                {/* Location */}
                <p className="text-sm text-muted-foreground mb-3" data-testid="text-driver-location">
                  {countryFlag} {cityName}
                </p>

                {/* Stats Row */}
                <div className="flex items-center gap-4 flex-wrap mb-3">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                    <span className="font-semibold" data-testid="text-driver-rating">
                      {stats?.rating ? Number(stats.rating).toFixed(1) : "5.0"}
                    </span>
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <div className="flex items-center gap-1">
                    <Car className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold" data-testid="text-driver-trips">
                      {stats?.totalTrips || 0}
                    </span>
                    <span className="text-sm text-muted-foreground">trips</span>
                  </div>
                </div>

                {/* Earnings Summary */}
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Today</p>
                    <p className="font-bold text-green-600" data-testid="text-earnings-today">
                      ${earnings.today.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">This Week</p>
                    <p className="font-bold text-green-600" data-testid="text-earnings-week">
                      ${earnings.thisWeek.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Online Status Badge */}
              <div className="flex flex-col items-end gap-2">
                <Badge 
                  variant={vehicle?.isOnline ? "default" : "secondary"}
                  className="gap-1"
                  data-testid="badge-online-status"
                >
                  <Power className="h-3 w-3" />
                  {vehicle?.isOnline ? "Online" : "Offline"}
                </Badge>
                <Link href="/driver">
                  <Button variant="outline" size="sm">
                    Go Online
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="p-6 space-y-6">
        {/* Onboarding Progress */}
        {!profile?.isVerified && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Onboarding Progress
              </CardTitle>
              <CardDescription>Complete all steps to start earning</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{completedSteps} of {onboardingSteps.length} completed</span>
                  <span className="font-semibold">{Math.round(progressPercent)}%</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>

              <div className="space-y-3 mt-4">
                {onboardingSteps.map((step) => (
                  <div 
                    key={step.id} 
                    className="flex items-center justify-between p-3 rounded-lg border"
                    data-testid={`onboarding-step-${step.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        step.status === 'completed' 
                          ? 'bg-green-100 dark:bg-green-950' 
                          : 'bg-muted'
                      }`}>
                        <step.icon className={`h-5 w-5 ${
                          step.status === 'completed' 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-muted-foreground'
                        }`} />
                      </div>
                      <span className="font-medium">{step.label}</span>
                    </div>
                    {getStatusBadge(step.status)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabbed Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="vehicle" data-testid="tab-vehicle">Vehicle</TabsTrigger>
            <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
            <TabsTrigger value="payouts" data-testid="tab-payouts">Payouts</TabsTrigger>
            <TabsTrigger value="account" data-testid="tab-account">Account</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Account Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium mb-1">Verification Status</p>
                    <Badge variant={profile?.isVerified ? "default" : "secondary"}>
                      {profile?.verificationStatus || "pending"}
                    </Badge>
                  </div>
                  <Link href="/driver/kyc-documents">
                    <Button variant="outline" size="sm">Manage</Button>
                  </Link>
                </div>

                {profile?.rejectionReason && (
                  <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <p className="font-medium mb-1">Action Required</p>
                    <p>{profile.rejectionReason}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Balance</p>
                      <p className="text-3xl font-bold" data-testid="text-total-balance">
                        ${wallet?.balance ? Number(wallet.balance).toFixed(2) : "0.00"}
                      </p>
                    </div>
                    <DollarSign className="h-12 w-12 text-green-600 opacity-20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Trips</p>
                      <p className="text-3xl font-bold" data-testid="text-overview-trips">
                        {stats?.totalTrips || 0}
                      </p>
                    </div>
                    <Car className="h-12 w-12 text-blue-600 opacity-20" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Vehicle Tab */}
          <TabsContent value="vehicle" className="space-y-4 mt-6">
            {vehicle ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Car className="h-5 w-5" />
                    Active Vehicle
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Type</p>
                      <Badge>{vehicle.vehicleType}</Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Model</p>
                      <p className="font-medium">{vehicle.vehicleModel}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">License Plate</p>
                      <p className="font-medium">{vehicle.vehiclePlate}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Total Earnings</p>
                      <p className="font-bold text-green-600">
                        ${vehicle.totalEarnings ? Number(vehicle.totalEarnings).toFixed(2) : "0.00"}
                      </p>
                    </div>
                  </div>
                  <Link href="/driver/vehicle">
                    <Button variant="outline" className="w-full">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Vehicle Details
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="p-12 text-center">
                  <Car className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="font-semibold text-lg mb-2">No Vehicle Registered</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Register your vehicle to start accepting rides
                  </p>
                  <Link href="/driver/vehicle">
                    <Button>Register Vehicle</Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Required Documents</CardTitle>
                <CardDescription>Upload and manage your driver documents</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Profile Photo</p>
                      <p className="text-sm text-muted-foreground">
                        {profile?.profilePhotoUrl ? "Uploaded" : "Not uploaded"}
                      </p>
                    </div>
                  </div>
                  {profile?.profilePhotoUrl ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  )}
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Driver License</p>
                      <p className="text-sm text-muted-foreground">
                        {profile?.dmvLicenseImageUrl || profile?.driverLicenseImageUrl ? "Uploaded" : "Not uploaded"}
                      </p>
                    </div>
                  </div>
                  {(profile?.dmvLicenseImageUrl || profile?.driverLicenseImageUrl) ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  )}
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Car className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Vehicle Documents</p>
                      <p className="text-sm text-muted-foreground">
                        {(vehicleDocuments as any)?.documents?.length || 0} uploaded
                      </p>
                    </div>
                  </div>
                  {(vehicleDocuments as any)?.documents?.length > 0 ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  )}
                </div>

                <Link href="/driver/kyc-documents">
                  <Button className="w-full mt-4">
                    <Upload className="h-4 w-4 mr-2" />
                    Manage Documents
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payouts Tab */}
          <TabsContent value="payouts" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Wallet Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20">
                    <p className="text-sm text-muted-foreground mb-1">Available Balance</p>
                    <p className="text-2xl font-bold text-green-600">
                      ${wallet?.balance ? Number(wallet.balance).toFixed(2) : "0.00"}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20">
                    <p className="text-sm text-muted-foreground mb-1">Negative Balance</p>
                    <p className="text-2xl font-bold text-red-600">
                      ${wallet?.negativeBalance ? Number(wallet.negativeBalance).toFixed(2) : "0.00"}
                    </p>
                  </div>
                </div>
                <Link href="/driver/wallet">
                  <Button variant="outline" className="w-full">
                    View Full Wallet & Payouts
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Account & Security</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/driver/profile">
                  <Button variant="outline" className="w-full justify-start">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Profile Information
                  </Button>
                </Link>
                <Button variant="outline" className="w-full justify-start">
                  <Shield className="h-4 w-4 mr-2" />
                  Change Password
                </Button>
                <Separator />
                <div className="pt-2">
                  <p className="text-sm text-muted-foreground">
                    Email: {profile?.email}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Member since: {new Date().toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
