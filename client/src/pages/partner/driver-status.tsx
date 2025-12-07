import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Clock, CheckCircle, XCircle, FileText, Car, User, Shield, Loader2 } from "lucide-react";
import { Link } from "wouter";

interface DriverProfile {
  id: string;
  driverType: string;
  verificationStatus: string;
  rejectionReason?: string | null;
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

export default function DriverStatus() {
  const { user } = useAuth();
  
  const { data: status, isLoading } = useQuery<RegistrationStatus>({
    queryKey: ['/api/partner-driver/registration/status/ride'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/partner-driver/registration/status/ride');
      return response.json();
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const profile = status?.profile;
  const verificationStatus = profile?.verificationStatus || 'pending';

  const getStatusBadge = () => {
    switch (verificationStatus) {
      case 'approved':
        return <Badge className="bg-green-600" data-testid="badge-status-approved">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive" data-testid="badge-status-rejected">Rejected</Badge>;
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
      case 'pending':
      default:
        return <Clock className="h-16 w-16 text-amber-500" />;
    }
  };

  const getStatusMessage = () => {
    switch (verificationStatus) {
      case 'approved':
        return {
          title: "Your Application Has Been Approved!",
          description: "Congratulations! You can now start accepting rides on SafeGo."
        };
      case 'rejected':
        return {
          title: "Your Application Was Not Approved",
          description: profile?.rejectionReason || "Please contact support for more information."
        };
      case 'pending':
      default:
        return {
          title: "Your Application Is Under Review",
          description: "Our team is reviewing your documents. This usually takes 24-48 hours. We'll notify you once the review is complete."
        };
    }
  };

  const statusMessage = getStatusMessage();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="text-center">
          <CardHeader className="pb-4">
            <div className="flex justify-center mb-4">
              {getStatusIcon()}
            </div>
            <CardTitle className="text-2xl" data-testid="text-status-title">{statusMessage.title}</CardTitle>
            <CardDescription className="text-base mt-2" data-testid="text-status-description">
              {statusMessage.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              {getStatusBadge()}
            </div>
          </CardContent>
        </Card>

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

        {verificationStatus === 'pending' && (
          <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-amber-600 mt-0.5" />
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

        {verificationStatus === 'rejected' && (
          <Card className="bg-destructive/10 border-destructive/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-destructive">
                    Need help?
                  </p>
                  <p className="text-sm text-muted-foreground">
                    If you believe this was a mistake or need to update your documents, please contact our support team.
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/support">Contact Support</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {verificationStatus === 'approved' && (
          <div className="space-y-3">
            <Button className="w-full" size="lg" asChild data-testid="button-go-to-driver">
              <Link href="/driver/map">Go to Driver Dashboard</Link>
            </Button>
          </div>
        )}

        <div className="text-center">
          <Button variant="ghost" asChild data-testid="button-back-home">
            <Link href="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
