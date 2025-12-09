import { 
  getUnifiedVerificationState, 
  type PartnerVerificationInput,
  type UnifiedVerificationState,
  CanonicalVerificationStatus,
  getFieldLabel as sharedGetFieldLabel,
  isVerifiedForOperations as sharedIsVerifiedForOperations,
  isPendingReview as sharedIsPendingReview,
  needsMoreInfo as sharedNeedsMoreInfo,
  isRejected as sharedIsRejected,
} from '@shared/verification';

export interface DriverVerificationData {
  verificationStatus: string;
  isVerified: boolean;
  rejectionReason?: string | null;
  missingFields?: string[];
}

export interface DriverVerificationState {
  isVerifiedForOperations: boolean;
  verificationStatus: 'approved' | 'pending' | 'rejected' | 'need_more_info';
  canGoOnline: boolean;
  badgeVariant: 'verified' | 'pending' | 'rejected' | 'not_verified' | 'action_required';
  badgeLabel: string;
  needsKycAction: boolean;
  missingFields: string[];
  rejectionReason: string | null;
  bannerType: 'none' | 'info' | 'warning' | 'error';
  bannerMessage: string;
  disabledReason: string | null;
}

function mapToPartnerInput(driver: DriverVerificationData | null | undefined): PartnerVerificationInput | null {
  if (!driver) return null;
  return {
    verificationStatus: driver.verificationStatus,
    isVerified: driver.isVerified,
    missingFields: driver.missingFields,
    rejectionReason: driver.rejectionReason,
  };
}

function mapCanonicalToLegacyStatus(unified: UnifiedVerificationState): DriverVerificationState['verificationStatus'] {
  switch (unified.canonicalStatus) {
    case CanonicalVerificationStatus.APPROVED:
      return 'approved';
    case CanonicalVerificationStatus.PENDING_REVIEW:
      return 'pending';
    case CanonicalVerificationStatus.NEED_MORE_INFO:
      return 'need_more_info';
    case CanonicalVerificationStatus.REJECTED:
      return 'rejected';
    default:
      return 'pending';
  }
}

export function getDriverVerificationState(driver: DriverVerificationData | null | undefined): DriverVerificationState {
  const input = mapToPartnerInput(driver);
  const unified = getUnifiedVerificationState(input);

  let disabledReason: string | null = null;
  if (!unified.canGoOnline) {
    switch (unified.canonicalStatus) {
      case CanonicalVerificationStatus.PENDING_REVIEW:
        disabledReason = 'Your application is under review. You must be approved before you can go online.';
        break;
      case CanonicalVerificationStatus.NEED_MORE_INFO:
        disabledReason = 'Please provide the requested information before you can go online.';
        break;
      case CanonicalVerificationStatus.REJECTED:
        disabledReason = 'Your application was rejected. Please contact support or update your information.';
        break;
      default:
        disabledReason = 'Complete your verification to go online.';
    }
  }

  return {
    isVerifiedForOperations: unified.isVerifiedForOperations,
    verificationStatus: mapCanonicalToLegacyStatus(unified),
    canGoOnline: unified.canGoOnline,
    badgeVariant: unified.badgeVariant,
    badgeLabel: unified.badgeLabel,
    needsKycAction: unified.needsAction,
    missingFields: unified.missingFields,
    rejectionReason: unified.rejectionReason,
    bannerType: unified.bannerType,
    bannerMessage: unified.bannerMessage,
    disabledReason,
  };
}

export function isVerifiedForOperations(driver: DriverVerificationData | null | undefined): boolean {
  const input = mapToPartnerInput(driver);
  return sharedIsVerifiedForOperations(input);
}

export function isPendingReview(driver: DriverVerificationData | null | undefined): boolean {
  const input = mapToPartnerInput(driver);
  return sharedIsPendingReview(input);
}

export function needsMoreInfo(driver: DriverVerificationData | null | undefined): boolean {
  const input = mapToPartnerInput(driver);
  return sharedNeedsMoreInfo(input);
}

export function isRejected(driver: DriverVerificationData | null | undefined): boolean {
  const input = mapToPartnerInput(driver);
  return sharedIsRejected(input);
}

export function getFieldLabel(field: string): string {
  return sharedGetFieldLabel(field);
}
