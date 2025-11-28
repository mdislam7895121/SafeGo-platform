/**
 * SafeGo Promotion Engine
 * 
 * Implements psychological pricing (anchor fares), smart discount illusions,
 * and high-impact promos with comprehensive loss protection.
 * 
 * Promo Types:
 * 1. ANCHOR_ONLY - Psychological anchor (0% real discount)
 * 2. SAVER - Wait longer for small discount (2-3%)
 * 3. FIRST_RIDE - First ride only (up to $7 off)
 * 4. TIME_BASED - Off-peak hours discount
 * 5. LOCATION_BASED - Low-demand zone discount
 * 6. PAYMENT_METHOD - Wallet payment bonus
 * 7. REWARD_POINTS - Points accumulation
 * 8. DRIVER_ARRIVAL - Late arrival credit
 */

import { PrismaClient, PromoType } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================
// Type Definitions
// ============================================

interface PromoConfig {
  id: string;
  promoType: PromoType;
  countryCode: string;
  cityCode: string | null;
  name: string;
  displayTag: string;
  description: string | null;
  discountPercent: any;
  discountMaxAmount: any;
  discountMinFare: any;
  anchorMultiplier: any;
  validDaysOfWeek: number[];
  validStartHour: number | null;
  validEndHour: number | null;
  maxUsesPerUser: number | null;
  cooldownDays: number | null;
  maxUsesPerDay: number | null;
  maxSurgeAllowed: any;
  priority: number;
  stackable: boolean;
  walletOnly: boolean;
  isActive: boolean;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

interface LowDemandZone {
  id: string;
  name: string;
  countryCode: string;
  cityCode: string | null;
  polygonCoordinates: any;
  boundingBoxMinLat: number | null;
  boundingBoxMaxLat: number | null;
  boundingBoxMinLng: number | null;
  boundingBoxMaxLng: number | null;
  discountPercent: any;
  demandLevel: number;
  isActive: boolean;
}

interface UserPromoUsage {
  id: string;
  userId: string;
  firstRideUsed: boolean;
  firstRideUsedAt: Date | null;
  weeklyPromoCount: number;
  weeklyResetAt: Date;
  rewardPointsBalance: number;
  rewardPointsLifetime: number;
  totalSavingsAmount: any;
  totalAnchorSavings: any;
  arrivalCreditsBalance: any;
  lastPromoType: PromoType | null;
  lastPromoUsedAt: Date | null;
}

export interface PromoEligibilityContext {
  userId?: string;
  originalFare: number;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  surgeMultiplier: number;
  rideTypeCode: string;
  paymentMethod?: string;
  isWalletPayment?: boolean;
  countryCode?: string;
  cityCode?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
}

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

export interface AllPromosResult {
  bestPromo: PromoResult | null;
  availablePromos: PromoResult[];
  eligibilityFlags: {
    canUseFirstRide: boolean;
    canUseSaver: boolean;
    canUseTimeBased: boolean;
    canUseLocationBased: boolean;
    canUsePaymentMethod: boolean;
    weeklyUsesRemaining: number;
    surgeBlocked: boolean;
    minimumFareBlocked: boolean;
  };
}

// ============================================
// Loss Protection Constants
// ============================================

const LOSS_PROTECTION = {
  MAX_DISCOUNT_PERCENT: 5,       // Maximum 5% real discount
  MAX_DISCOUNT_AMOUNT: 7,        // Maximum $7 absolute discount
  MAX_WEEKLY_PROMO_USES: 2,      // Maximum 2 promo uses per week
  MAX_SURGE_FOR_PROMO: 1.3,      // No promos during high surge
  MINIMUM_FARE_THRESHOLD: 5,     // Fare cannot go below $5
  ANCHOR_MULTIPLIER: 1.10,       // 10% markup for anchor pricing
  POINTS_PER_DOLLAR: 1,          // 1 point per $1 spent
  POINTS_TO_DOLLAR: 100,         // 100 points = $1
  DRIVER_ARRIVAL_CREDIT: 1,      // $1 credit for late arrival
};

// ============================================
// Configuration Cache
// ============================================

interface ConfigCache {
  promoConfigs: Map<string, PromoConfig[]>;
  lowDemandZones: LowDemandZone[];
  lastRefresh: number;
}

let configCache: ConfigCache = {
  promoConfigs: new Map(),
  lowDemandZones: [],
  lastRefresh: 0,
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function refreshConfigCache(): Promise<void> {
  const now = Date.now();
  if (now - configCache.lastRefresh < CACHE_TTL_MS) {
    return;
  }

  try {
    const [promoConfigs, lowDemandZones] = await Promise.all([
      prisma.promoConfig.findMany({
        where: {
          isActive: true,
          effectiveFrom: { lte: new Date() },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: new Date() } },
          ],
        },
        orderBy: { priority: "desc" },
      }),
      prisma.lowDemandZone.findMany({
        where: { isActive: true },
      }),
    ]);

    const configMap = new Map<string, PromoConfig[]>();
    for (const config of promoConfigs as PromoConfig[]) {
      const key = `${config.countryCode}-${config.cityCode || "default"}`;
      if (!configMap.has(key)) {
        configMap.set(key, []);
      }
      configMap.get(key)!.push(config);
    }

    configCache = {
      promoConfigs: configMap,
      lowDemandZones: lowDemandZones as LowDemandZone[],
      lastRefresh: now,
    };
  } catch (error) {
    console.error("[PromotionEngine] Failed to refresh config cache:", error);
  }
}

// ============================================
// Helper Functions
// ============================================

function getPromoConfigs(countryCode: string, cityCode?: string): PromoConfig[] {
  const key = `${countryCode}-${cityCode || "default"}`;
  const cityConfigs = configCache.promoConfigs.get(key) || [];
  
  if (cityCode) {
    const countryConfigs = configCache.promoConfigs.get(`${countryCode}-default`) || [];
    return [...cityConfigs, ...countryConfigs];
  }
  
  return cityConfigs;
}

function getPromoConfig(promoType: PromoType, countryCode: string, cityCode?: string): PromoConfig | null {
  const configs = getPromoConfigs(countryCode, cityCode);
  return configs.find(c => c.promoType === promoType) || null;
}

function isPointInPolygon(
  point: { lat: number; lng: number },
  polygon: { lat: number; lng: number }[]
): boolean {
  if (!polygon || polygon.length < 3) return false;
  
  let inside = false;
  const x = point.lng;
  const y = point.lat;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    
    const intersect = ((yi > y) !== (yj > y)) && 
                      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  
  return inside;
}

function isInBoundingBox(
  point: { lat: number; lng: number },
  zone: LowDemandZone
): boolean {
  if (
    zone.boundingBoxMinLat === null ||
    zone.boundingBoxMaxLat === null ||
    zone.boundingBoxMinLng === null ||
    zone.boundingBoxMaxLng === null
  ) {
    return true;
  }
  
  return (
    point.lat >= zone.boundingBoxMinLat &&
    point.lat <= zone.boundingBoxMaxLat &&
    point.lng >= zone.boundingBoxMinLng &&
    point.lng <= zone.boundingBoxMaxLng
  );
}

function findMatchingLowDemandZone(
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number
): LowDemandZone | null {
  const pickup = { lat: pickupLat, lng: pickupLng };
  const dropoff = { lat: dropoffLat, lng: dropoffLng };
  
  for (const zone of configCache.lowDemandZones) {
    if (!isInBoundingBox(pickup, zone) && !isInBoundingBox(dropoff, zone)) {
      continue;
    }
    
    const polygon = zone.polygonCoordinates as { lat: number; lng: number }[];
    if (isPointInPolygon(pickup, polygon) || isPointInPolygon(dropoff, polygon)) {
      return zone;
    }
  }
  
  return null;
}

function isOffPeakTime(config: PromoConfig): boolean {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const hour = now.getHours();
  
  if (config.validDaysOfWeek.length > 0 && !config.validDaysOfWeek.includes(dayOfWeek)) {
    return false;
  }
  
  if (config.validStartHour !== null && config.validEndHour !== null) {
    if (config.validStartHour <= config.validEndHour) {
      return hour >= config.validStartHour && hour < config.validEndHour;
    } else {
      return hour >= config.validStartHour || hour < config.validEndHour;
    }
  }
  
  return true;
}

async function getUserPromoUsage(userId: string): Promise<UserPromoUsage | null> {
  try {
    let usage = await prisma.userPromoUsage.findUnique({
      where: { userId },
    }) as UserPromoUsage | null;
    
    if (!usage) {
      usage = await prisma.userPromoUsage.create({
        data: { userId },
      }) as UserPromoUsage;
    }
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    if (usage.weeklyResetAt < weekAgo) {
      usage = await prisma.userPromoUsage.update({
        where: { userId },
        data: {
          weeklyPromoCount: 0,
          weeklyResetAt: new Date(),
        },
      }) as UserPromoUsage;
    }
    
    return usage;
  } catch (error) {
    console.error("[PromotionEngine] Failed to get user promo usage:", error);
    return null;
  }
}

function toNumber(value: any): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value);
  if (value && typeof value.toNumber === "function") return value.toNumber();
  return 0;
}

// ============================================
// Promo Calculation Functions
// ============================================

function calculateAnchorFare(originalFare: number, config: PromoConfig | null): number {
  const multiplier = config ? toNumber(config.anchorMultiplier) : LOSS_PROTECTION.ANCHOR_MULTIPLIER;
  return Math.round(originalFare * multiplier * 100) / 100;
}

function applyLossProtection(
  originalFare: number,
  discountedFare: number,
  config: PromoConfig | null
): { finalFare: number; lossCapApplied: boolean; minimumFareApplied: boolean } {
  let finalFare = discountedFare;
  let lossCapApplied = false;
  let minimumFareApplied = false;
  
  const maxDiscountAmount = config?.discountMaxAmount 
    ? toNumber(config.discountMaxAmount) 
    : LOSS_PROTECTION.MAX_DISCOUNT_AMOUNT;
  
  const actualDiscount = originalFare - finalFare;
  if (actualDiscount > maxDiscountAmount) {
    finalFare = originalFare - maxDiscountAmount;
    lossCapApplied = true;
  }
  
  const minFare = config?.discountMinFare 
    ? toNumber(config.discountMinFare) 
    : LOSS_PROTECTION.MINIMUM_FARE_THRESHOLD;
  
  if (finalFare < minFare) {
    finalFare = minFare;
    minimumFareApplied = true;
  }
  
  return {
    finalFare: Math.round(finalFare * 100) / 100,
    lossCapApplied,
    minimumFareApplied,
  };
}

function buildPromoResult(
  promoType: PromoType,
  config: PromoConfig | null,
  originalFare: number,
  anchorFare: number,
  finalFare: number,
  discountPercent: number,
  lossCapApplied: boolean,
  minimumFareApplied: boolean,
  wasBlocked: boolean = false,
  blockReason: string | null = null
): PromoResult {
  const actualDiscountAmount = Math.round((originalFare - finalFare) * 100) / 100;
  const perceivedSavings = Math.round((anchorFare - finalFare) * 100) / 100;
  const companyLoss = actualDiscountAmount;
  
  return {
    promoType,
    promoConfigId: config?.id || null,
    promoName: config?.name || getDefaultPromoName(promoType),
    displayTag: config?.displayTag || getDefaultDisplayTag(promoType),
    anchorFare,
    originalFare,
    finalFare,
    actualDiscountAmount,
    perceivedSavings,
    companyLoss,
    discountPercentApplied: discountPercent,
    lossCapApplied,
    minimumFareApplied,
    wasBlocked,
    blockReason,
  };
}

function getDefaultPromoName(promoType: PromoType): string {
  const names: Record<PromoType, string> = {
    ANCHOR_ONLY: "Promo Applied",
    SAVER: "Saver Discount",
    FIRST_RIDE: "Welcome Discount",
    TIME_BASED: "Off-Peak Discount",
    LOCATION_BASED: "Zone Discount",
    PAYMENT_METHOD: "Wallet Bonus",
    REWARD_POINTS: "Points Earned",
    DRIVER_ARRIVAL: "Arrival Credit",
  };
  return names[promoType];
}

function getDefaultDisplayTag(promoType: PromoType): string {
  const tags: Record<PromoType, string> = {
    ANCHOR_ONLY: "Promo Applied",
    SAVER: "Saver",
    FIRST_RIDE: "First Ride",
    TIME_BASED: "Off-Peak",
    LOCATION_BASED: "Zone Deal",
    PAYMENT_METHOD: "Wallet",
    REWARD_POINTS: "Points",
    DRIVER_ARRIVAL: "Arrival Credit",
  };
  return tags[promoType];
}

// ============================================
// Individual Promo Calculators
// ============================================

function calculateAnchorOnlyPromo(
  context: PromoEligibilityContext,
  config: PromoConfig | null
): PromoResult {
  const { originalFare } = context;
  const anchorFare = calculateAnchorFare(originalFare, config);
  
  return buildPromoResult(
    "ANCHOR_ONLY",
    config,
    originalFare,
    anchorFare,
    originalFare,
    0,
    false,
    false
  );
}

function calculateSaverPromo(
  context: PromoEligibilityContext,
  config: PromoConfig | null
): PromoResult {
  const { originalFare, surgeMultiplier, rideTypeCode } = context;
  const anchorFare = calculateAnchorFare(originalFare, config);
  
  if (rideTypeCode !== "SAVER") {
    return buildPromoResult(
      "SAVER",
      config,
      originalFare,
      anchorFare,
      originalFare,
      0,
      false,
      false,
      true,
      "saver_promo_requires_saver_ride_type"
    );
  }
  
  const maxSurge = config?.maxSurgeAllowed ? toNumber(config.maxSurgeAllowed) : LOSS_PROTECTION.MAX_SURGE_FOR_PROMO;
  if (surgeMultiplier > maxSurge) {
    return buildPromoResult(
      "SAVER",
      config,
      originalFare,
      anchorFare,
      originalFare,
      0,
      false,
      false,
      true,
      "surge_too_high"
    );
  }
  
  const discountPercent = config?.discountPercent ? toNumber(config.discountPercent) : 3;
  const discountedFare = originalFare * (1 - discountPercent / 100);
  
  const { finalFare, lossCapApplied, minimumFareApplied } = applyLossProtection(
    originalFare,
    discountedFare,
    config
  );
  
  return buildPromoResult(
    "SAVER",
    config,
    originalFare,
    anchorFare,
    finalFare,
    discountPercent,
    lossCapApplied,
    minimumFareApplied
  );
}

function calculateFirstRidePromo(
  context: PromoEligibilityContext,
  config: PromoConfig | null,
  userUsage: UserPromoUsage | null
): PromoResult {
  const { originalFare, surgeMultiplier } = context;
  const anchorFare = calculateAnchorFare(originalFare, config);
  
  if (userUsage?.firstRideUsed) {
    return buildPromoResult(
      "FIRST_RIDE",
      config,
      originalFare,
      anchorFare,
      originalFare,
      0,
      false,
      false,
      true,
      "first_ride_already_used"
    );
  }
  
  const maxSurge = config?.maxSurgeAllowed ? toNumber(config.maxSurgeAllowed) : LOSS_PROTECTION.MAX_SURGE_FOR_PROMO;
  if (surgeMultiplier > maxSurge) {
    return buildPromoResult(
      "FIRST_RIDE",
      config,
      originalFare,
      anchorFare,
      originalFare,
      0,
      false,
      false,
      true,
      "surge_too_high"
    );
  }
  
  const discountPercent = config?.discountPercent ? toNumber(config.discountPercent) : 8;
  let discountedFare = originalFare * (1 - discountPercent / 100);
  
  const maxDiscount = config?.discountMaxAmount ? toNumber(config.discountMaxAmount) : 7;
  if (originalFare - discountedFare > maxDiscount) {
    discountedFare = originalFare - maxDiscount;
  }
  
  const { finalFare, lossCapApplied, minimumFareApplied } = applyLossProtection(
    originalFare,
    discountedFare,
    config
  );
  
  return buildPromoResult(
    "FIRST_RIDE",
    config,
    originalFare,
    anchorFare,
    finalFare,
    discountPercent,
    lossCapApplied,
    minimumFareApplied
  );
}

function calculateTimeBasedPromo(
  context: PromoEligibilityContext,
  config: PromoConfig | null
): PromoResult {
  const { originalFare, surgeMultiplier } = context;
  const anchorFare = calculateAnchorFare(originalFare, config);
  
  if (!config || !isOffPeakTime(config)) {
    return buildPromoResult(
      "TIME_BASED",
      config,
      originalFare,
      anchorFare,
      originalFare,
      0,
      false,
      false,
      true,
      "not_off_peak_time"
    );
  }
  
  const maxSurge = toNumber(config.maxSurgeAllowed) || LOSS_PROTECTION.MAX_SURGE_FOR_PROMO;
  if (surgeMultiplier > maxSurge) {
    return buildPromoResult(
      "TIME_BASED",
      config,
      originalFare,
      anchorFare,
      originalFare,
      0,
      false,
      false,
      true,
      "surge_too_high"
    );
  }
  
  const discountPercent = config.discountPercent ? toNumber(config.discountPercent) : 3;
  const discountedFare = originalFare * (1 - discountPercent / 100);
  
  const { finalFare, lossCapApplied, minimumFareApplied } = applyLossProtection(
    originalFare,
    discountedFare,
    config
  );
  
  return buildPromoResult(
    "TIME_BASED",
    config,
    originalFare,
    anchorFare,
    finalFare,
    discountPercent,
    lossCapApplied,
    minimumFareApplied
  );
}

function calculateLocationBasedPromo(
  context: PromoEligibilityContext,
  config: PromoConfig | null
): PromoResult {
  const { originalFare, surgeMultiplier, pickupLat, pickupLng, dropoffLat, dropoffLng } = context;
  const anchorFare = calculateAnchorFare(originalFare, config);
  
  const matchedZone = findMatchingLowDemandZone(pickupLat, pickupLng, dropoffLat, dropoffLng);
  
  if (!matchedZone) {
    return buildPromoResult(
      "LOCATION_BASED",
      config,
      originalFare,
      anchorFare,
      originalFare,
      0,
      false,
      false,
      true,
      "not_in_low_demand_zone"
    );
  }
  
  const maxSurge = config?.maxSurgeAllowed ? toNumber(config.maxSurgeAllowed) : LOSS_PROTECTION.MAX_SURGE_FOR_PROMO;
  if (surgeMultiplier > maxSurge) {
    return buildPromoResult(
      "LOCATION_BASED",
      config,
      originalFare,
      anchorFare,
      originalFare,
      0,
      false,
      false,
      true,
      "surge_too_high"
    );
  }
  
  const discountPercent = toNumber(matchedZone.discountPercent) || 2;
  const discountedFare = originalFare * (1 - discountPercent / 100);
  
  const { finalFare, lossCapApplied, minimumFareApplied } = applyLossProtection(
    originalFare,
    discountedFare,
    config
  );
  
  return buildPromoResult(
    "LOCATION_BASED",
    config,
    originalFare,
    anchorFare,
    finalFare,
    discountPercent,
    lossCapApplied,
    minimumFareApplied
  );
}

function calculatePaymentMethodPromo(
  context: PromoEligibilityContext,
  config: PromoConfig | null
): PromoResult {
  const { originalFare, isWalletPayment } = context;
  const anchorFare = calculateAnchorFare(originalFare, config);
  
  if (!isWalletPayment) {
    return buildPromoResult(
      "PAYMENT_METHOD",
      config,
      originalFare,
      anchorFare,
      originalFare,
      0,
      false,
      false,
      true,
      "not_wallet_payment"
    );
  }
  
  const discountPercent = config?.discountPercent ? toNumber(config.discountPercent) : 2;
  const discountedFare = originalFare * (1 - discountPercent / 100);
  
  const { finalFare, lossCapApplied, minimumFareApplied } = applyLossProtection(
    originalFare,
    discountedFare,
    config
  );
  
  const result = buildPromoResult(
    "PAYMENT_METHOD",
    config,
    originalFare,
    anchorFare,
    finalFare,
    discountPercent,
    lossCapApplied,
    minimumFareApplied
  );
  
  result.walletCreditEarned = config?.discountMaxAmount ? toNumber(config.discountMaxAmount) : 3;
  
  return result;
}

function calculateRewardPointsPromo(
  context: PromoEligibilityContext,
  config: PromoConfig | null
): PromoResult {
  const { originalFare } = context;
  const anchorFare = calculateAnchorFare(originalFare, config);
  
  const pointsEarned = Math.floor(originalFare * LOSS_PROTECTION.POINTS_PER_DOLLAR);
  
  const result = buildPromoResult(
    "REWARD_POINTS",
    config,
    originalFare,
    anchorFare,
    originalFare,
    0,
    false,
    false
  );
  
  result.pointsEarned = pointsEarned;
  
  return result;
}

// ============================================
// Main Calculation Function
// ============================================

export async function calculateBestPromo(
  context: PromoEligibilityContext
): Promise<AllPromosResult> {
  await refreshConfigCache();
  
  const countryCode = context.countryCode || "US";
  const cityCode = context.cityCode;
  const { surgeMultiplier, originalFare, userId } = context;
  
  let userUsage: UserPromoUsage | null = null;
  if (userId) {
    userUsage = await getUserPromoUsage(userId);
  }
  
  const anchorConfig = getPromoConfig("ANCHOR_ONLY", countryCode, cityCode);
  const saverConfig = getPromoConfig("SAVER", countryCode, cityCode);
  const firstRideConfig = getPromoConfig("FIRST_RIDE", countryCode, cityCode);
  const timeBasedConfig = getPromoConfig("TIME_BASED", countryCode, cityCode);
  const locationBasedConfig = getPromoConfig("LOCATION_BASED", countryCode, cityCode);
  const paymentMethodConfig = getPromoConfig("PAYMENT_METHOD", countryCode, cityCode);
  const rewardPointsConfig = getPromoConfig("REWARD_POINTS", countryCode, cityCode);
  
  const surgeBlocked = surgeMultiplier > LOSS_PROTECTION.MAX_SURGE_FOR_PROMO;
  const minimumFareBlocked = originalFare < LOSS_PROTECTION.MINIMUM_FARE_THRESHOLD;
  const weeklyUsesRemaining = userUsage 
    ? Math.max(0, LOSS_PROTECTION.MAX_WEEKLY_PROMO_USES - userUsage.weeklyPromoCount)
    : LOSS_PROTECTION.MAX_WEEKLY_PROMO_USES;
  
  const cooldownActive = weeklyUsesRemaining <= 0;
  
  const availablePromos: PromoResult[] = [];
  
  availablePromos.push(calculateAnchorOnlyPromo(context, anchorConfig));
  availablePromos.push(calculateSaverPromo(context, saverConfig));
  
  if (userId) {
    availablePromos.push(calculateFirstRidePromo(context, firstRideConfig, userUsage));
  }
  
  availablePromos.push(calculateTimeBasedPromo(context, timeBasedConfig));
  availablePromos.push(calculateLocationBasedPromo(context, locationBasedConfig));
  availablePromos.push(calculatePaymentMethodPromo(context, paymentMethodConfig));
  availablePromos.push(calculateRewardPointsPromo(context, rewardPointsConfig));
  
  let validPromos = availablePromos.filter(p => !p.wasBlocked);
  
  if (cooldownActive) {
    validPromos = validPromos.filter(p => 
      p.promoType === "ANCHOR_ONLY" || 
      p.promoType === "REWARD_POINTS"
    );
  }
  
  let bestPromo: PromoResult | null = null;
  let maxSavings = 0;
  
  for (const promo of validPromos) {
    if (promo.perceivedSavings > maxSavings) {
      maxSavings = promo.perceivedSavings;
      bestPromo = promo;
    }
  }
  
  if (!bestPromo) {
    bestPromo = validPromos.find(p => p.promoType === "ANCHOR_ONLY") || availablePromos[0];
  }
  
  return {
    bestPromo,
    availablePromos,
    eligibilityFlags: {
      canUseFirstRide: !userUsage?.firstRideUsed && !surgeBlocked,
      canUseSaver: context.rideTypeCode === "SAVER" && !surgeBlocked,
      canUseTimeBased: timeBasedConfig ? isOffPeakTime(timeBasedConfig) && !surgeBlocked : false,
      canUseLocationBased: !!findMatchingLowDemandZone(
        context.pickupLat, context.pickupLng,
        context.dropoffLat, context.dropoffLng
      ) && !surgeBlocked,
      canUsePaymentMethod: !!context.isWalletPayment,
      weeklyUsesRemaining,
      surgeBlocked,
      minimumFareBlocked,
    },
  };
}

// ============================================
// Promo Application (for booking)
// ============================================

export async function applyPromoToFare(
  context: PromoEligibilityContext,
  selectedPromoType?: PromoType
): Promise<{ promoResult: PromoResult; updatedUsage: boolean }> {
  const allPromos = await calculateBestPromo(context);
  
  let promoResult: PromoResult;
  
  if (selectedPromoType) {
    const selectedPromo = allPromos.availablePromos.find(p => p.promoType === selectedPromoType);
    promoResult = selectedPromo && !selectedPromo.wasBlocked 
      ? selectedPromo 
      : allPromos.bestPromo!;
  } else {
    promoResult = allPromos.bestPromo!;
  }
  
  let updatedUsage = false;
  
  if (context.userId && promoResult.actualDiscountAmount > 0) {
    try {
      const updateData: any = {
        weeklyPromoCount: { increment: 1 },
        lastPromoType: promoResult.promoType,
        lastPromoUsedAt: new Date(),
        totalSavingsAmount: { increment: promoResult.actualDiscountAmount },
        totalAnchorSavings: { increment: promoResult.perceivedSavings },
      };
      
      if (promoResult.promoType === "FIRST_RIDE") {
        updateData.firstRideUsed = true;
        updateData.firstRideUsedAt = new Date();
      }
      
      if (promoResult.pointsEarned) {
        updateData.rewardPointsBalance = { increment: promoResult.pointsEarned };
        updateData.rewardPointsLifetime = { increment: promoResult.pointsEarned };
      }
      
      await prisma.userPromoUsage.update({
        where: { userId: context.userId },
        data: updateData,
      });
      
      updatedUsage = true;
    } catch (error) {
      console.error("[PromotionEngine] Failed to update user promo usage:", error);
    }
  }
  
  try {
    await prisma.promoLog.create({
      data: {
        userId: context.userId,
        promoType: promoResult.promoType,
        promoConfigId: promoResult.promoConfigId,
        originalFare: promoResult.originalFare,
        anchorFare: promoResult.anchorFare,
        finalFare: promoResult.finalFare,
        actualDiscountAmount: promoResult.actualDiscountAmount,
        perceivedSavings: promoResult.perceivedSavings,
        companyLoss: promoResult.companyLoss,
        discountPercentApplied: promoResult.discountPercentApplied,
        lossCapApplied: promoResult.lossCapApplied,
        minimumFareApplied: promoResult.minimumFareApplied,
        wasBlocked: promoResult.wasBlocked,
        blockReason: promoResult.blockReason,
        surgeMultiplier: context.surgeMultiplier,
        paymentMethod: context.paymentMethod,
        isWalletPayment: context.isWalletPayment || false,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        deviceFingerprint: context.deviceFingerprint,
      },
    });
  } catch (error) {
    console.error("[PromotionEngine] Failed to log promo application:", error);
  }
  
  return { promoResult, updatedUsage };
}

// ============================================
// Driver Arrival Credit
// ============================================

export async function applyDriverArrivalCredit(
  userId: string,
  rideId: string,
  lateMinutes: number
): Promise<{ creditAmount: number; applied: boolean }> {
  if (lateMinutes < 2) {
    return { creditAmount: 0, applied: false };
  }
  
  const creditAmount = LOSS_PROTECTION.DRIVER_ARRIVAL_CREDIT;
  
  try {
    await prisma.userPromoUsage.update({
      where: { userId },
      data: {
        arrivalCreditsBalance: { increment: creditAmount },
      },
    });
    
    await prisma.promoLog.create({
      data: {
        userId,
        rideId,
        promoType: "DRIVER_ARRIVAL",
        originalFare: 0,
        anchorFare: 0,
        finalFare: 0,
        actualDiscountAmount: creditAmount,
        perceivedSavings: creditAmount,
        companyLoss: creditAmount,
      },
    });
    
    return { creditAmount, applied: true };
  } catch (error) {
    console.error("[PromotionEngine] Failed to apply driver arrival credit:", error);
    return { creditAmount: 0, applied: false };
  }
}

// ============================================
// Exports
// ============================================

export const PromotionEngine = {
  calculateBestPromo,
  applyPromoToFare,
  applyDriverArrivalCredit,
  LOSS_PROTECTION,
};

export default PromotionEngine;
