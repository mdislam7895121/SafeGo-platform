export const CanonicalVerificationStatus = {
  NOT_SUBMITTED: 'not_submitted',
  PENDING_REVIEW: 'pending_review',
  NEED_MORE_INFO: 'need_more_info',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type CanonicalVerificationStatusType = typeof CanonicalVerificationStatus[keyof typeof CanonicalVerificationStatus];

export interface PartnerVerificationInput {
  verificationStatus?: string | null;
  isVerified?: boolean | null;
  isComplete?: boolean | null;
  missingFields?: string[] | null;
  rejectionReason?: string | null;
}

export interface UnifiedVerificationState {
  canonicalStatus: CanonicalVerificationStatusType;
  isVerifiedForOperations: boolean;
  canGoOnline: boolean;
  badgeVariant: 'verified' | 'pending' | 'action_required' | 'rejected' | 'not_verified';
  badgeLabel: string;
  bannerType: 'none' | 'info' | 'warning' | 'error';
  bannerMessage: string;
  needsAction: boolean;
  missingFields: string[];
  rejectionReason: string | null;
  legacyStatus: string | null;
}

const LEGACY_STATUS_MAP: Record<string, CanonicalVerificationStatusType> = {
  'approved': CanonicalVerificationStatus.APPROVED,
  'verified': CanonicalVerificationStatus.APPROVED,
  'pending': CanonicalVerificationStatus.PENDING_REVIEW,
  'pending_review': CanonicalVerificationStatus.PENDING_REVIEW,
  'pending_manual': CanonicalVerificationStatus.PENDING_REVIEW,
  'manual_review': CanonicalVerificationStatus.PENDING_REVIEW,
  'under_review': CanonicalVerificationStatus.PENDING_REVIEW,
  'need_more_info': CanonicalVerificationStatus.NEED_MORE_INFO,
  'needs_update': CanonicalVerificationStatus.NEED_MORE_INFO,
  'requires_documents': CanonicalVerificationStatus.NEED_MORE_INFO,
  'incomplete': CanonicalVerificationStatus.NEED_MORE_INFO,
  'rejected': CanonicalVerificationStatus.REJECTED,
  'denied': CanonicalVerificationStatus.REJECTED,
  'verification_failed': CanonicalVerificationStatus.REJECTED,
  'not_submitted': CanonicalVerificationStatus.NOT_SUBMITTED,
  'not_verified': CanonicalVerificationStatus.NOT_SUBMITTED,
  'unverified': CanonicalVerificationStatus.NOT_SUBMITTED,
};

export function normalizeVerificationStatus(legacyStatus: string | null | undefined): CanonicalVerificationStatusType {
  if (!legacyStatus) {
    return CanonicalVerificationStatus.NOT_SUBMITTED;
  }
  const normalized = legacyStatus.toLowerCase().trim();
  return LEGACY_STATUS_MAP[normalized] || CanonicalVerificationStatus.NOT_SUBMITTED;
}

export function getUnifiedVerificationState(input: PartnerVerificationInput | null | undefined): UnifiedVerificationState {
  if (!input) {
    return {
      canonicalStatus: CanonicalVerificationStatus.NOT_SUBMITTED,
      isVerifiedForOperations: false,
      canGoOnline: false,
      badgeVariant: 'not_verified',
      badgeLabel: 'Not Verified',
      bannerType: 'warning',
      bannerMessage: 'Please complete your verification to start working.',
      needsAction: true,
      missingFields: [],
      rejectionReason: null,
      legacyStatus: null,
    };
  }

  const { verificationStatus, isVerified, isComplete, missingFields, rejectionReason } = input;
  const legacyStatus = verificationStatus || null;
  const canonicalStatus = normalizeVerificationStatus(verificationStatus);

  const hasMissingFields = (missingFields && missingFields.length > 0) || false;
  const effectiveCanonical = hasMissingFields && canonicalStatus !== CanonicalVerificationStatus.APPROVED 
    ? CanonicalVerificationStatus.NEED_MORE_INFO 
    : canonicalStatus;

  const isVerifiedForOperations = 
    effectiveCanonical === CanonicalVerificationStatus.APPROVED && 
    isVerified === true;

  const canGoOnline = isVerifiedForOperations;

  let badgeVariant: UnifiedVerificationState['badgeVariant'];
  let badgeLabel: string;
  let bannerType: UnifiedVerificationState['bannerType'];
  let bannerMessage: string;
  let needsAction: boolean;

  switch (effectiveCanonical) {
    case CanonicalVerificationStatus.APPROVED:
      if (isVerifiedForOperations) {
        badgeVariant = 'verified';
        badgeLabel = 'Verified';
        bannerType = 'none';
        bannerMessage = '';
        needsAction = false;
      } else {
        badgeVariant = 'pending';
        badgeLabel = 'Pending Review';
        bannerType = 'info';
        bannerMessage = 'Your application is under review. This usually takes 1–3 business days.';
        needsAction = false;
      }
      break;

    case CanonicalVerificationStatus.PENDING_REVIEW:
      badgeVariant = 'pending';
      badgeLabel = 'Pending Review';
      bannerType = 'info';
      bannerMessage = 'Your application is under review. This usually takes 1–3 business days.';
      needsAction = false;
      break;

    case CanonicalVerificationStatus.NEED_MORE_INFO:
      badgeVariant = 'action_required';
      badgeLabel = 'Action Required';
      bannerType = 'warning';
      bannerMessage = 'We need more information to complete your verification. Please review the missing items.';
      needsAction = true;
      break;

    case CanonicalVerificationStatus.REJECTED:
      badgeVariant = 'rejected';
      badgeLabel = 'Rejected';
      bannerType = 'error';
      bannerMessage = rejectionReason || 'Your application was not approved. Please contact support for more details.';
      needsAction = true;
      break;

    case CanonicalVerificationStatus.NOT_SUBMITTED:
      badgeVariant = 'not_verified';
      badgeLabel = 'Not Verified';
      bannerType = 'warning';
      bannerMessage = 'Please complete your verification to start working.';
      needsAction = true;
      break;

    default:
      badgeVariant = 'not_verified';
      badgeLabel = 'Not Verified';
      bannerType = 'warning';
      bannerMessage = 'Please complete your verification to start working.';
      needsAction = true;
  }

  return {
    canonicalStatus: effectiveCanonical,
    isVerifiedForOperations,
    canGoOnline,
    badgeVariant,
    badgeLabel,
    bannerType,
    bannerMessage,
    needsAction,
    missingFields: missingFields || [],
    rejectionReason: rejectionReason || null,
    legacyStatus,
  };
}

export function isVerifiedForOperations(input: PartnerVerificationInput | null | undefined): boolean {
  return getUnifiedVerificationState(input).isVerifiedForOperations;
}

export function isPendingReview(input: PartnerVerificationInput | null | undefined): boolean {
  const state = getUnifiedVerificationState(input);
  return state.canonicalStatus === CanonicalVerificationStatus.PENDING_REVIEW;
}

export function needsMoreInfo(input: PartnerVerificationInput | null | undefined): boolean {
  const state = getUnifiedVerificationState(input);
  return state.canonicalStatus === CanonicalVerificationStatus.NEED_MORE_INFO;
}

export function isRejected(input: PartnerVerificationInput | null | undefined): boolean {
  const state = getUnifiedVerificationState(input);
  return state.canonicalStatus === CanonicalVerificationStatus.REJECTED;
}

export function isNotSubmitted(input: PartnerVerificationInput | null | undefined): boolean {
  const state = getUnifiedVerificationState(input);
  return state.canonicalStatus === CanonicalVerificationStatus.NOT_SUBMITTED;
}

export function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    fatherName: "Father's Name",
    father_name: "Father's Name",
    nidNumber: "National ID Number",
    nid_number: "National ID Number",
    nidFrontImage: "NID Front Image",
    nid_front_image: "NID Front Image",
    nidBackImage: "NID Back Image",
    nid_back_image: "NID Back Image",
    presentAddress: "Present Address",
    present_address: "Present Address",
    permanentAddress: "Permanent Address",
    permanent_address: "Permanent Address",
    governmentIdType: "Government ID Type",
    government_id_type: "Government ID Type",
    governmentIdLast4: "Government ID Last 4 Digits",
    government_id_last4: "Government ID Last 4 Digits",
    governmentIdFrontImage: "Government ID Front",
    government_id_front_image: "Government ID Front",
    governmentIdBackImage: "Government ID Back",
    government_id_back_image: "Government ID Back",
    homeAddress: "Home Address",
    home_address: "Home Address",
    countryCode: "Country",
    country_code: "Country",
    businessLicense: "Business License",
    business_license: "Business License",
    ownerName: "Owner Name",
    owner_name: "Owner Name",
    phoneNumber: "Phone Number",
    phone_number: "Phone Number",
    email: "Email Address",
    dateOfBirth: "Date of Birth",
    date_of_birth: "Date of Birth",
    drivingLicenseNumber: "Driving License Number",
    driving_license_number: "Driving License Number",
    drivingLicenseFront: "Driving License Front Image",
    driving_license_front: "Driving License Front Image",
    drivingLicenseBack: "Driving License Back Image",
    driving_license_back: "Driving License Back Image",
    emergencyContactName: "Emergency Contact Name",
    emergency_contact_name: "Emergency Contact Name",
    emergencyContactPhone: "Emergency Contact Phone",
    emergency_contact_phone: "Emergency Contact Phone",
    vehicleRegistration: "Vehicle Registration",
    vehicle_registration: "Vehicle Registration",
    insuranceDocument: "Insurance Document",
    insurance_document: "Insurance Document",
    ssnLast4: "SSN Last 4 Digits",
    ssn_last4: "SSN Last 4 Digits",
    driverLicense: "Driver License Number",
    driver_license: "Driver License Number",
    driverLicenseImage: "Driver License Image",
    driver_license_image: "Driver License Image",
    driverLicenseExpiry: "Driver License Expiry",
    driver_license_expiry: "Driver License Expiry",
    taxId: "Tax ID / TIN Number",
    tax_id: "Tax ID / TIN Number",
    bankAccountNumber: "Bank Account Number",
    bank_account_number: "Bank Account Number",
    bankName: "Bank Name",
    bank_name: "Bank Name",
    bankRoutingNumber: "Bank Routing Number",
    bank_routing_number: "Bank Routing Number",
    restaurantName: "Restaurant Name",
    restaurant_name: "Restaurant Name",
    businessType: "Business Type",
    business_type: "Business Type",
    cuisineType: "Cuisine Type",
    cuisine_type: "Cuisine Type",
  };
  return labels[field] || field.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
}

export const VerificationBadgeColors = {
  verified: {
    bg: 'bg-green-100 dark:bg-green-950/30',
    text: 'text-green-800 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
  },
  pending: {
    bg: 'bg-amber-100 dark:bg-amber-950/30',
    text: 'text-amber-800 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
  },
  action_required: {
    bg: 'bg-orange-100 dark:bg-orange-950/30',
    text: 'text-orange-800 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-800',
  },
  rejected: {
    bg: 'bg-red-100 dark:bg-red-950/30',
    text: 'text-red-800 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
  },
  not_verified: {
    bg: 'bg-gray-100 dark:bg-gray-800/30',
    text: 'text-gray-800 dark:text-gray-400',
    border: 'border-gray-200 dark:border-gray-700',
  },
} as const;

export const VerificationBannerColors = {
  none: null,
  info: {
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-800 dark:text-blue-200',
    icon: 'text-blue-500',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-800 dark:text-amber-200',
    icon: 'text-amber-500',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-950/20',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-800 dark:text-red-200',
    icon: 'text-red-500',
  },
} as const;
