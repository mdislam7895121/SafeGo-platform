import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  Car, Plus, FileText, Calendar, CheckCircle2, AlertCircle, 
  Clock, XCircle, Edit, ArrowLeft, ChevronRight, Shield, 
  FileCheck, CreditCard, Diamond 
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const getStatusBadge = (status: string) => {
  const config = {
    approved: { variant: "default" as const, icon: CheckCircle2, label: "Approved", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
    expiring: { variant: "outline" as const, icon: AlertCircle, label: "Expiring Soon", className: "border-yellow-500 text-yellow-700 dark:text-yellow-500" },
    pending: { variant: "outline" as const, icon: Clock, label: "Pending", className: "border-gray-400 text-gray-700 dark:text-gray-400" },
    rejected: { variant: "destructive" as const, icon: XCircle, label: "Rejected", className: "" },
    under_review: { variant: "outline" as const, icon: Clock, label: "Under Review", className: "border-blue-500 text-blue-700 dark:text-blue-500" },
  };
  
  const statusConfig = config[status as keyof typeof config] || config.pending;
  return { ...statusConfig };
};

export default function DriverVehicles() {
  const { toast } = useToast();
  const [_, navigate] = useLocation();

  const { data: driverData, isLoading } = useQuery({
    queryKey: ["/api/driver/home"],
  });

  const vehicle = (driverData as any)?.vehicle;
  const profile = (driverData as any)?.profile;

  // Check if driver is in NYC market (include various NYC city name variations)
  const nycCityVariations = ["New York", "New York City", "NYC", "Brooklyn", "Queens", "Manhattan", "Bronx", "Staten Island"];
  const isNYCDriver = nycCityVariations.some(city => 
    profile?.usaCity?.toLowerCase().includes(city.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="bg-background min-h-screen">
        <div className="p-6 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  // Use backend-provided status values directly
  const registrationStatus = vehicle?.registrationStatus || "pending";
  const insuranceStatus = vehicle?.insuranceStatus || "pending";
  const inspectionStatus = vehicle?.inspectionStatus || "pending";
  const tlcStatus = vehicle?.tlcLicenseStatus || "pending";

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/driver/account">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Vehicles</h1>
            <p className="text-sm opacity-90 mt-1">Manage your vehicle and documents</p>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Vehicle Card */}
        {vehicle ? (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10">
                    <Car className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <CardTitle data-testid="text-vehicle-model">{vehicle.vehicleModel}</CardTitle>
                    <CardDescription className="mt-1">
                      <span className="font-medium">{vehicle.vehicleType}</span>
                      {vehicle.licensePlate && (
                        <>
                          {" • "}
                          <span data-testid="text-vehicle-plate">{vehicle.licensePlate}</span>
                        </>
                      )}
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Make & Year</p>
                  <p className="font-medium">{vehicle.make || "N/A"} {vehicle.year || ""}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Color</p>
                  <p className="font-medium capitalize">{vehicle.color || "N/A"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Car className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">No Vehicle Registered</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Register your vehicle to start accepting rides
              </p>
              <Link href="/driver/vehicle">
                <Button data-testid="button-register-vehicle">
                  <Plus className="h-4 w-4 mr-2" />
                  Register Vehicle
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {vehicle && (
          <>
            {/* Vehicle Documents Section */}
            <Card>
              <CardHeader>
                <CardTitle>Vehicle Documents</CardTitle>
                <CardDescription>Required documents for your vehicle</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {/* Vehicle Registration */}
                <div className="flex items-center justify-between p-4 bg-background border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary flex-shrink-0">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">Vehicle Registration</p>
                      <p className="text-xs text-muted-foreground">Required for verification</p>
                    </div>
                  </div>
                  <Badge {...getStatusBadge(registrationStatus)} className={cn(getStatusBadge(registrationStatus).className, "flex-shrink-0")}>
                    {getStatusBadge(registrationStatus).label}
                  </Badge>
                </div>

                {/* Vehicle Insurance */}
                <div className="flex items-center justify-between p-4 bg-background border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary flex-shrink-0">
                      <Shield className="h-6 w-6" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">Vehicle Insurance</p>
                      <p className="text-xs text-muted-foreground">Required for verification</p>
                    </div>
                  </div>
                  <Badge {...getStatusBadge(insuranceStatus)} className={cn(getStatusBadge(insuranceStatus).className, "flex-shrink-0")}>
                    {getStatusBadge(insuranceStatus).label}
                  </Badge>
                </div>

                {/* Vehicle Inspection */}
                <div className="flex items-center justify-between p-4 bg-background border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary flex-shrink-0">
                      <FileCheck className="h-6 w-6" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">Vehicle Inspection</p>
                      <p className="text-xs text-muted-foreground">DMV/NYS Inspection</p>
                    </div>
                  </div>
                  <Badge {...getStatusBadge(inspectionStatus)} className={cn(getStatusBadge(inspectionStatus).className, "flex-shrink-0")}>
                    {getStatusBadge(inspectionStatus).label}
                  </Badge>
                </div>

                {/* License Plate Number */}
                <div className="flex items-center justify-between p-4 bg-background border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary flex-shrink-0">
                      <CreditCard className="h-6 w-6" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">License Plate Number</p>
                      <p className="text-xs text-muted-foreground">Required for all vehicles</p>
                    </div>
                  </div>
                  {vehicle.licensePlate ? (
                    <Badge {...getStatusBadge("approved")} className={cn(getStatusBadge("approved").className, "flex-shrink-0")}>
                      {vehicle.licensePlate}
                    </Badge>
                  ) : (
                    <Badge {...getStatusBadge("pending")} className={cn(getStatusBadge("pending").className, "flex-shrink-0")}>
                      Pending
                    </Badge>
                  )}
                </div>

                {/* TLC License (NYC only) */}
                {isNYCDriver && (
                  <div className="flex items-center justify-between p-4 bg-background border-2 border-primary/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary text-primary-foreground flex-shrink-0">
                        <Diamond className="h-6 w-6" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">TLC License</p>
                        <p className="text-xs text-muted-foreground">Required for NYC drivers</p>
                      </div>
                    </div>
                    {vehicle.tlcLicenseNumber ? (
                      <Badge {...getStatusBadge(tlcStatus)} className={cn(getStatusBadge(tlcStatus).className, "flex-shrink-0")}>
                        {vehicle.tlcLicenseNumber.slice(-4).padStart(vehicle.tlcLicenseNumber.length, '*')}
                      </Badge>
                    ) : (
                      <Badge {...getStatusBadge("pending")} className={cn(getStatusBadge("pending").className, "flex-shrink-0")}>
                        Pending
                      </Badge>
                    )}
                  </div>
                )}

                <Link href="/driver/kyc-documents">
                  <Button className="w-full mt-4" variant="outline" data-testid="button-upload-documents">
                    <FileText className="h-4 w-4 mr-2" />
                    Upload Documents
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
