import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle, AlertCircle, ChevronRight, Lock, User, Car, Camera, Edit2, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";

export default function DriverKYCDocuments() {
  const { toast } = useToast();
  const [nidNumber, setNidNumber] = useState("");
  const [ssnNumber, setSsnNumber] = useState("");
  const [isEditingNID, setIsEditingNID] = useState(false);
  const [isEditingSSN, setIsEditingSSN] = useState(false);

  const { data: driverData, isLoading } = useQuery({
    queryKey: ["/api/driver/home"],
  });

  const profile = (driverData as any)?.profile;
  const vehicle = (driverData as any)?.vehicle;
  const isUSA = profile?.countryCode === "US";
  const isBD = profile?.countryCode === "BD";
  const isNY = profile?.usaState === "NY";
  
  const cityLower = (profile?.usaCity || "").toLowerCase();
  const isNYC = isNY && (
    cityLower.includes("new york") ||
    cityLower.includes("nyc") ||
    cityLower.includes("brooklyn") ||
    cityLower.includes("queens") ||
    cityLower.includes("manhattan") ||
    cityLower.includes("bronx") ||
    cityLower.includes("staten island")
  );

  const updateNIDMutation = useMutation({
    mutationFn: async (nidNumber: string) => {
      const result = await apiRequest("/api/driver/identity/nid", {
        method: "PUT",
        body: JSON.stringify({ nidNumber }),
        headers: { "Content-Type": "application/json" },
      });
      return result || { success: true };
    },
    onSuccess: () => {
      toast({ title: "Success", description: "NID number updated successfully" });
      setIsEditingNID(false);
      setNidNumber("");
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update NID number", variant: "destructive" });
    },
  });

  const updateSSNMutation = useMutation({
    mutationFn: async (ssn: string) => {
      const result = await apiRequest("/api/driver/identity/ssn", {
        method: "PUT",
        body: JSON.stringify({ ssn }),
        headers: { "Content-Type": "application/json" },
      });
      return result || { success: true };
    },
    onSuccess: () => {
      toast({ title: "Success", description: "SSN updated successfully" });
      setIsEditingSSN(false);
      setSsnNumber("");
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update SSN", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const missingFields: string[] = [];
  if (!profile?.profilePhotoUrl) missingFields.push("Profile photo");
  if (isBD && !profile?.nidEncrypted && !profile?.nidNumber) missingFields.push("National ID (NID)");
  if (isUSA && !profile?.hasSSN) missingFields.push("Social Security Number");
  if (!vehicle) missingFields.push("Vehicle information");

  const driverName = profile?.firstName && profile?.lastName
    ? `${profile.firstName}${profile.middleName ? ` ${profile.middleName}` : ""} ${profile.lastName}`
    : profile?.fullName || "Not set";

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground p-6 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/driver/account">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Identity & Documents</h1>
            <p className="text-sm opacity-90 mt-1">Complete your verification</p>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {missingFields.length > 0 && (
          <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">Missing Information</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    Please complete: {missingFields.join(", ")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Profile Summary Card - Links to Account/Manage */}
        <Card className="hover-elevate" data-testid="card-profile-summary">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <Link href="/driver/account/manage">
                <Button variant="outline" size="sm" data-testid="button-manage-profile">
                  <Edit2 className="h-4 w-4 mr-1" />
                  Manage
                </Button>
              </Link>
            </div>
            <CardDescription>Your personal information and profile photo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className={`h-16 w-16 rounded-full flex items-center justify-center ${
                profile?.profilePhotoUrl ? "bg-primary/10" : "bg-muted"
              }`}>
                {profile?.profilePhotoUrl ? (
                  <img src={profile.profilePhotoUrl} alt="Profile" className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <Camera className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{driverName}</span>
                  <Badge variant="outline" className={profile?.profilePhotoUrl && profile?.firstName 
                    ? "bg-green-50 dark:bg-green-950 text-green-600 border-0" 
                    : "bg-yellow-50 dark:bg-yellow-950 text-yellow-600 border-0"
                  }>
                    {profile?.profilePhotoUrl && profile?.firstName ? (
                      <><CheckCircle className="h-3 w-3 mr-1" />Complete</>
                    ) : (
                      <><AlertCircle className="h-3 w-3 mr-1" />Incomplete</>
                    )}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Summary Card - Links to /driver/vehicle */}
        <Card className="hover-elevate" data-testid="card-vehicle-summary">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Car className="h-5 w-5" />
                Vehicle Information
              </CardTitle>
              <Link href="/driver/vehicle">
                <Button variant="outline" size="sm" data-testid="button-manage-vehicle">
                  <Edit2 className="h-4 w-4 mr-1" />
                  Manage
                </Button>
              </Link>
            </div>
            <CardDescription>Your vehicle details and registration</CardDescription>
          </CardHeader>
          <CardContent>
            {vehicle ? (
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Car className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {vehicle.make || ""} {vehicle.vehicleModel || vehicle.model || "Vehicle"}
                    </span>
                    <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-600 border-0">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Registered
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {vehicle.color || ""} • {vehicle.licensePlate || vehicle.vehiclePlate || "No plate"}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                  <Car className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-muted-foreground">No Vehicle Registered</span>
                    <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950 text-yellow-600 border-0">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Required
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Add your vehicle to start driving</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Documents Summary Card - Links to /driver/documents */}
        <Card className="hover-elevate" data-testid="card-documents-summary">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Driver Documents
              </CardTitle>
              <Link href="/driver/documents">
                <Button variant="outline" size="sm" data-testid="button-manage-documents">
                  <Edit2 className="h-4 w-4 mr-1" />
                  Manage
                </Button>
              </Link>
            </div>
            <CardDescription>Upload driver license, TLC license, and vehicle documents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                profile?.dmvLicenseImageUrl ? "bg-primary/10" : "bg-muted"
              }`}>
                <FileText className={`h-6 w-6 ${profile?.dmvLicenseImageUrl ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {profile?.dmvLicenseImageUrl ? "Documents Uploaded" : "Upload Required"}
                  </span>
                  <Badge variant="outline" className={profile?.dmvLicenseImageUrl 
                    ? "bg-green-50 dark:bg-green-950 text-green-600 border-0" 
                    : "bg-yellow-50 dark:bg-yellow-950 text-yellow-600 border-0"
                  }>
                    {profile?.dmvLicenseImageUrl ? (
                      <><CheckCircle className="h-3 w-3 mr-1" />Submitted</>
                    ) : (
                      <><AlertCircle className="h-3 w-3 mr-1" />Pending</>
                    )}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {isNYC ? "DMV License, TLC License, Vehicle docs" : "DMV License, Vehicle documents"}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Identity Verification - SSN/NID - ONLY EDITABLE FIELDS ON THIS PAGE */}
        {(isUSA || isBD) && (
          <Card data-testid="card-identity-verification">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Identity Verification
              </CardTitle>
              <CardDescription>
                {isUSA ? "Social Security Number for background check" : "National ID for verification"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isBD && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nidNumber">National ID (NID) Number</Label>
                    {profile?.nidNumber && !isEditingNID ? (
                      <div className="flex items-center gap-2">
                        <Input
                          id="nidNumber"
                          value={profile?.nidNumber || ""}
                          disabled
                          data-testid="input-nid-masked"
                          className="bg-muted"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditingNID(true)}
                          data-testid="button-edit-nid"
                        >
                          Edit
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          id="nidNumber"
                          value={nidNumber}
                          onChange={(e) => setNidNumber(e.target.value.replace(/\D/g, ""))}
                          placeholder="Enter 10-17 digit NID"
                          maxLength={17}
                          data-testid="input-nid"
                        />
                        <Button
                          onClick={() => updateNIDMutation.mutate(nidNumber)}
                          disabled={!nidNumber || nidNumber.length < 10 || updateNIDMutation.isPending}
                          data-testid="button-save-nid"
                        >
                          {updateNIDMutation.isPending ? "Saving..." : "Save"}
                        </Button>
                        {isEditingNID && (
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setIsEditingNID(false);
                              setNidNumber("");
                            }}
                            data-testid="button-cancel-nid"
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Enter your 10-17 digit National ID number
                    </p>
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Upload your NID image in the{" "}
                      <Link href="/driver/documents" className="text-primary hover:underline font-medium">
                        Documents section
                      </Link>
                    </p>
                  </div>
                </div>
              )}

              {isUSA && (
                <div className="space-y-2">
                  <Label htmlFor="ssnNumber">Social Security Number (SSN)</Label>
                  {profile?.hasSSN && !isEditingSSN ? (
                    <div className="flex items-center gap-2">
                      <Input
                        id="ssnNumber"
                        value={profile?.ssnMasked || "***-**-****"}
                        disabled
                        data-testid="input-ssn-masked"
                        className="bg-muted font-mono"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingSSN(true)}
                        data-testid="button-edit-ssn"
                      >
                        Edit
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        id="ssnNumber"
                        value={ssnNumber}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^\d-]/g, "");
                          setSsnNumber(value);
                        }}
                        placeholder="XXX-XX-XXXX"
                        maxLength={11}
                        data-testid="input-ssn"
                      />
                      <Button
                        onClick={() => updateSSNMutation.mutate(ssnNumber)}
                        disabled={!ssnNumber || ssnNumber.replace(/\D/g, "").length !== 9 || updateSSNMutation.isPending}
                        data-testid="button-save-ssn"
                      >
                        {updateSSNMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                      {isEditingSSN && (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setIsEditingSSN(false);
                            setSsnNumber("");
                          }}
                          data-testid="button-cancel-ssn"
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Enter your 9-digit Social Security Number (format: XXX-XX-XXXX or XXXXXXXXX)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">
            Need help?{" "}
            <Link href="/driver/support-help-center" className="text-primary hover:underline">
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
