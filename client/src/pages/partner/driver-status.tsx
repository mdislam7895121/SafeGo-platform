import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Clock, CheckCircle, XCircle, FileText, Car, User, Shield, Loader2, AlertTriangle, Ban, Upload, HelpCircle, Home, ArrowRight } from "lucide-react";
import { Link } from "wouter";

interface DriverProfile {
  id: string;
  driverType: string;
  verificationStatus: string;
  rejectionReason?: string | null;
  missingItems?: string[];
  hasNycCompliance?: boolean;
  operatingCity?: string;
  firstName?: string;
  lastName?: string;
}

interface RegistrationStatus {
  profile: DriverProfile | null;
  hasProfile: boolean;
  isComplete: boolean;
  isApproved: boolean;
}

type VerificationState = 'pending' | 'under_review' | 'approved' | 'rejected' | 'needs_more_info' | 'blocked';

export default function DriverStatus() {
  const { user } = useAuth();
  
  const { data: status, isLoading, error } = useQuery<RegistrationStatus>({
    queryKey: ['/api/partner-driver/registration/status/ride'],
    queryFn: async () => {
      return await apiRequest('/api/partner-driver/registration/status/ride', { method: 'GET' });
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-testid="loading-driver-status">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading your application status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>Unable to Load Status</CardTitle>
            <CardDescription>
              We couldn't load your application status. Please try again later.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild data-testid="button-back-home-error">
              <Link href="/">
                <Home className="h-4 w-4 mr-2" />
                Back to Home
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const profile = status?.profile;
  const rawStatus = profile?.verificationStatus || 'pending';
  
  const normalizeStatus = (status: string): VerificationState => {
    const normalized = status.toLowerCase().replace(/_/g, '_');
    if (normalized === 'under_review') return 'under_review';
    if (normalized === 'approved') return 'approved';
    if (normalized === 'rejected') return 'rejected';
    if (normalized === 'needs_more_info') return 'needs_more_info';
    if (normalized === 'blocked') return 'blocked';
    return 'pending';
  };

  const verificationStatus = normalizeStatus(rawStatus);

  const getStatusBadge = () => {
    switch (verificationStatus) {
      case 'approved':
        return <Badge className="bg-green-600 text-white" data-testid="badge-status-approved">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive" data-testid="badge-status-rejected">Rejected</Badge>;
      case 'needs_more_info':
        return <Badge className="bg-orange-500 text-white" data-testid="badge-status-needs-info">More Info Needed</Badge>;
      case 'blocked':
        return <Badge variant="destructive" data-testid="badge-status-blocked">Account Blocked</Badge>;
      case 'under_review':
      case 'pending':
      default:
        return <Badge variant="secondary" data-testid="badge-status-pending">Pending Review</Badge>;
    }
  };

  const getStatusIcon = () => {
    switch (verificationStatus) {
      case 'approved':
        return <CheckCircle className="h-16 w-16 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-16 w-16 text-destructive" />;
      case 'needs_more_info':
        return <AlertTriangle className="h-16 w-16 text-orange-500" />;
      case 'blocked':
        return <Ban className="h-16 w-16 text-destructive" />;
      case 'under_review':
      case 'pending':
      default:
        return <Clock className="h-16 w-16 text-amber-500" />;
    }
  };

  const getStatusContent = () => {
    switch (verificationStatus) {
      case 'approved':
        return {
          title: "You're Approved!",
          description: "Your driver account has been approved. You can now go online and start receiving ride, food, and parcel requests."
        };
      case 'rejected':
        return {
          title: "Application Rejected",
          description: profile?.rejectionReason || "Your application was not approved. Please review the reason and update your documents if needed."
        };
      case 'needs_more_info':
        return {
          title: "More Information Required",
          description: "We need additional information or documents to complete your verification. Please upload the missing items."
        };
      case 'blocked':
        return {
          title: "Account Blocked",
          description: "Your account has been blocked by SafeGo. Please contact support if you believe this is a mistake."
        };
      case 'under_review':
      case 'pending':
      default:
        return {
          title: "Your Application Is Under Review",
          description: "Our team is reviewing your documents. This usually takes 24-48 hours. We'll notify you once the review is complete."
        };
    }
  };

  const statusContent = getStatusContent();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Main Status Card */}
        <Card className="text-center">
          <CardHeader className="pb-4">
            <div className="flex justify-center mb-4">
              {getStatusIcon()}
            </div>
            <CardTitle className="text-2xl" data-testid="text-status-title">{statusContent.title}</CardTitle>
            <CardDescription className="text-base mt-2" data-testid="text-status-description">
              {statusContent.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              {getStatusBadge()}
            </div>
          </CardContent>
        </Card>

        {/* Application Details Card */}
        {profile && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Application Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Name:</span>
                </div>
                <span data-testid="text-driver-name">
                  {profile.firstName} {profile.lastName}
                </span>
                
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Driver Type:</span>
                </div>
                <span className="capitalize" data-testid="text-driver-type">{profile.driverType}</span>
                
                {profile.hasNycCompliance && (
                  <>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Operating Zone:</span>
                    </div>
                    <Badge variant="secondary" className="w-fit" data-testid="badge-nyc-compliance">
                      NYC TLC Zone
                    </Badge>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending/Under Review Info Card */}
        {(verificationStatus === 'pending' || verificationStatus === 'under_review') && (
          <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    What happens next?
                  </p>
                  <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
                    <li>Our team will verify your documents</li>
                    <li>We may run a background check</li>
                    <li>You'll receive a notification when approved</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Needs More Info Card */}
        {verificationStatus === 'needs_more_info' && (
          <Card className="bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-3 flex-1">
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                    Missing Documents or Information
                  </p>
                  {profile?.missingItems && profile.missingItems.length > 0 ? (
                    <ul className="text-sm text-orange-700 dark:text-orange-300 space-y-1 list-disc list-inside">
                      {profile.missingItems.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-orange-700 dark:text-orange-300">
                      Please check your email for details about what's needed.
                    </p>
                  )}
                  <Button size="sm" className="mt-2" asChild data-testid="button-upload-missing">
                    <Link href="/partner/driver-registration">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Missing Documents
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rejected Info Card */}
        {verificationStatus === 'rejected' && (
          <Card className="bg-destructive/10 border-destructive/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <div className="space-y-3 flex-1">
                  <p className="text-sm font-medium text-destructive">
                    Need help?
                  </p>
                  <p className="text-sm text-muted-foreground">
                    If you believe this was a mistake or need to update your documents, please contact our support team or try resubmitting your application.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild data-testid="button-contact-support">
                      <Link href="/support">
                        <HelpCircle className="h-4 w-4 mr-2" />
                        Contact Support
                      </Link>
                    </Button>
                    <Button size="sm" asChild data-testid="button-update-documents">
                      <Link href="/partner/driver-registration">
                        <Upload className="h-4 w-4 mr-2" />
                        Update Documents
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Blocked Info Card */}
        {verificationStatus === 'blocked' && (
          <Card className="bg-destructive/10 border-destructive/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Ban className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <div className="space-y-3 flex-1">
                  <p className="text-sm font-medium text-destructive">
                    Account Suspended
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Your account has been blocked. This may be due to a policy violation or pending investigation. Please contact our support team for more information.
                  </p>
                  <Button variant="outline" size="sm" asChild data-testid="button-contact-support-blocked">
                    <Link href="/support">
                      <HelpCircle className="h-4 w-4 mr-2" />
                      Contact Support
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Approved Action Button */}
        {verificationStatus === 'approved' && (
          <div className="space-y-3">
            <Button className="w-full" size="lg" asChild data-testid="button-go-to-driver">
              <Link href="/driver/map">
                Open Driver Dashboard
                <ArrowRight className="h-5 w-5 ml-2" />
              </Link>
            </Button>
          </div>
        )}

        {/* Back to Home Button - Always visible and clickable */}
        <div className="text-center pt-4">
          <Button 
            variant="ghost" 
            asChild 
            className="cursor-pointer hover:bg-accent focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            data-testid="button-back-home"
          >
            <Link href="/">
              <Home className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
