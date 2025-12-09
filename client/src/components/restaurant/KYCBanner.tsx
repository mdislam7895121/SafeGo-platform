import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { getVerificationState, getFieldLabel } from "@/lib/restaurantVerification";

interface KYCStatus {
  isComplete: boolean;
  missingFields: string[];
  countryCode: string | null;
  verificationStatus: string;
  isVerified: boolean;
  rejectionReason?: string | null;
}

export function KYCBanner() {
  const { data: kycData, isLoading } = useQuery<{ kycStatus?: KYCStatus }>({
    queryKey: ["/api/restaurant/kyc-status"],
  });

  if (isLoading || !kycData?.kycStatus) {
    return null;
  }

  const verification = getVerificationState(kycData.kycStatus);
  const { countryCode } = kycData.kycStatus;

  if (verification.isVerifiedForOperations) {
    return null;
  }

  if (verification.verificationStatus === 'not_submitted' || verification.missingFields.length > 0) {
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
          {verification.missingFields.length > 0 && (
            <ul className="list-disc list-inside mb-3 text-sm">
              {verification.missingFields.map((field) => (
                <li key={field}>{getFieldLabel(field)}</li>
              ))}
            </ul>
          )}
          <Button asChild size="sm" variant="outline" data-testid="button-complete-kyc">
            <Link href="/restaurant/profile">
              Complete KYC Verification
            </Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (verification.verificationStatus === 'pending') {
    return (
      <Alert className="mb-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20" data-testid="alert-kyc-pending">
        <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
        <AlertTitle className="flex items-center gap-2 text-yellow-900 dark:text-yellow-100">
          Verification Pending
          <Badge variant="outline" className="border-yellow-600">Under Review</Badge>
        </AlertTitle>
        <AlertDescription className="text-yellow-800 dark:text-yellow-200">
          Your verification documents are under review. You'll be notified once approved. Until then, you cannot accept orders.
        </AlertDescription>
      </Alert>
    );
  }

  if (verification.verificationStatus === 'rejected') {
    return (
      <Alert variant="destructive" className="mb-4" data-testid="alert-kyc-rejected">
        <XCircle className="h-5 w-5" />
        <AlertTitle className="flex items-center gap-2">
          Verification Rejected
          <Badge variant="destructive">Action Required</Badge>
        </AlertTitle>
        <AlertDescription className="mt-2">
          {verification.rejectionReason && (
            <p className="mb-2 p-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded text-sm">
              <strong>Reason:</strong> {verification.rejectionReason}
            </p>
          )}
          <p className="mb-3">
            Your verification was rejected. Please review and update your information to continue.
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

  if (verification.verificationStatus === 'need_more_info') {
    return (
      <Alert className="mb-4 border-orange-500 bg-orange-50 dark:bg-orange-950/20" data-testid="alert-kyc-need-more-info">
        <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-500" />
        <AlertTitle className="flex items-center gap-2 text-orange-900 dark:text-orange-100">
          Additional Information Required
          <Badge variant="outline" className="border-orange-600">Action Required</Badge>
        </AlertTitle>
        <AlertDescription className="mt-2 text-orange-800 dark:text-orange-200">
          <p className="mb-2">
            We need additional information to complete your verification. Please review and update the following:
          </p>
          {verification.missingFields.length > 0 && (
            <ul className="list-disc list-inside mb-3 text-sm">
              {verification.missingFields.map((field) => (
                <li key={field}>{getFieldLabel(field)}</li>
              ))}
            </ul>
          )}
          <Button asChild size="sm" variant="outline" data-testid="button-update-info">
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
