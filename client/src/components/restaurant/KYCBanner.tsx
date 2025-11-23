import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

interface KYCStatus {
  isComplete: boolean;
  missingFields: string[];
  countryCode: string | null;
  verificationStatus: string;
  isVerified: boolean;
}

function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    fatherName: "Father's Name",
    nidNumber: "National ID Number",
    presentAddress: "Present Address",
    governmentIdType: "Government ID Type",
    homeAddress: "Home Address",
    countryCode: "Country Code",
  };
  return labels[field] || field;
}

export function KYCBanner() {
  const { data: kycData, isLoading } = useQuery<{ kycStatus?: KYCStatus }>({
    queryKey: ["/api/restaurant/kyc-status"],
  });

  if (isLoading || !kycData?.kycStatus) {
    return null;
  }

  const { isComplete, missingFields, countryCode, verificationStatus, isVerified } = kycData.kycStatus;

  // Don't show banner if KYC is complete and verified
  if (isComplete && isVerified) {
    return null;
  }

  // If incomplete, show warning banner
  if (!isComplete) {
    return (
      <Alert variant="destructive" className="mb-4" data-testid="alert-kyc-incomplete">
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle className="flex items-center gap-2">
          KYC Verification Required
          <Badge variant="destructive">Action Required</Badge>
        </AlertTitle>
        <AlertDescription className="mt-2">
          <p className="mb-2">
            Complete your KYC verification to accept orders and manage your restaurant. The
            following information is required for {countryCode || "your country"}:
          </p>
          <ul className="list-disc list-inside mb-3 text-sm">
            {missingFields.map((field) => (
              <li key={field}>{getFieldLabel(field)}</li>
            ))}
          </ul>
          <Button asChild size="sm" variant="outline" data-testid="button-complete-kyc">
            <Link href="/restaurant/profile">
              Complete KYC Verification
            </Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // If complete but pending approval
  if (isComplete && verificationStatus === "pending") {
    return (
      <Alert className="mb-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20" data-testid="alert-kyc-pending">
        <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
        <AlertTitle className="flex items-center gap-2 text-yellow-900 dark:text-yellow-100">
          KYC Verification Pending
          <Badge variant="outline" className="border-yellow-600">Under Review</Badge>
        </AlertTitle>
        <AlertDescription className="text-yellow-800 dark:text-yellow-200">
          Your KYC documents are under review. You'll be notified once the verification is complete.
        </AlertDescription>
      </Alert>
    );
  }

  // If rejected
  if (verificationStatus === "rejected") {
    return (
      <Alert variant="destructive" className="mb-4" data-testid="alert-kyc-rejected">
        <XCircle className="h-5 w-5" />
        <AlertTitle className="flex items-center gap-2">
          KYC Verification Rejected
          <Badge variant="destructive">Action Required</Badge>
        </AlertTitle>
        <AlertDescription className="mt-2">
          <p className="mb-3">
            Your KYC verification was rejected. Please review and update your information.
          </p>
          <Button asChild size="sm" variant="outline" data-testid="button-resubmit-kyc">
            <Link href="/restaurant/profile">
              Update Information
            </Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
