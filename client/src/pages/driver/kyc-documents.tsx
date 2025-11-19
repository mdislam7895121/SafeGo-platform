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
  }

  const vehicleDocs = (vehicleDocuments as any)?.documents || [];
  const hasVehicleRegistration = vehicleDocs.some((doc: any) => doc.documentType === "registration");
  if (!hasVehicleRegistration) {
    missingFields.push("Vehicle registration document");
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

        {/* Vehicle Documents */}
        <Card>
          <CardHeader>
            <CardTitle>Vehicle Documents</CardTitle>
            <CardDescription>At least one registration document is required</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FileUpload
                label="Registration Document"
                accept="image/*,application/pdf"
                maxSizeMB={10}
                onUpload={async (file) => {
                  const result = await uploadVehicleDocMutation.mutateAsync({
                    file,
                    documentType: "registration",
                  });
                  return { url: result.document.fileUrl };
                }}
                description="Upload vehicle registration"
                testId="registration-doc"
              />

              <FileUpload
                label="Insurance Document"
                accept="image/*,application/pdf"
                maxSizeMB={10}
                onUpload={async (file) => {
                  const result = await uploadVehicleDocMutation.mutateAsync({
                    file,
                    documentType: "insurance",
                  });
                  return { url: result.document.fileUrl };
                }}
                description="Upload insurance certificate"
                testId="insurance-doc"
              />
            </div>

            {docsLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : vehicleDocs.length > 0 ? (
              <div className="space-y-2">
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
                          <p className="text-sm font-medium capitalize">{doc.documentType}</p>
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
