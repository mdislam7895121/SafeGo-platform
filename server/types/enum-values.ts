/**
 * Enum Value Helpers
 * 
 * Runtime values for enums that are imported as 'import type' but used as values.
 * These are shimmed values that match the enum keys for compatibility.
 */

export const BackgroundCheckStatusValues = {
  not_started: 'not_started' as const,
  pending: 'pending' as const,
  in_progress: 'in_progress' as const,
  completed: 'completed' as const,
  failed: 'failed' as const,
  clear: 'clear' as const,
  consider: 'consider' as const,
  review: 'review' as const,
  not_applicable: 'not_applicable' as const,
};

export const KycDocumentTypeValues = {
  national_id: 'national_id' as const,
  passport: 'passport' as const,
  drivers_license: 'drivers_license' as const,
  voter_id: 'voter_id' as const,
};

export const MobileWalletBrandValues = {
  bkash: 'bkash' as const,
  nagad: 'nagad' as const,
  rocket: 'rocket' as const,
  gpay: 'gpay' as const,
  applepay: 'applepay' as const,
};
