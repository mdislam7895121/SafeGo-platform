import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { FileUpload } from "@/components/file-upload";
import { useState, useEffect } from "react";

export default function DriverKYCDocuments() {
  const { toast } = useToast();
  const [usaNameForm, setUsaNameForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
  });
  const [formInitialized, setFormInitialized] = useState(false);
  const [nidNumber, setNidNumber] = useState("");
  const [ssnNumber, setSsnNumber] = useState("");
  const [isEditingNID, setIsEditingNID] = useState(false);
  const [isEditingSSN, setIsEditingSSN] = useState(false);

  const { data: driverData, isLoading } = useQuery({
    queryKey: ["/api/driver/home"],
  });

  const { data: vehicleDocuments, isLoading: docsLoading } = useQuery({
    queryKey: ["/api/driver/vehicle-documents"],
  });

  const profile = (driverData as any)?.profile;
  const isUSA = profile?.countryCode === "US";
  const isBD = profile?.countryCode === "BD";
  const isNY = profile?.usaState === "NY";
  
  // Check if driver is in NYC (for TLC requirements)
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

  // Initialize USA name form when driver data loads
  useEffect(() => {
    if (profile && profile.firstName && !formInitialized) {
      setUsaNameForm({
        firstName: profile.firstName || "",
        middleName: profile.middleName || "",
        lastName: profile.lastName || "",
      });
      setFormInitialized(true);
    }
  }, [profile, formInitialized]);

  // Helper for multipart form uploads using apiRequest
  const uploadFile = async (endpoint: string, fieldName: string, file: File, extraData?: Record<string, string>) => {
    const formData = new FormData();
    formData.append(fieldName, file);
    if (extraData) {
      Object.entries(extraData).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }
    const response = await apiRequest("POST", endpoint, formData);
    // Handle empty responses (204 No Content or no body)
    if (response.status === 204) {
      return { success: true };
    }
    // Try to parse JSON, return success object if empty
    try {
      const text = await response.text();
      if (!text) {
        return { success: true };
      }
      return JSON.parse(text);
    } catch (error) {
      return { success: true };
    }
  };

  // Upload mutations
  const uploadProfilePhotoMutation = useMutation({
    mutationFn: async (file: File) => uploadFile("/api/driver/upload/profile-photo", "profilePhoto", file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
    },
  });

  const uploadDMVLicenseMutation = useMutation({
    mutationFn: async (file: File) => uploadFile("/api/driver/upload/dmv-license", "licenseImage", file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
    },
  });

  const uploadTLCLicenseMutation = useMutation({
    mutationFn: async (file: File) => uploadFile("/api/driver/upload/tlc-license", "licenseImage", file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
    },
  });

  const uploadVehicleDocMutation = useMutation({
    mutationFn: async ({ file, documentType }: { file: File; documentType: string }) =>
      uploadFile("/api/driver/upload/vehicle-document", "document", file, { documentType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/vehicle-documents"] });
    },
  });

  const uploadNIDImageMutation = useMutation({
    mutationFn: async (file: File) => uploadFile("/api/driver/upload/nid-image", "licenseImage", file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
    },
  });

  const uploadSSNCardMutation = useMutation({
    mutationFn: async (file: File) => uploadFile("/api/driver/upload/ssn-card", "licenseImage", file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
    },
  });

  const updateNIDMutation = useMutation({
    mutationFn: async (nidNumber: string) => {
      const response = await apiRequest("PUT", "/api/driver/identity/nid", { nidNumber });
      if (response.status === 204 || response.status === 200) {
        return { success: true };
      }
      try {
        const text = await response.text();
        return text ? JSON.parse(text) : { success: true };
      } catch {
        return { success: true };
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "NID number updated successfully",
      });
      setIsEditingNID(false);
      setNidNumber("");
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update NID number",
        variant: "destructive",
      });
    },
  });

  const updateSSNMutation = useMutation({
    mutationFn: async (ssn: string) => {
      const response = await apiRequest("PUT", "/api/driver/identity/ssn", { ssn });
      if (response.status === 204 || response.status === 200) {
        return { success: true };
      }
      try {
        const text = await response.text();
        return text ? JSON.parse(text) : { success: true };
      } catch {
        return { success: true };
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "SSN updated successfully",
      });
      setIsEditingSSN(false);
      setSsnNumber("");
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update SSN",
        variant: "destructive",
      });
    },
  });

  const updateUSANameMutation = useMutation({
    mutationFn: async (data: typeof usaNameForm) => {
      // Validate required fields
      if (!data.firstName?.trim() || !data.lastName?.trim()) {
        throw new Error("First name and last name are required");
      }
      const response = await apiRequest("PUT", "/api/driver/usa-name", data);
      // Handle empty responses (204 No Content or no body)
      if (response.status === 204) {
        return { success: true };
      }
      try {
        const text = await response.text();
        if (!text) {
          return { success: true };
        }
        return JSON.parse(text);
      } catch (error) {
        return { success: true };
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Name updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update name",
        variant: "destructive",
      });
    },
  });

  // Initialize USA name form when profile loads
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // Check KYC completeness
  const missingFields: string[] = [];
  
  if (!profile?.profilePhotoUrl) {
    missingFields.push("Profile photo");
  }

  if (isBD) {
    if (!profile?.nidEncrypted && !profile?.nidNumber) {
      missingFields.push("National ID (NID)");
    }
  }

  if (isUSA) {
    if (!profile?.firstName) missingFields.push("First name");
    if (!profile?.lastName) missingFields.push("Last name");
    if (!profile?.dmvLicenseImageUrl) missingFields.push("DMV license");
    if (isNY && !profile?.tlcLicenseImageUrl) missingFields.push("TLC license");
    // Identity documents for USA
    if (!profile?.hasSSN) missingFields.push("Social Security Number");
    if (!profile?.ssnCardImageUrl) missingFields.push("SSN card image");
  }

  if (isBD) {
    // Identity documents for Bangladesh
    if (!profile?.hasNID) missingFields.push("National ID Number");
    if (!profile?.nidImageUrl) missingFields.push("NID image");
  }

  const vehicleDocs = (vehicleDocuments as any)?.documents || [];
  const hasVehicleRegistration = vehicleDocs.some((doc: any) => doc.documentType === "registration");
  const hasVehicleInsurance = vehicleDocs.some((doc: any) => doc.documentType === "insurance");
  const hasVehicleInspection = vehicleDocs.some((doc: any) => doc.documentType === "vehicleInspection");
  const hasDriverLicenseVehicle = vehicleDocs.some((doc: any) => doc.documentType === "driverLicenseVehicle");
  const hasLicensePlate = vehicleDocs.some((doc: any) => doc.documentType === "licensePlate");
  const hasTLCDiamond = vehicleDocs.some((doc: any) => doc.documentType === "tlcDiamond");

  // Check all required vehicle documents
  if (!hasVehicleRegistration) {
    missingFields.push("Vehicle registration document");
  }
  
  if (!hasVehicleInsurance) {
    missingFields.push("Vehicle insurance document");
  }
  
  if (!hasVehicleInspection) {
    missingFields.push("Vehicle inspection document");
  }
  
  if (!hasDriverLicenseVehicle) {
    missingFields.push("Driver license document");
  }
  
  if (!hasLicensePlate) {
    missingFields.push("License plate document");
  }
  
  // NYC-specific requirements
  if (isNYC && !hasTLCDiamond) {
    missingFields.push("TLC Diamond document");
  }

  const isKYCComplete = missingFields.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/driver/profile">
              <Button variant="ghost" size="sm" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Profile
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">KYC Documents</h1>
          </div>
          <Badge variant={isKYCComplete ? "default" : "secondary"} data-testid="badge-kyc-status">
            {isKYCComplete ? (
              <><CheckCircle className="h-4 w-4 mr-1" /> Complete</>
            ) : (
              <><AlertCircle className="h-4 w-4 mr-1" /> Incomplete</>
            )}
          </Badge>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-4xl">
        {/* KYC Status Card */}
        {!isKYCComplete && (
          <Card className="border-warning bg-warning/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-warning">
                <AlertCircle className="h-5 w-5" />
                Missing Required Documents
              </CardTitle>
              <CardDescription>
                Please upload the following to complete your KYC verification:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1">
                {missingFields.map((field) => (
                  <li key={field} className="text-sm">{field}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Profile Photo */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Photo</CardTitle>
            <CardDescription>Required for all drivers</CardDescription>
          </CardHeader>
          <CardContent>
            <FileUpload
              label="Profile Photo"
              accept="image/*"
              maxSizeMB={5}
              currentFileUrl={profile?.profilePhotoUrl}
              onUpload={async (file) => {
                const result = await uploadProfilePhotoMutation.mutateAsync(file);
                return { url: result.profilePhotoUrl };
              }}
              testId="profile-photo"
            />
          </CardContent>
        </Card>

        {/* USA Driver Fields */}
        {isUSA && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Legal Name</CardTitle>
                <CardDescription>Required for USA drivers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      data-testid="input-firstname"
                      value={usaNameForm.firstName}
                      onChange={(e) => setUsaNameForm({ ...usaNameForm, firstName: e.target.value })}
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <Label htmlFor="middleName">Middle Name</Label>
                    <Input
                      id="middleName"
                      data-testid="input-middlename"
                      value={usaNameForm.middleName}
                      onChange={(e) => setUsaNameForm({ ...usaNameForm, middleName: e.target.value })}
                      placeholder="Michael"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      data-testid="input-lastname"
                      value={usaNameForm.lastName}
                      onChange={(e) => setUsaNameForm({ ...usaNameForm, lastName: e.target.value })}
                      placeholder="Doe"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => updateUSANameMutation.mutate(usaNameForm)}
                  disabled={!usaNameForm.firstName || !usaNameForm.lastName || updateUSANameMutation.isPending}
                  data-testid="button-save-name"
                >
                  {updateUSANameMutation.isPending ? "Saving..." : "Save Name"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>DMV Driver License</CardTitle>
                <CardDescription>Required for all USA drivers</CardDescription>
              </CardHeader>
              <CardContent>
                <FileUpload
                  label="DMV License Image"
                  accept="image/*"
                  maxSizeMB={5}
                  currentFileUrl={profile?.dmvLicenseImageUrl}
                  onUpload={async (file) => {
                    const result = await uploadDMVLicenseMutation.mutateAsync(file);
                    return { url: result.dmvLicenseImageUrl };
                  }}
                  testId="dmv-license"
                />
              </CardContent>
            </Card>

            {isNY && (
              <Card>
                <CardHeader>
                  <CardTitle>TLC License</CardTitle>
                  <CardDescription>Required for NY state drivers</CardDescription>
                </CardHeader>
                <CardContent>
                  <FileUpload
                    label="TLC License Image"
                    accept="image/*"
                    maxSizeMB={5}
                    currentFileUrl={profile?.tlcLicenseImageUrl}
                    onUpload={async (file) => {
                      const result = await uploadTLCLicenseMutation.mutateAsync(file);
                      return { url: result.tlcLicenseImageUrl };
                    }}
                    testId="tlc-license"
                  />
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Identity Documents Section */}
        {(isBD || isUSA) && (
          <Card>
            <CardHeader>
              <CardTitle>Identity Documents</CardTitle>
              <CardDescription>Country-specific identity verification documents</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Bangladesh - NID */}
              {isBD && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="nidNumber">National ID Number (NID)</Label>
                    {profile?.hasNID && !isEditingNID ? (
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

                  <div className="space-y-2">
                    <h4 className="font-medium">NID Image</h4>
                    <p className="text-sm text-muted-foreground">Upload a clear photo of your National ID card</p>
                    <FileUpload
                      label=""
                      accept="image/*"
                      maxSizeMB={5}
                      currentFileUrl={profile?.nidImageUrl}
                      onUpload={async (file) => {
                        const result = await uploadNIDImageMutation.mutateAsync(file);
                        return { url: result.nidImageUrl };
                      }}
                      testId="nid-image"
                    />
                  </div>
                </>
              )}

              {/* USA - SSN */}
              {isUSA && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="ssnNumber">Social Security Number (SSN)</Label>
                    {profile?.hasSSN && !isEditingSSN ? (
                      <div className="flex items-center gap-2">
                        <Input
                          id="ssnNumber"
                          value={profile?.ssnMasked || ""}
                          disabled
                          data-testid="input-ssn-masked"
                          className="bg-muted"
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
                            // Allow digits and dashes only
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

                  <div className="space-y-2">
                    <h4 className="font-medium">SSN Card Image</h4>
                    <p className="text-sm text-muted-foreground">Upload a clear photo of your Social Security card</p>
                    <FileUpload
                      label=""
                      accept="image/*"
                      maxSizeMB={5}
                      currentFileUrl={profile?.ssnCardImageUrl}
                      onUpload={async (file) => {
                        const result = await uploadSSNCardMutation.mutateAsync(file);
                        return { url: result.ssnCardImageUrl };
                      }}
                      testId="ssn-card"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Vehicle Documents */}
        <Card>
          <CardHeader>
            <CardTitle>Vehicle Documents</CardTitle>
            <CardDescription>Upload all required documents for your vehicle</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Registration Document */}
            <div className="space-y-2">
              <h4 className="font-medium">Registration Document</h4>
              <p className="text-sm text-muted-foreground">Upload vehicle registration</p>
              <FileUpload
                label=""
                accept="image/*,application/pdf"
                maxSizeMB={10}
                onUpload={async (file) => {
                  const result = await uploadVehicleDocMutation.mutateAsync({
                    file,
                    documentType: "registration",
                  });
                  return { url: result.document.fileUrl };
                }}
                testId="registration-doc"
              />
            </div>

            {/* Insurance Document */}
            <div className="space-y-2">
              <h4 className="font-medium">Insurance Document</h4>
              <p className="text-sm text-muted-foreground">Upload insurance certificate</p>
              <FileUpload
                label=""
                accept="image/*,application/pdf"
                maxSizeMB={10}
                onUpload={async (file) => {
                  const result = await uploadVehicleDocMutation.mutateAsync({
                    file,
                    documentType: "insurance",
                  });
                  return { url: result.document.fileUrl };
                }}
                testId="insurance-doc"
              />
            </div>

            {/* Vehicle Inspection */}
            <div className="space-y-2">
              <h4 className="font-medium">Vehicle Inspection</h4>
              <p className="text-sm text-muted-foreground">Upload official inspection report</p>
              <FileUpload
                label=""
                accept="image/*,application/pdf"
                maxSizeMB={10}
                onUpload={async (file) => {
                  const result = await uploadVehicleDocMutation.mutateAsync({
                    file,
                    documentType: "vehicleInspection",
                  });
                  return { url: result.document.fileUrl };
                }}
                testId="vehicle-inspection-doc"
              />
            </div>

            {/* Driver License (Vehicle Section) */}
            <div className="space-y-2">
              <h4 className="font-medium">Driver License</h4>
              <p className="text-sm text-muted-foreground">Upload a clear photo of your driver license</p>
              <FileUpload
                label=""
                accept="image/*"
                maxSizeMB={10}
                onUpload={async (file) => {
                  const result = await uploadVehicleDocMutation.mutateAsync({
                    file,
                    documentType: "driverLicenseVehicle",
                  });
                  return { url: result.document.fileUrl };
                }}
                testId="driver-license-vehicle-doc"
              />
            </div>

            {/* License Plate */}
            <div className="space-y-2">
              <h4 className="font-medium">License Plate</h4>
              <p className="text-sm text-muted-foreground">Upload a clear photo showing the plate number</p>
              <FileUpload
                label=""
                accept="image/*"
                maxSizeMB={10}
                onUpload={async (file) => {
                  const result = await uploadVehicleDocMutation.mutateAsync({
                    file,
                    documentType: "licensePlate",
                  });
                  return { url: result.document.fileUrl };
                }}
                testId="license-plate-doc"
              />
            </div>

            {/* TLC Diamond (NYC only) */}
            {isNYC && (
              <div className="space-y-2 p-4 bg-primary/5 border-2 border-primary/20 rounded-lg">
                <h4 className="font-medium">TLC Diamond</h4>
                <p className="text-sm text-muted-foreground">Upload a clear photo of the TLC Diamond/medallion</p>
                <FileUpload
                  label=""
                  accept="image/*"
                  maxSizeMB={10}
                  onUpload={async (file) => {
                    const result = await uploadVehicleDocMutation.mutateAsync({
                      file,
                      documentType: "tlcDiamond",
                    });
                    return { url: result.document.fileUrl };
                  }}
                  testId="tlc-diamond-doc"
                />
              </div>
            )}

            {/* Uploaded Documents List */}
            {docsLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : vehicleDocs.length > 0 ? (
              <div className="space-y-2 pt-4 border-t">
                <h4 className="text-sm font-medium">Uploaded Documents</h4>
                <div className="space-y-2">
                  {vehicleDocs.map((doc: any) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                      data-testid={`document-${doc.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">
                            {doc.documentType === "vehicleInspection" ? "Vehicle Inspection" :
                             doc.documentType === "driverLicenseVehicle" ? "Driver License" :
                             doc.documentType === "licensePlate" ? "License Plate" :
                             doc.documentType === "tlcDiamond" ? "TLC Diamond" :
                             doc.documentType === "registration" ? "Registration" :
                             doc.documentType === "insurance" ? "Insurance" :
                             doc.documentType.charAt(0).toUpperCase() + doc.documentType.slice(1)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                        data-testid={`link-vehicle-doc-${doc.id}`}
                      >
                        View
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
