interface RestaurantKYCStatus {
  isComplete: boolean;
  missingFields: string[];
  countryCode: string | null;
  verificationStatus: string;
  isVerified: boolean;
  rejectionReason?: string | null;
}

export interface VerificationState {
  isVerifiedForOperations: boolean;
  verificationStatus: 'approved' | 'pending' | 'rejected' | 'not_submitted';
  canAcceptOrders: boolean;
  badgeVariant: 'verified' | 'pending' | 'rejected' | 'not_verified';
  badgeLabel: string;
  needsKycAction: boolean;
  missingFields: string[];
  rejectionReason?: string | null;
}

export function getVerificationState(kycStatus: RestaurantKYCStatus | null | undefined): VerificationState {
  if (!kycStatus) {
    return {
      isVerifiedForOperations: false,
      verificationStatus: 'not_submitted',
      canAcceptOrders: false,
      badgeVariant: 'not_verified',
      badgeLabel: 'Not Verified',
      needsKycAction: true,
      missingFields: [],
      rejectionReason: null,
    };
  }

  const { isComplete, missingFields, verificationStatus, isVerified, rejectionReason } = kycStatus;

  const isVerifiedForOperations = verificationStatus === 'approved' && isVerified === true;

  const canAcceptOrders = isVerifiedForOperations;

  let badgeVariant: VerificationState['badgeVariant'] = 'not_verified';
  let badgeLabel = 'Not Verified';
  let normalizedStatus: VerificationState['verificationStatus'] = 'not_submitted';

  if (isVerifiedForOperations) {
    badgeVariant = 'verified';
    badgeLabel = 'Verified';
    normalizedStatus = 'approved';
  } else if (verificationStatus === 'pending') {
    badgeVariant = 'pending';
    badgeLabel = 'Pending Review';
    normalizedStatus = 'pending';
  } else if (verificationStatus === 'rejected') {
    badgeVariant = 'rejected';
    badgeLabel = 'Rejected';
    normalizedStatus = 'rejected';
  } else if (!isComplete) {
    badgeVariant = 'not_verified';
    badgeLabel = 'Not Verified';
    normalizedStatus = 'not_submitted';
  }

  const needsKycAction = !isVerifiedForOperations;

  return {
    isVerifiedForOperations,
    verificationStatus: normalizedStatus,
    canAcceptOrders,
    badgeVariant,
    badgeLabel,
    needsKycAction,
    missingFields: missingFields || [],
    rejectionReason,
  };
}

export function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    fatherName: "Father's Name",
    nidNumber: "National ID Number",
    presentAddress: "Present Address",
    governmentIdType: "Government ID Type",
    homeAddress: "Home Address",
    countryCode: "Country Code",
    businessLicense: "Business License",
    ownerName: "Owner Name",
    phoneNumber: "Phone Number",
    email: "Email Address",
  };
  return labels[field] || field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
}
