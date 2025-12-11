import { 
  getUnifiedVerificationState, 
  type PartnerVerificationInput,
  type UnifiedVerificationState,
  CanonicalVerificationStatus,
  getFieldLabel as sharedGetFieldLabel,
  isVerifiedForOperations as sharedIsVerifiedForOperations,
} from '@shared/verification';

export interface RestaurantKYCStatus {
  isComplete: boolean;
  missingFields: string[];
  countryCode: string | null;
  verificationStatus: string;
  isVerified: boolean;
  rejectionReason?: string | null;
}

export interface VerificationState {
  isVerifiedForOperations: boolean;
  verificationStatus: 'approved' | 'pending' | 'rejected' | 'not_submitted' | 'need_more_info';
  canAcceptOrders: boolean;
  badgeVariant: 'verified' | 'pending' | 'rejected' | 'not_verified' | 'action_required';
  badgeLabel: string;
  needsKycAction: boolean;
  missingFields: string[];
  rejectionReason?: string | null;
  bannerType: 'none' | 'info' | 'warning' | 'error';
  bannerMessage: string;
  canonicalStatus: string;
}

function mapToPartnerInput(kycStatus: RestaurantKYCStatus | null | undefined): PartnerVerificationInput | null {
  if (!kycStatus) return null;
  return {
    verificationStatus: kycStatus.verificationStatus,
    isVerified: kycStatus.isVerified,
    isComplete: kycStatus.isComplete,
    missingFields: kycStatus.missingFields,
    rejectionReason: kycStatus.rejectionReason,
  };
}

function mapCanonicalToLegacyStatus(unified: UnifiedVerificationState): VerificationState['verificationStatus'] {
  switch (unified.canonicalStatus) {
    case CanonicalVerificationStatus.APPROVED:
      return 'approved';
    case CanonicalVerificationStatus.PENDING_REVIEW:
      return 'pending';
    case CanonicalVerificationStatus.NEED_MORE_INFO:
      return 'need_more_info';
    case CanonicalVerificationStatus.REJECTED:
      return 'rejected';
    case CanonicalVerificationStatus.NOT_SUBMITTED:
      return 'not_submitted';
    default:
      return 'not_submitted';
  }
}

export function getVerificationState(kycStatus: RestaurantKYCStatus | null | undefined): VerificationState {
  const input = mapToPartnerInput(kycStatus);
  const unified = getUnifiedVerificationState(input);

  return {
    isVerifiedForOperations: unified.isVerifiedForOperations,
    verificationStatus: mapCanonicalToLegacyStatus(unified),
    canAcceptOrders: unified.canGoOnline,
    badgeVariant: unified.badgeVariant,
    badgeLabel: unified.badgeLabel,
    needsKycAction: unified.needsAction,
    missingFields: unified.missingFields,
    rejectionReason: unified.rejectionReason,
    bannerType: unified.bannerType,
    bannerMessage: unified.bannerMessage,
    canonicalStatus: unified.canonicalStatus,
  };
}

export function getFieldLabel(field: string): string {
  return sharedGetFieldLabel(field);
}

export function isVerifiedForOperations(kycStatus: RestaurantKYCStatus | null | undefined): boolean {
  const input = mapToPartnerInput(kycStatus);
  return sharedIsVerifiedForOperations(input);
}
