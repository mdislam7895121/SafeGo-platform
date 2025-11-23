/**
 * SafeGo Payment & Payout Configuration Types
 * Country-aware, multi-method payment and payout architecture
 */

// ===== CORE ENUMS =====

export enum CountryCode {
  BD = "BD", // Bangladesh
  US = "US", // United States
  // Extensible: IN, UK, etc.
}

export enum ServiceType {
  RIDE = "RIDE",
  FOOD = "FOOD",
  PARCEL = "PARCEL",
}

export enum ActorType {
  CUSTOMER = "CUSTOMER",
  DRIVER = "DRIVER",
  RESTAURANT = "RESTAURANT",
}

// ===== PAYMENT METHOD TYPES (for customers) =====

export enum PaymentMethodType {
  CARD = "CARD",
  MOBILE_WALLET = "MOBILE_WALLET",
  BANK_TRANSFER = "BANK_TRANSFER",
  CASH = "CASH",
  DIGITAL_WALLET = "DIGITAL_WALLET",
  OTHER_PROVIDER = "OTHER_PROVIDER",
}

// ===== PAYOUT RAIL TYPES (for restaurants/drivers) =====

export enum PayoutRailType {
  BANK_ACCOUNT = "BANK_ACCOUNT",
  CARD_PAYOUT = "CARD_PAYOUT",
  MOBILE_WALLET = "MOBILE_WALLET",
  EXTERNAL_PROVIDER = "EXTERNAL_PROVIDER",
  CASH_SETTLEMENT = "CASH_SETTLEMENT", // For small offline settlements, drivers only
  OTHER_RAIL = "OTHER_RAIL",
}

// ===== PAYMENT PROVIDERS =====

export enum PaymentProvider {
  // Card networks
  VISA = "VISA",
  MASTERCARD = "MASTERCARD",
  AMEX = "AMEX",

  // Stripe integration
  STRIPE_CARD = "STRIPE_CARD",
  STRIPE_APPLE_PAY = "STRIPE_APPLE_PAY",
  STRIPE_GOOGLE_PAY = "STRIPE_GOOGLE_PAY",

  // Bangladesh mobile wallets
  BKASH = "BKASH",
  NAGAD = "NAGAD",
  ROCKET = "ROCKET",

  // Global providers
  PAYPAL = "PAYPAL",
  WISE = "WISE",

  // Special types
  CASH_ON_DELIVERY = "CASH_ON_DELIVERY",
  INTERNAL_WALLET = "INTERNAL_WALLET",

  OTHER = "OTHER",
}

// ===== PAYOUT PROVIDERS =====

export enum PayoutProvider {
  // Stripe
  STRIPE_CONNECT = "STRIPE_CONNECT",

  // US bank transfers
  BANK_TRANSFER_US_ACH = "BANK_TRANSFER_US_ACH",

  // Bangladesh bank transfers
  BANK_TRANSFER_BD_LOCAL = "BANK_TRANSFER_BD_LOCAL",

  // Bangladesh mobile wallet agents
  BKASH_AGENT = "BKASH_AGENT",
  NAGAD_AGENT = "NAGAD_AGENT",
  ROCKET_AGENT = "ROCKET_AGENT",

  // Global providers
  PAYPAL_PAYOUT = "PAYPAL_PAYOUT",

  // Manual processing
  MANUAL_OFFLINE = "MANUAL_OFFLINE",

  OTHER = "OTHER",
}

// ===== PAYOUT SCHEDULE =====

export enum PayoutSchedule {
  DAILY = "DAILY",
  WEEKLY = "WEEKLY",
  BIWEEKLY = "BIWEEKLY",
  MONTHLY = "MONTHLY",
  ON_DEMAND = "ON_DEMAND",
}

// ===== KYC LEVELS =====

export enum KycLevel {
  NONE = "NONE",
  BASIC = "BASIC",
  FULL = "FULL",
}

// ===== PAYOUT METHOD STATUS =====

export enum PayoutMethodStatus {
  PENDING_VERIFICATION = "PENDING_VERIFICATION",
  ACTIVE = "ACTIVE",
  DISABLED = "DISABLED",
}

// ===== TYPE GUARDS =====

export function isValidCountryCode(code: string): code is CountryCode {
  return Object.values(CountryCode).includes(code as CountryCode);
}

export function isValidServiceType(type: string): type is ServiceType {
  return Object.values(ServiceType).includes(type as ServiceType);
}

export function isValidActorType(type: string): type is ActorType {
  return Object.values(ActorType).includes(type as ActorType);
}

// ===== CONFIGURATION INTERFACES =====

export interface CountryPaymentConfigData {
  id: string;
  countryCode: CountryCode;
  serviceType: ServiceType;
  methodType: PaymentMethodType;
  provider: PaymentProvider;
  isEnabled: boolean;
  priority: number;
  minAmount?: number;
  maxAmount?: number;
  supportsRecurring: boolean;
  requiresKycLevel: KycLevel;
  createdAt: Date;
  updatedAt: Date;
  createdByAdminId?: string;
  lastUpdatedByAdminId?: string;
}

export interface CountryPayoutConfigData {
  id: string;
  countryCode: CountryCode;
  actorType: ActorType;
  payoutRailType: PayoutRailType;
  provider: PayoutProvider;
  isEnabled: boolean;
  minPayoutAmount: number;
  payoutSchedule: PayoutSchedule;
  requiresKycLevel: KycLevel;
  createdAt: Date;
  updatedAt: Date;
  createdByAdminId?: string;
  lastUpdatedByAdminId?: string;
}

export interface PayoutMethodData {
  id: string;
  actorType: ActorType;
  restaurantId?: string;
  driverId?: string;
  countryCode: CountryCode;
  payoutRailType: PayoutRailType;
  provider: PayoutProvider;
  currency: string;
  isDefault: boolean;
  status: PayoutMethodStatus;
  maskedDetails: string; // e.g., "Bank ****1234", "bKash ***890"
  metadata?: Record<string, any>; // PSP-specific IDs, encrypted sensitive data
  createdAt: Date;
  updatedAt: Date;
  createdByActorId: string;
  lastUpdatedByActorId?: string;
  actorRole: string;
}
