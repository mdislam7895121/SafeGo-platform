import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Shield, FileText, User, Calendar, CheckCircle, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function CustomerKYC() {
  const { data: profileData, isLoading } = useQuery({
    queryKey: ["/api/customer/profile"],
  });

  const profile = profileData;

  const maskNID = (nid: string | null | undefined): string => {
    if (!nid) return "Not provided";
    if (nid.length <= 4) return nid;
    return `${"*".repeat(nid.length - 4)}${nid.slice(-4)}`;
  };

  const getStatusBadge = (status: string, isVerified: boolean) => {
    if (isVerified) {
      return (
        <Badge variant="default" className="gap-1">
          <CheckCircle className="h-3 w-3" />
          Approved
        </Badge>
      );
    }
    
    if (status === "rejected") {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Rejected
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" />
        Pending Review
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const isBD = profile?.countryCode === "BD";
  const isUS = profile?.countryCode === "US";

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/customer/profile">
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground"
              data-testid="button-back"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">KYC & Documents</h1>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Verification Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Verification Status
              </CardTitle>
              {getStatusBadge(profile?.verificationStatus || "pending", profile?.isVerified || false)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Current Status</p>
                <p className="font-medium" data-testid="text-status">
                  {profile?.verificationStatus || "Pending"}
                </p>
              </div>

              {profile?.rejectionReason && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
                  <p className="text-sm font-medium text-destructive">Rejection Reason:</p>
                  <p className="text-sm text-destructive/90 mt-1">{profile.rejectionReason}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Please update your information and contact support.
                  </p>
                </div>
              )}

              {!profile?.isVerified && !profile?.rejectionReason && (
                <div className="bg-muted rounded-md p-4">
                  <p className="text-sm text-muted-foreground">
                    Your documents are under review by our admin team. You'll receive a notification once verification is complete.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bangladesh KYC Information */}
        {isBD && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Information (Bangladesh)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Father's Name</p>
                  <p className="font-medium" data-testid="text-father-name">
                    {profile?.fatherName || "Not provided"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Date of Birth</p>
                  <p className="font-medium" data-testid="text-dob">
                    {profile?.dateOfBirth
                      ? new Date(profile.dateOfBirth).toLocaleDateString()
                      : "Not provided"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Present Address</p>
                  <p className="font-medium" data-testid="text-present-address">
                    {profile?.presentAddress || "Not provided"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Permanent Address</p>
                  <p className="font-medium" data-testid="text-permanent-address">
                    {profile?.permanentAddress || "Not provided"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">District (Zilla)</p>
                  <p className="font-medium">
                    {profile?.district || "Not provided"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Upazila / Thana</p>
                  <p className="font-medium">
                    {profile?.thana || "Not provided"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  National ID (NID)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">NID Number (Masked)</p>
                  <p className="font-medium font-mono" data-testid="text-nid-masked">
                    {maskNID(profile?.nidNumber)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    For security, only last 4 digits are shown
                  </p>
                </div>

                {(profile?.nidFrontImageUrl || profile?.nidBackImageUrl) && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Document Images:</p>
                    <div className="grid grid-cols-2 gap-4">
                      {profile?.nidFrontImageUrl && (
                        <div className="border rounded-md p-2">
                          <img
                            src={profile.nidFrontImageUrl}
                            alt="NID Front"
                            className="w-full h-32 object-cover rounded"
                            data-testid="img-nid-front"
                          />
                          <p className="text-xs text-center mt-1 text-muted-foreground">
                            NID Front
                          </p>
                        </div>
                      )}
                      {profile?.nidBackImageUrl && (
                        <div className="border rounded-md p-2">
                          <img
                            src={profile.nidBackImageUrl}
                            alt="NID Back"
                            className="w-full h-32 object-cover rounded"
                            data-testid="img-nid-back"
                          />
                          <p className="text-xs text-center mt-1 text-muted-foreground">
                            NID Back
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!profile?.nidFrontImageUrl && !profile?.nidBackImageUrl && (
                  <div className="bg-muted rounded-md p-4">
                    <p className="text-sm text-muted-foreground">
                      No NID images uploaded. Contact support to upload documents.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* US KYC Information */}
        {isUS && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Information (United States)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Date of Birth</p>
                  <p className="font-medium" data-testid="text-dob">
                    {profile?.dateOfBirth
                      ? new Date(profile.dateOfBirth).toLocaleDateString()
                      : "Not provided"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Home Address</p>
                  <p className="font-medium" data-testid="text-home-address">
                    {profile?.homeAddress || "Not provided"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Government ID
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">ID Type</p>
                  <p className="font-medium" data-testid="text-id-type">
                    {profile?.governmentIdType?.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) || "Not provided"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">ID Last 4 Digits</p>
                  <p className="font-medium font-mono" data-testid="text-id-last4">
                    {profile?.governmentIdLast4 ? `****${profile.governmentIdLast4}` : "Not provided"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    For security, only last 4 digits are shown
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Emergency Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Emergency Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium" data-testid="text-emergency-name">
                {profile?.emergencyContactName || "Not provided"}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium" data-testid="text-emergency-phone">
                {profile?.emergencyContactPhone || "Not provided"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Help Card */}
        <Card className="bg-muted">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-2">Need to update your information?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Contact our support team to update your KYC documents or personal information.
            </p>
            <Link href="/customer/support">
              <Button variant="outline" size="sm" data-testid="button-contact-support">
                Contact Support
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
