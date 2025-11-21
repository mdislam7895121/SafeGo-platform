import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  Car, Plus, FileText, CheckCircle2, AlertCircle, 
  Clock, XCircle, ArrowLeft, Shield, 
  FileCheck, CreditCard, Diamond 
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type DocumentStatus = "PENDING" | "UNDER_REVIEW" | "APPROVED" | "EXPIRING_SOON" | "EXPIRED" | "REJECTED" | "NEEDS_UPDATE";

const getStatusBadge = (status: DocumentStatus) => {
  const config = {
    APPROVED: { icon: CheckCircle2, label: "Approved", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300" },
    EXPIRING_SOON: { icon: AlertCircle, label: "Expiring Soon", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-300" },
    EXPIRED: { icon: XCircle, label: "Expired", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300" },
    PENDING: { icon: Clock, label: "Pending", className: "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400 border-gray-300" },
    UNDER_REVIEW: { icon: Clock, label: "Under Review", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300" },
    REJECTED: { icon: XCircle, label: "Rejected", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300" },
    NEEDS_UPDATE: { icon: AlertCircle, label: "Needs Update", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-300" },
  };
  
  const statusConfig = config[status] || config.PENDING;
  return { ...statusConfig };
};

export default function DriverVehicles() {
  const { toast } = useToast();
  const [_, navigate] = useLocation();

  const { data: driverData, isLoading } = useQuery({
    queryKey: ["/api/driver/home"],
  });

  const vehicle = (driverData as any)?.vehicle;
  const vehicleDocuments = (driverData as any)?.vehicleDocuments;

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

        {vehicleDocuments && (
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
                  <Badge className={cn(getStatusBadge(vehicleDocuments.registration.status).className, "flex-shrink-0")}>
                    {getStatusBadge(vehicleDocuments.registration.status).label}
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
                  <Badge className={cn(getStatusBadge(vehicleDocuments.insurance.status).className, "flex-shrink-0")}>
                    {getStatusBadge(vehicleDocuments.insurance.status).label}
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
                  <Badge className={cn(getStatusBadge(vehicleDocuments.inspection.status).className, "flex-shrink-0")}>
                    {getStatusBadge(vehicleDocuments.inspection.status).label}
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
                  {vehicleDocuments.plate.plateNumber ? (
                    <Badge className={cn(getStatusBadge("APPROVED").className, "flex-shrink-0")}>
                      {vehicleDocuments.plate.plateNumber}
                    </Badge>
                  ) : (
                    <Badge className={cn(getStatusBadge("PENDING").className, "flex-shrink-0")}>
                      Pending
                    </Badge>
                  )}
                </div>

                {/* TLC License (NYC only) */}
                {vehicleDocuments.requiresTlcCompliance && (
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
                    {vehicleDocuments.tlcLicense.licenseNumber ? (
                      <Badge className={cn(getStatusBadge(vehicleDocuments.tlcLicense.status).className, "flex-shrink-0")}>
                        {vehicleDocuments.tlcLicense.licenseNumber.slice(-4).padStart(vehicleDocuments.tlcLicense.licenseNumber.length, '*')}
                      </Badge>
                    ) : (
                      <Badge className={cn(getStatusBadge("PENDING").className, "flex-shrink-0")}>
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
