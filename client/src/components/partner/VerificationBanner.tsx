import { AlertTriangle, Clock, XCircle, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  getUnifiedVerificationState, 
  getFieldLabel, 
  VerificationBannerColors,
  type PartnerVerificationInput 
} from "@shared/verification";

interface VerificationBannerProps {
  verificationInput?: PartnerVerificationInput | null | undefined;
  verification?: {
    canonicalStatus: string;
    bannerType: 'none' | 'info' | 'warning' | 'error';
    bannerMessage: string;
    missingFields: string[];
    rejectionReason: string | null;
    needsAction?: boolean;
  };
  kycRoute?: string;
  partnerType?: 'driver' | 'restaurant' | 'partner' | 'shop';
}

export function VerificationBanner({ 
  verificationInput, 
  verification: directVerification,
  kycRoute,
  partnerType = 'partner' 
}: VerificationBannerProps) {
  const verification = directVerification || getUnifiedVerificationState(verificationInput);

  if (verification.bannerType === 'none') {
    return null;
  }

  const colors = VerificationBannerColors[verification.bannerType];
  if (!colors) return null;

  const getIcon = () => {
    switch (verification.bannerType) {
      case 'info':
        return <Clock className={`h-5 w-5 ${colors.icon} shrink-0`} />;
      case 'warning':
        return <AlertTriangle className={`h-5 w-5 ${colors.icon} shrink-0`} />;
      case 'error':
        return <XCircle className={`h-5 w-5 ${colors.icon} shrink-0`} />;
      default:
        return <Info className={`h-5 w-5 ${colors.icon} shrink-0`} />;
    }
  };

  const getTitle = () => {
    switch (verification.canonicalStatus) {
      case 'pending_review':
        return 'Application Under Review';
      case 'need_more_info':
        return 'Action Required';
      case 'rejected':
        return 'Verification Rejected';
      case 'not_submitted':
        return 'Verification Required';
      default:
        return 'Verification Required';
    }
  };

  const getActionButton = () => {
    if (!kycRoute) return null;

    if (verification.canonicalStatus === 'need_more_info' || verification.needsAction) {
      return (
        <Link href={kycRoute}>
          <Button variant="outline" size="sm" data-testid="button-complete-kyc">
            Complete KYC
          </Button>
        </Link>
      );
    }

    if (verification.canonicalStatus === 'rejected') {
      return (
        <Link href={kycRoute}>
          <Button variant="outline" size="sm" data-testid="button-update-application">
            Update Application
          </Button>
        </Link>
      );
    }

    return null;
  };

  return (
    <div 
      className={`rounded-lg border p-4 ${colors.bg} ${colors.border}`}
      data-testid={`banner-verification-${verification.canonicalStatus}`}
    >
      <div className="flex items-start gap-3">
        {getIcon()}
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold ${colors.text}`} data-testid="text-banner-title">
            {getTitle()}
          </h3>
          <p className={`text-sm mt-1 ${colors.text} opacity-90`} data-testid="text-banner-message">
            {verification.bannerMessage}
          </p>
          
          {verification.missingFields.length > 0 && verification.canonicalStatus === 'need_more_info' && (
            <div className="mt-3">
              <p className={`text-sm font-medium ${colors.text}`}>Missing information:</p>
              <ul className="mt-1 space-y-1">
                {verification.missingFields.map((field) => (
                  <li 
                    key={field} 
                    className={`text-sm ${colors.text} opacity-80 flex items-center gap-2`}
                    data-testid={`text-missing-field-${field}`}
                  >
                    <span className="w-1 h-1 rounded-full bg-current shrink-0" />
                    {getFieldLabel(field)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        {getActionButton()}
      </div>
    </div>
  );
}

export function VerificationSuccessBanner() {
  return (
    <div 
      className="rounded-lg border p-4 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
      data-testid="banner-verification-success"
    >
      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
        <p className="text-sm text-green-800 dark:text-green-200" data-testid="text-verification-success">
          Verification complete. You can now start accepting work.
        </p>
      </div>
    </div>
  );
}
