import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Car, Plus, FileText, Calendar, CheckCircle2, AlertCircle, Clock, XCircle, Edit, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

const getStatusBadge = (status: string) => {
  const config = {
    completed: { variant: "default" as const, icon: CheckCircle2, label: "Completed", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
    expiring_soon: { variant: "outline" as const, icon: AlertCircle, label: "Expiring Soon", className: "border-yellow-500 text-yellow-700 dark:text-yellow-500" },
    pending: { variant: "outline" as const, icon: Clock, label: "Pending", className: "border-gray-400 text-gray-700 dark:text-gray-400" },
    rejected: { variant: "destructive" as const, icon: XCircle, label: "Rejected", className: "" },
  };
  
  const statusConfig = config[status as keyof typeof config] || config.pending;
  return { ...statusConfig };
};

export default function DriverVehicles() {
  const { toast } = useToast();

  const { data: driverData, isLoading } = useQuery({
    queryKey: ["/api/driver/home"],
  });

  const { data: vehicleDocuments, isLoading: docsLoading } = useQuery({
    queryKey: ["/api/driver/vehicle-documents"],
  });

  const vehicle = (driverData as any)?.vehicle;
  const documents = (vehicleDocuments as any)?.documents || [];

  if (isLoading || docsLoading) {
    return (
      <div className="bg-background">
        <div className="p-6 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 ">
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
                      {" • "}
                      <span data-testid="text-vehicle-plate">{vehicle.vehiclePlate}</span>
                    </CardDescription>
                  </div>
                </div>
                <Link href="/driver/vehicle">
                  <Button variant="outline" size="sm" data-testid="button-edit-vehicle">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Status</p>
                  <Badge variant={vehicle.isOnline ? "default" : "outline"} className={vehicle.isOnline ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : ""}>
                    {vehicle.isOnline ? "Online" : "Offline"}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Total Earnings</p>
                  <p className="font-semibold" data-testid="text-vehicle-earnings">
                    ${parseFloat(vehicle.totalEarnings || "0").toFixed(2)}
                  </p>
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

        {/* Vehicle Documents */}
        <Card>
          <CardHeader>
            <CardTitle>Vehicle Documents</CardTitle>
            <CardDescription>Required documents for your vehicle</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Registration */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Vehicle Registration</p>
                  <p className="text-xs text-muted-foreground">Required for verification</p>
                </div>
              </div>
              {documents.find((d: any) => d.documentType === "registration") ? (
                <Badge {...getStatusBadge("completed")}>
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Uploaded
                </Badge>
              ) : (
                <Badge {...getStatusBadge("pending")}>
                  <Clock className="h-3 w-3 mr-1" />
                  Pending
                </Badge>
              )}
            </div>

            {/* Insurance */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Vehicle Insurance</p>
                  <p className="text-xs text-muted-foreground">Required for verification</p>
                </div>
              </div>
              {documents.find((d: any) => d.documentType === "insurance") ? (
                <Badge {...getStatusBadge("completed")}>
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Uploaded
                </Badge>
              ) : (
                <Badge {...getStatusBadge("pending")}>
                  <Clock className="h-3 w-3 mr-1" />
                  Pending
                </Badge>
              )}
            </div>

            <Link href="/driver/kyc-documents">
              <Button className="w-full mt-4" variant="outline" data-testid="button-upload-documents">
                <FileText className="h-4 w-4 mr-2" />
                Upload Documents
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* All Vehicle Documents */}
        {documents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Uploaded Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {documents.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium capitalize">{doc.documentType.replace('_', ' ')}</p>
                    <p className="text-xs text-muted-foreground">
                      Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 ml-2">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
