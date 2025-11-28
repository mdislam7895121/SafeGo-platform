/**
 * Promotion Engine Types for Client
 */

export type PromoType = 
  | "ANCHOR_ONLY"
  | "SAVER"
  | "FIRST_RIDE"
  | "TIME_BASED"
  | "LOCATION_BASED"
  | "PAYMENT_METHOD"
  | "REWARD_POINTS"
  | "DRIVER_ARRIVAL";

export interface PromoResult {
  promoType: PromoType;
  promoConfigId: string | null;
  promoName: string;
  displayTag: string;
  
  anchorFare: number;
  originalFare: number;
  finalFare: number;
  
  actualDiscountAmount: number;
  perceivedSavings: number;
  companyLoss: number;
  
  discountPercentApplied: number;
  lossCapApplied: boolean;
  minimumFareApplied: boolean;
  
  wasBlocked: boolean;
  blockReason: string | null;
  
  pointsEarned?: number;
  walletCreditEarned?: number;
}

export interface PromoEligibilityFlags {
  canUseFirstRide: boolean;
  canUseSaver: boolean;
  canUseTimeBased: boolean;
  canUseLocationBased: boolean;
  canUsePaymentMethod: boolean;
  weeklyUsesRemaining: number;
  surgeBlocked: boolean;
  minimumFareBlocked: boolean;
}

export interface PromoCalculationResponse {
  success: boolean;
  bestPromo: PromoResult | null;
  availablePromos: PromoResult[];
  eligibilityFlags: PromoEligibilityFlags;
}

export interface PromoCalculationRequest {
  originalFare: number;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  surgeMultiplier?: number;
  rideTypeCode: string;
  paymentMethod?: string;
  isWalletPayment?: boolean;
  countryCode?: string;
  cityCode?: string;
}

export const PROMO_DISPLAY_CONFIG: Record<PromoType, {
  badgeColor: string;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
  icon: string;
}> = {
  ANCHOR_ONLY: {
    badgeColor: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    badgeVariant: "secondary",
    icon: "tag",
  },
  SAVER: {
    badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    badgeVariant: "secondary",
    icon: "clock",
  },
  FIRST_RIDE: {
    badgeColor: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    badgeVariant: "secondary",
    icon: "star",
  },
  TIME_BASED: {
    badgeColor: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    badgeVariant: "secondary",
    icon: "moon",
  },
  LOCATION_BASED: {
    badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
    badgeVariant: "secondary",
    icon: "map-pin",
  },
  PAYMENT_METHOD: {
    badgeColor: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
    badgeVariant: "secondary",
    icon: "wallet",
  },
  REWARD_POINTS: {
    badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    badgeVariant: "secondary",
    icon: "gift",
  },
  DRIVER_ARRIVAL: {
    badgeColor: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
    badgeVariant: "secondary",
    icon: "car",
  },
};
