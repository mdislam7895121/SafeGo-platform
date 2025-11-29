/**
 * SafeGo Data Visibility Rules
 * 
 * PERMANENT RULES - DO NOT MODIFY WITHOUT SECURITY REVIEW
 * 
 * These rules define what data each user role can see.
 * Violations of these rules are security incidents.
 */

/**
 * Fields that are DRIVER-ONLY and must NEVER be exposed to customers:
 * - driverPayout / driverEarnings / netEarnings
 * - safegoCommission / safeGoCommission / platformCommission
 * - commissionRate / commissionAmount / commissionPercentage
 * - driverEarningsNet / driverEarningsBase
 * - Any field revealing how fare is split between platform and driver
 */
export const DRIVER_ONLY_FIELDS = [
  'driverPayout',
  'driverEarnings',
  'driverEarningsNet',
  'driverEarningsBase',
  'netEarnings',
  'safegoCommission',
  'safeGoCommission',
  'platformCommission',
  'commissionRate',
  'commissionAmount',
  'commissionPercentage',
] as const;

export type DriverOnlyField = typeof DRIVER_ONLY_FIELDS[number];

/**
 * Fields that CUSTOMERS can see:
 * - totalFare / finalFare / estimatedFare
 * - baseFare, distanceFare, timeFare (fare components)
 * - discountAmount / promoDiscount
 * - paymentMethod / paymentType
 * - estimatedTime / estimatedDistance
 * - taxesAndSurcharges / regulatoryFees (aggregate only)
 * - tollsTotal (pass-through costs)
 * - surgeAmount / surgeMultiplier (pricing transparency)
 */
export const CUSTOMER_VISIBLE_FIELDS = [
  'totalFare',
  'finalFare',
  'estimatedFare',
  'baseFare',
  'distanceFare',
  'timeFare',
  'bookingFee',
  'serviceFee',
  'discountAmount',
  'promoCode',
  'promoDiscount',
  'paymentMethod',
  'paymentType',
  'estimatedTime',
  'estimatedDistance',
  'etaMinutes',
  'distanceMiles',
  'distanceKm',
  'taxesAndSurcharges',
  'regulatoryFeesTotal',
  'tollsTotal',
  'surgeAmount',
  'surgeMultiplier',
  'minimumFareAdjustment',
  'subtotal',
  'currency',
] as const;

export type CustomerVisibleField = typeof CUSTOMER_VISIBLE_FIELDS[number];

/**
 * Fields that DRIVERS can see (in addition to customer-visible fields):
 * All CUSTOMER_VISIBLE_FIELDS plus all DRIVER_ONLY_FIELDS
 */
export const DRIVER_VISIBLE_FIELDS = [
  ...CUSTOMER_VISIBLE_FIELDS,
  ...DRIVER_ONLY_FIELDS,
  'bonusAmount',
  'incentiveAmount',
  'adjustments',
  'tollsBreakdown',
  'regulatoryFeesBreakdown',
  'tipAmount',
  'tollsAmount',
] as const;

/**
 * Utility type to create customer-safe version of a fare type
 * Omits all driver-only fields
 */
export type CustomerSafeView<T> = Omit<T, DriverOnlyField>;

/**
 * Type guard to check if a field name is driver-only
 */
export function isDriverOnlyField(field: string): field is DriverOnlyField {
  return (DRIVER_ONLY_FIELDS as readonly string[]).includes(field);
}

/**
 * Strips driver-only fields from an object
 * Use this when preparing data for customer responses
 */
export function stripDriverOnlyFields<T extends Record<string, unknown>>(
  data: T
): CustomerSafeView<T> {
  const result = { ...data };
  for (const field of DRIVER_ONLY_FIELDS) {
    delete (result as Record<string, unknown>)[field];
  }
  return result as CustomerSafeView<T>;
}

/**
 * Validates that an object doesn't contain driver-only fields
 * Throws if violations are found (for development/testing)
 */
export function validateCustomerSafe<T extends Record<string, unknown>>(
  data: T,
  context?: string
): void {
  const violations: string[] = [];
  for (const field of DRIVER_ONLY_FIELDS) {
    if (field in data && data[field] !== undefined) {
      violations.push(field);
    }
  }
  if (violations.length > 0) {
    console.error(
      `[SECURITY] Customer data contains driver-only fields${context ? ` in ${context}` : ''}: ${violations.join(', ')}`
    );
  }
}

/**
 * Customer-facing fare display interface
 * Contains ONLY what customers should see
 */
export interface CustomerFareView {
  totalFare: number;
  finalFare?: number;
  baseFare?: number;
  distanceFare?: number;
  timeFare?: number;
  bookingFee?: number;
  serviceFee?: number;
  taxesAndSurcharges?: number;
  regulatoryFeesTotal?: number;
  tollsTotal?: number;
  surgeAmount?: number;
  surgeMultiplier?: number;
  minimumFareAdjustment?: number;
  subtotal?: number;
  discountAmount?: number;
  promoCode?: string | null;
  currency: string;
  etaMinutes?: number;
  distanceMiles?: number;
  distanceKm?: number;
}

/**
 * Driver-facing fare display interface
 * Extends customer view with earnings details
 */
export interface DriverFareView extends CustomerFareView {
  driverPayout: number;
  safegoCommission: number;
  driverEarnings?: number;
  netEarnings?: number;
  commissionRate?: number;
  tipAmount?: number;
  tollsAmount?: number;
  bonusAmount?: number;
  incentiveAmount?: number;
}
