/**
 * Prisma Enum Shim
 * 
 * Provides fallback enums for types not exported from @prisma/client.
 * Each enum is shimmed as a Proxy that returns the property key as a string value.
 * This allows type-level and runtime usage without schema changes.
 */

function makeEnumShim(name: string): any {
  return new Proxy(
    {},
    {
      get: (target, prop: string | symbol) => {
        if (typeof prop === 'string') {
          return prop;
        }
        return prop;
      },
    }
  );
}

// ============ PAYMENT & FINANCIAL ENUMS ============
export const PaymentStatus = makeEnumShim('PaymentStatus');
export type PaymentStatus = string;

export const PaymentProvider = makeEnumShim('PaymentProvider');
export type PaymentProvider = string;

export const PayoutStatus = makeEnumShim('PayoutStatus');
export type PayoutStatus = string;

export const PayoutMethod = makeEnumShim('PayoutMethod');
export type PayoutMethod = string;

export const RidePromoDiscountType = makeEnumShim('RidePromoDiscountType');
export type RidePromoDiscountType = string;

export const PromotionType = makeEnumShim('PromotionType');
export type PromotionType = string;

export const CouponDiscountType = makeEnumShim('CouponDiscountType');
export type CouponDiscountType = string;

export const DeliveryServiceType = makeEnumShim('DeliveryServiceType');
export type DeliveryServiceType = string;

export const WalletOwnerType = makeEnumShim('WalletOwnerType');
export type WalletOwnerType = string;

export const PromoType = makeEnumShim('PromoType');
export type PromoType = string;

export const EarningsStatus = makeEnumShim('EarningsStatus');
export type EarningsStatus = string;

// ============ KYC & IDENTITY ENUMS ============
export const KycDocumentType = makeEnumShim('KycDocumentType');
export type KycDocumentType = string;

export const KycVerificationStatus = makeEnumShim('KycVerificationStatus');
export type KycVerificationStatus = string;

export const BackgroundCheckStatus = makeEnumShim('BackgroundCheckStatus');
export type BackgroundCheckStatus = string;

export const BackgroundCheckResult = makeEnumShim('BackgroundCheckResult');
export type BackgroundCheckResult = string;

export const FaceMatchStatus = makeEnumShim('FaceMatchStatus');
export type FaceMatchStatus = string;

export const DocumentStatus = makeEnumShim('DocumentStatus');
export type DocumentStatus = string;

// ============ DEVICE & PLATFORM ENUMS ============
export const DevicePlatform = makeEnumShim('DevicePlatform');
export type DevicePlatform = string;

export const MobileWalletBrand = makeEnumShim('MobileWalletBrand');
export type MobileWalletBrand = string;

// ============ NOTIFICATION & MESSAGING ENUMS ============
export const NotificationType = makeEnumShim('NotificationType');
export type NotificationType = string;

export const NotificationStatus = makeEnumShim('NotificationStatus');
export type NotificationStatus = string;

// ============ SUPPORT & TICKET ENUMS ============
export const DriverSupportCategory = makeEnumShim('DriverSupportCategory');
export type DriverSupportCategory = string;

export const RestaurantSupportCategory = makeEnumShim('RestaurantSupportCategory');
export type RestaurantSupportCategory = string;

export const RestaurantSupportPriority = makeEnumShim('RestaurantSupportPriority');
export type RestaurantSupportPriority = string;

export const RestaurantSupportStatus = makeEnumShim('RestaurantSupportStatus');
export type RestaurantSupportStatus = string;

// ============ COMPLIANCE & CONSENT ENUMS ============
export const ConsentType = makeEnumShim('ConsentType');
export type ConsentType = string;

export const ConsentUserRole = makeEnumShim('ConsentUserRole');
export type ConsentUserRole = string;

export const PrivacyDeleteRequestStatus = makeEnumShim('PrivacyDeleteRequestStatus');
export type PrivacyDeleteRequestStatus = string;

export const PrivacyRequestType = makeEnumShim('PrivacyRequestType');
export type PrivacyRequestType = string;

export const PrivacyRequestStatus = makeEnumShim('PrivacyRequestStatus');
export type PrivacyRequestStatus = string;

// ============ REVIEW & ACCESS CONTROL ENUMS ============
export const ReviewCycleStatus = makeEnumShim('ReviewCycleStatus');
export type ReviewCycleStatus = string;

export const ReviewDecision = makeEnumShim('ReviewDecision');
export type ReviewDecision = string;

export const OpportunityBonusType = makeEnumShim('OpportunityBonusType');
export type OpportunityBonusType = string;

// ============ SECURITY & ADMIN ENUMS ============
export const AdminAnomalyType = makeEnumShim('AdminAnomalyType');
export type AdminAnomalyType = string;

export const AdminAnomalyStatus = makeEnumShim('AdminAnomalyStatus');
export type AdminAnomalyStatus = string;

export const ChallengeType = makeEnumShim('ChallengeType');
export type ChallengeType = string;

export const BotChallengeStatus = makeEnumShim('BotChallengeStatus');
export type BotChallengeStatus = string;

export const BreachSeverity = makeEnumShim('BreachSeverity');
export type BreachSeverity = string;

export const BreachStatus = makeEnumShim('BreachStatus');
export type BreachStatus = string;

export const ContainmentAction = makeEnumShim('ContainmentAction');
export type ContainmentAction = string;

// ============ MODERATION & CONTENT ENUMS ============
export const ModerationFlagType = makeEnumShim('ModerationFlagType');
export type ModerationFlagType = string;

export const ModerationStatus = makeEnumShim('ModerationStatus');
export type ModerationStatus = string;

// ============ RELEASE & DEPLOYMENT ENUMS ============
export const ReleaseEnvironment = makeEnumShim('ReleaseEnvironment');
export type ReleaseEnvironment = string;

export const ReleaseDeploymentStatus = makeEnumShim('ReleaseDeploymentStatus');
export type ReleaseDeploymentStatus = string;

export const ReleaseChecklistStatus = makeEnumShim('ReleaseChecklistStatus');
export type ReleaseChecklistStatus = string;

export const ReleaseApprovalStatus = makeEnumShim('ReleaseApprovalStatus');
export type ReleaseApprovalStatus = string;

// ============ INCENTIVE & EARNING ENUMS ============
export const IncentiveRecommendation = makeEnumShim('IncentiveRecommendation');
export type IncentiveRecommendation = string;

export const DriverEngagementMetric = makeEnumShim('DriverEngagementMetric');
export type DriverEngagementMetric = string;

// ============ BANGLADESH EXPANSION ENUMS ============
export const RentalVehicleType = makeEnumShim('RentalVehicleType');
export type RentalVehicleType = string;

export const ShopType = makeEnumShim('ShopType');
export type ShopType = string;

export const BdServiceType = makeEnumShim('BdServiceType');
export type BdServiceType = string;

export const DayOfWeek = makeEnumShim('DayOfWeek');
export type DayOfWeek = string;

export const PartnerStatus = makeEnumShim('PartnerStatus');
export type PartnerStatus = string;

// ============ JOB & SYSTEM ENUMS ============
export const SystemJobStatus = makeEnumShim('SystemJobStatus');
export type SystemJobStatus = string;

// ============ NAVIGATION ENUMS ============
export const NavigationSession = makeEnumShim('NavigationSession');
export type NavigationSession = string;

export const NavigationWaypoint = makeEnumShim('NavigationWaypoint');
export type NavigationWaypoint = string;

export const RoutingConfig = makeEnumShim('RoutingConfig');
export type RoutingConfig = string;

// ============ NOTIFICATION SCHEDULE ENUMS ============
export const NotificationSchedule = makeEnumShim('NotificationSchedule');
export type NotificationSchedule = string;

export const NotificationPreference = makeEnumShim('NotificationPreference');
export type NotificationPreference = string;

// ============ RIDE PROMOTION ENUMS ============
export const RidePromotion = makeEnumShim('RidePromotion');
export type RidePromotion = string;

export const RidePromotionUsage = makeEnumShim('RidePromotionUsage');
export type RidePromotionUsage = string;

// ============ ROUTING ENUMS ============
export const RouteOptimizationRun = makeEnumShim('RouteOptimizationRun');
export type RouteOptimizationRun = string;

// ============ ETA PROFILE ENUMS ============
export const DriverEtaProfile = makeEnumShim('DriverEtaProfile');
export type DriverEtaProfile = string;

// ============ MODEL TYPES (Non-Enum) ============
// These are referenced as types but exported as models/tables from Prisma
// They should only be imported as type-only
export type Vehicle = any;
export type DriverProfile = any;
