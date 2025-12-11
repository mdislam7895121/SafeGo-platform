import { 
  getUnifiedVerificationState, 
  type PartnerVerificationInput,
  type UnifiedVerificationState,
  CanonicalVerificationStatus,
  getFieldLabel as sharedGetFieldLabel,
  isVerifiedForOperations as sharedIsVerifiedForOperations,
} from '@shared/verification';

export interface ShopVerificationData {
  verificationStatus: string;
  isVerified?: boolean;
  rejectionReason?: string | null;
  missingFields?: string[];
}

export interface ShopVerificationState {
  isVerifiedForOperations: boolean;
  verificationStatus: 'approved' | 'pending' | 'rejected' | 'need_more_info' | 'not_submitted';
  canAcceptOrders: boolean;
  badgeVariant: 'verified' | 'pending' | 'rejected' | 'not_verified' | 'action_required';
  badgeLabel: string;
  needsKycAction: boolean;
  missingFields: string[];
  rejectionReason: string | null;
  bannerType: 'none' | 'info' | 'warning' | 'error';
  bannerMessage: string;
  canonicalStatus: string;
}

function mapToPartnerInput(shop: ShopVerificationData | null | undefined): PartnerVerificationInput | null {
  if (!shop) return null;
  return {
    verificationStatus: shop.verificationStatus,
    isVerified: shop.isVerified ?? (shop.verificationStatus === 'approved'),
    missingFields: shop.missingFields,
    rejectionReason: shop.rejectionReason,
  };
}

function mapCanonicalToLegacyStatus(unified: UnifiedVerificationState): ShopVerificationState['verificationStatus'] {
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

export function getShopVerificationState(shop: ShopVerificationData | null | undefined): ShopVerificationState {
  const input = mapToPartnerInput(shop);
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

export function isVerifiedForOperations(shop: ShopVerificationData | null | undefined): boolean {
  const input = mapToPartnerInput(shop);
  return sharedIsVerifiedForOperations(input);
}

export function getFieldLabel(field: string): string {
  return sharedGetFieldLabel(field);
}
