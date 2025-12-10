import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Clock, XCircle, FileCheck } from "lucide-react";
import { Link } from "wouter";
import type { KycStatusResponse } from "@/hooks/useKycStatus";

interface KycEnforcementBannerProps {
  kycStatus: KycStatusResponse;
  className?: string;
}

export function KycEnforcementBanner({ kycStatus, className = "" }: KycEnforcementBannerProps) {
  if (kycStatus.isVerified) {
    return null;
  }

  const getIcon = () => {
    switch (kycStatus.verificationStatus) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "rejected":
        return <XCircle className="h-4 w-4" />;
      default:
        return <ShieldAlert className="h-4 w-4" />;
    }
  };

  const getTitle = () => {
    switch (kycStatus.verificationStatus) {
      case "pending":
        return "Verification Pending";
      case "rejected":
        return "Verification Rejected";
      default:
        return "Complete KYC to Continue";
    }
  };

  const getVariant = () => {
    switch (kycStatus.verificationStatus) {
      case "pending":
        return "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";
      case "rejected":
        return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
      default:
        return "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800";
    }
  };

  return (
    <Alert className={`${getVariant()} ${className}`} data-testid="kyc-enforcement-banner">
      {getIcon()}
      <AlertTitle className="font-medium">{getTitle()}</AlertTitle>
      <AlertDescription className="mt-1">
        <p className="text-sm">{kycStatus.reason}</p>
        {kycStatus.verificationStatus !== "pending" && (
          <Link href="/customer/profile">
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              data-testid="button-go-to-verification"
            >
              <FileCheck className="h-4 w-4 mr-1" />
              Go to Verification
            </Button>
          </Link>
        )}
      </AlertDescription>
    </Alert>
  );
}
