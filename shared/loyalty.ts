/**
 * SafeGo Loyalty Engine - Shared Types
 * 
 * Comprehensive loyalty system for both Riders and Drivers:
 * 
 * Rider Loyalty Program:
 * - Tiers: Bronze → Silver → Gold → Platinum
 * - Points per ride based on fare, time, location
 * - Weekly/monthly ride goals with rewards
 * - Auto-applied ride credits
 * - Birthday rewards
 * - Off-peak discounts
 * - Referral bonus integration
 * 
 * Driver Loyalty Program:
 * - Tiers: Silver → Gold → Platinum → Diamond
 * - Acceptance rate & cancellation bonuses
 * - Weekly guaranteed earnings trigger
 * - Long-distance pickup bonuses
 * - Weather protection auto-integration
 * - Streak rewards (7-day, 14-day, 30-day)
 */

// ========================================
// RIDER LOYALTY TYPES
// ========================================

export type RiderTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface RiderTierConfig {
  tier: RiderTier;
  displayName: string;
  minLifetimePoints: number;
  pointsMultiplier: number;
  offPeakDiscountPercent: number;
  prioritySupport: boolean;
  freeUpgrades: boolean;
  birthdayRewardCredits: number;
  monthlyGoalBonusMultiplier: number;
}

export const RIDER_TIER_CONFIGS: RiderTierConfig[] = [
  {
    tier: 'bronze',
    displayName: 'Bronze',
    minLifetimePoints: 0,
    pointsMultiplier: 1.0,
    offPeakDiscountPercent: 0,
    prioritySupport: false,
    freeUpgrades: false,
    birthdayRewardCredits: 5,
    monthlyGoalBonusMultiplier: 1.0,
  },
  {
    tier: 'silver',
    displayName: 'Silver',
    minLifetimePoints: 500,
    pointsMultiplier: 1.25,
    offPeakDiscountPercent: 5,
    prioritySupport: false,
    freeUpgrades: false,
    birthdayRewardCredits: 10,
    monthlyGoalBonusMultiplier: 1.1,
  },
  {
    tier: 'gold',
    displayName: 'Gold',
    minLifetimePoints: 2000,
    pointsMultiplier: 1.5,
    offPeakDiscountPercent: 10,
    prioritySupport: true,
    freeUpgrades: false,
    birthdayRewardCredits: 20,
    monthlyGoalBonusMultiplier: 1.25,
  },
  {
    tier: 'platinum',
    displayName: 'Platinum',
    minLifetimePoints: 5000,
    pointsMultiplier: 2.0,
    offPeakDiscountPercent: 15,
    prioritySupport: true,
    freeUpgrades: true,
    birthdayRewardCredits: 50,
    monthlyGoalBonusMultiplier: 1.5,
  },
];

export interface RiderPointsConfig {
  basePointsPerDollar: number;
  peakTimeBonus: number;
  offPeakBonus: number;
  airportBonus: number;
  longDistanceThresholdMiles: number;
  longDistanceBonus: number;
  referralBonus: number;
  firstRideBonus: number;
}

export const DEFAULT_RIDER_POINTS_CONFIG: RiderPointsConfig = {
  basePointsPerDollar: 1,
  peakTimeBonus: 5,
  offPeakBonus: 10,
  airportBonus: 15,
  longDistanceThresholdMiles: 15,
  longDistanceBonus: 20,
  referralBonus: 100,
  firstRideBonus: 50,
};

export interface RiderWeeklyGoal {
  id: string;
  ridesRequired: number;
  creditReward: number;
  pointsBonus: number;
}

export interface RiderMonthlyGoal {
  id: string;
  ridesRequired: number;
  creditReward: number;
  pointsBonus: number;
  tierMultiplierApplied: boolean;
}

export const DEFAULT_RIDER_WEEKLY_GOALS: RiderWeeklyGoal[] = [
  { id: 'weekly_3', ridesRequired: 3, creditReward: 2, pointsBonus: 25 },
  { id: 'weekly_5', ridesRequired: 5, creditReward: 5, pointsBonus: 50 },
  { id: 'weekly_10', ridesRequired: 10, creditReward: 10, pointsBonus: 100 },
];

export const DEFAULT_RIDER_MONTHLY_GOALS: RiderMonthlyGoal[] = [
  { id: 'monthly_10', ridesRequired: 10, creditReward: 10, pointsBonus: 100, tierMultiplierApplied: true },
  { id: 'monthly_20', ridesRequired: 20, creditReward: 25, pointsBonus: 250, tierMultiplierApplied: true },
  { id: 'monthly_40', ridesRequired: 40, creditReward: 50, pointsBonus: 500, tierMultiplierApplied: true },
];

export interface RiderLoyaltyState {
  riderId: string;
  currentTier: RiderTier;
  lifetimePoints: number;
  currentPoints: number;
  availableCredits: number;
  weeklyRideCount: number;
  weeklyGoalProgress: {
    goalId: string;
    completed: boolean;
    completedAt: Date | null;
  }[];
  monthlyRideCount: number;
  monthlyGoalProgress: {
    goalId: string;
    completed: boolean;
    completedAt: Date | null;
  }[];
  referralCount: number;
  referralCreditsEarned: number;
  birthdayMonth: number | null;
  birthdayDay: number | null;
  birthdayRewardClaimedThisYear: boolean;
  nextTierProgress: number;
  pointsToNextTier: number | null;
  memberSince: Date;
  lastRideDate: Date | null;
  weekStartDate: Date;
  monthStartDate: Date;
}

export interface RiderPointsBreakdown {
  basePoints: number;
  tierMultiplierPoints: number;
  timeBonusPoints: number;
  locationBonusPoints: number;
  distanceBonusPoints: number;
  goalBonusPoints: number;
  totalPoints: number;
}

export interface RiderLoyaltyResult {
  pointsEarned: RiderPointsBreakdown;
  creditsApplied: number;
  offPeakDiscountApplied: number;
  offPeakDiscountPercent: number;
  birthdayRewardAvailable: boolean;
  weeklyGoalCompleted: string | null;
  monthlyGoalCompleted: string | null;
  tierUpgraded: boolean;
  newTier: RiderTier | null;
  flags: {
    isOffPeak: boolean;
    isAirport: boolean;
    isLongDistance: boolean;
    isBirthday: boolean;
    isFirstRide: boolean;
    wasReferred: boolean;
    creditAutoApplied: boolean;
    weeklyGoalJustCompleted: boolean;
    monthlyGoalJustCompleted: boolean;
    tierJustUpgraded: boolean;
  };
}

// ========================================
// DRIVER LOYALTY TYPES
// ========================================

export type DriverLoyaltyTier = 'silver' | 'gold' | 'platinum' | 'diamond';

export interface DriverTierConfig {
  tier: DriverLoyaltyTier;
  displayName: string;
  minLifetimeRides: number;
  minAcceptanceRate: number;
  maxCancellationRate: number;
  earningsMultiplier: number;
  priorityDispatch: boolean;
  weeklyGuaranteeBonus: number;
  longDistancePickupBonusPercent: number;
  weatherProtectionMultiplier: number;
}

export const DRIVER_TIER_CONFIGS: DriverTierConfig[] = [
  {
    tier: 'silver',
    displayName: 'Silver',
    minLifetimeRides: 0,
    minAcceptanceRate: 0,
    maxCancellationRate: 100,
    earningsMultiplier: 1.0,
    priorityDispatch: false,
    weeklyGuaranteeBonus: 0,
    longDistancePickupBonusPercent: 0,
    weatherProtectionMultiplier: 1.0,
  },
  {
    tier: 'gold',
    displayName: 'Gold',
    minLifetimeRides: 100,
    minAcceptanceRate: 85,
    maxCancellationRate: 5,
    earningsMultiplier: 1.05,
    priorityDispatch: false,
    weeklyGuaranteeBonus: 25,
    longDistancePickupBonusPercent: 5,
    weatherProtectionMultiplier: 1.1,
  },
  {
    tier: 'platinum',
    displayName: 'Platinum',
    minLifetimeRides: 500,
    minAcceptanceRate: 90,
    maxCancellationRate: 3,
    earningsMultiplier: 1.10,
    priorityDispatch: true,
    weeklyGuaranteeBonus: 50,
    longDistancePickupBonusPercent: 10,
    weatherProtectionMultiplier: 1.25,
  },
  {
    tier: 'diamond',
    displayName: 'Diamond',
    minLifetimeRides: 2000,
    minAcceptanceRate: 95,
    maxCancellationRate: 2,
    earningsMultiplier: 1.15,
    priorityDispatch: true,
    weeklyGuaranteeBonus: 100,
    longDistancePickupBonusPercent: 15,
    weatherProtectionMultiplier: 1.5,
  },
];

export interface DriverStreakConfig {
  streakDays: number;
  bonusAmount: number;
  minRidesPerDay: number;
}

export const DRIVER_STREAK_CONFIGS: DriverStreakConfig[] = [
  { streakDays: 7, bonusAmount: 25, minRidesPerDay: 5 },
  { streakDays: 14, bonusAmount: 75, minRidesPerDay: 5 },
  { streakDays: 30, bonusAmount: 200, minRidesPerDay: 5 },
];

export interface DriverAcceptanceBonusConfig {
  minAcceptanceRate: number;
  bonusPercent: number;
}

export const DRIVER_ACCEPTANCE_BONUSES: DriverAcceptanceBonusConfig[] = [
  { minAcceptanceRate: 95, bonusPercent: 5 },
  { minAcceptanceRate: 98, bonusPercent: 10 },
  { minAcceptanceRate: 100, bonusPercent: 15 },
];

export interface DriverCancellationBonusConfig {
  maxCancellationRate: number;
  bonusPercent: number;
}

export const DRIVER_CANCELLATION_BONUSES: DriverCancellationBonusConfig[] = [
  { maxCancellationRate: 3, bonusPercent: 5 },
  { maxCancellationRate: 1, bonusPercent: 10 },
  { maxCancellationRate: 0, bonusPercent: 15 },
];

export interface WeeklyGuaranteeConfig {
  minHoursOnline: number;
  minRidesCompleted: number;
  guaranteedEarnings: number;
  peakHoursRequired: number;
}

export const DEFAULT_WEEKLY_GUARANTEE_CONFIG: WeeklyGuaranteeConfig = {
  minHoursOnline: 20,
  minRidesCompleted: 30,
  guaranteedEarnings: 500,
  peakHoursRequired: 5,
};

export interface LongDistancePickupConfig {
  thresholdMiles: number;
  baseBonusAmount: number;
  perMileBonus: number;
  maxBonus: number;
}

export const DEFAULT_LONG_DISTANCE_PICKUP_CONFIG: LongDistancePickupConfig = {
  thresholdMiles: 10,
  baseBonusAmount: 5,
  perMileBonus: 0.50,
  maxBonus: 25,
};

export interface DriverLoyaltyState {
  driverId: string;
  currentTier: DriverLoyaltyTier;
  lifetimeRides: number;
  weeklyRides: number;
  monthlyRides: number;
  weeklyEarnings: number;
  weeklyHoursOnline: number;
  weeklyPeakHours: number;
  acceptanceRate: number;
  cancellationRate: number;
  currentStreak: number;
  longestStreak: number;
  dailyRideCounts: { date: string; count: number }[];
  streakBonusesEarned: {
    streakDays: number;
    earnedAt: Date;
    amount: number;
  }[];
  weeklyGuaranteeEligible: boolean;
  weeklyGuaranteePayout: number;
  tierProgress: number;
  ridesToNextTier: number | null;
  memberSince: Date;
  lastRideDate: Date | null;
  weekStartDate: Date;
  monthStartDate: Date;
  rating: number;
}

export interface DriverLoyaltyBonusBreakdown {
  tierEarningsBonus: number;
  acceptanceRateBonus: number;
  cancellationRateBonus: number;
  streakBonus: number;
  longDistancePickupBonus: number;
  weatherProtectionBonus: number;
  weeklyGuaranteeTopUp: number;
  totalLoyaltyBonus: number;
}

export interface DriverLoyaltyResult {
  bonusBreakdown: DriverLoyaltyBonusBreakdown;
  tierUpgraded: boolean;
  newTier: DriverLoyaltyTier | null;
  streakContinued: boolean;
  streakBroken: boolean;
  newStreakDays: number;
  streakMilestoneReached: number | null;
  weeklyGuaranteeTriggered: boolean;
  flags: {
    isLongDistancePickup: boolean;
    hasWeatherProtection: boolean;
    hasAcceptanceBonus: boolean;
    hasCancellationBonus: boolean;
    hasStreakBonus: boolean;
    hasWeeklyGuarantee: boolean;
    tierJustUpgraded: boolean;
    streakJustBroken: boolean;
    streakMilestoneJustReached: boolean;
    priorityDispatchEnabled: boolean;
  };
}

// ========================================
// COMBINED LOYALTY CONTEXT & INTEGRATION
// ========================================

export interface LoyaltyRideContext {
  rideId: string;
  fareAmount: number;
  distanceMiles: number;
  durationMinutes: number;
  pickupLocation: { lat: number; lng: number };
  dropoffLocation: { lat: number; lng: number };
  pickupDistanceMiles: number;
  rideTime: Date;
  isOffPeak: boolean;
  isAirport: boolean;
  surgeMultiplier: number;
  weatherCondition?: string;
  rideType: string;
}

export interface RiderLoyaltyContext extends LoyaltyRideContext {
  riderId: string;
  riderState: RiderLoyaltyState;
  isFirstRide: boolean;
  wasReferred: boolean;
  referrerId?: string;
  isBirthday: boolean;
  useCredits: boolean;
}

export interface DriverLoyaltyContext extends LoyaltyRideContext {
  driverId: string;
  driverState: DriverLoyaltyState;
  baseDriverEarnings: number;
  acceptanceRateCurrent: number;
  cancellationRateCurrent: number;
  hoursOnlineToday: number;
  hoursOnlineThisWeek: number;
  peakHoursThisWeek: number;
}

export interface LoyaltyIntegrationFlags {
  riderCreditsAutoApplied: boolean;
  riderOffPeakDiscountApplied: boolean;
  riderOffPeakDiscountAmount: number;
  riderPointsEarned: number;
  riderTierBenefitApplied: boolean;
  driverLoyaltyBonusApplied: boolean;
  driverLoyaltyBonusAmount: number;
  driverTierBenefitApplied: boolean;
  driverWeatherProtectionApplied: boolean;
  driverWeatherProtectionAmount: number;
}

export interface LoyaltyAdminMetrics {
  totalRiders: number;
  ridersByTier: Record<RiderTier, number>;
  totalPointsIssued: number;
  totalCreditsIssued: number;
  totalCreditsRedeemed: number;
  avgPointsPerRide: number;
  weeklyGoalCompletionRate: number;
  monthlyGoalCompletionRate: number;
  totalDrivers: number;
  driversByTier: Record<DriverLoyaltyTier, number>;
  avgAcceptanceRate: number;
  avgCancellationRate: number;
  totalLoyaltyBonusesPaid: number;
  totalWeeklyGuaranteesPaid: number;
  avgStreakDays: number;
  streakMilestonesReached: Record<number, number>;
}

export interface DailyLoyaltyProcessingResult {
  processedAt: Date;
  ridersProcessed: number;
  driversProcessed: number;
  tierUpgrades: {
    riders: { riderId: string; from: RiderTier; to: RiderTier }[];
    drivers: { driverId: string; from: DriverLoyaltyTier; to: DriverLoyaltyTier }[];
  };
  tierDowngrades: {
    riders: { riderId: string; from: RiderTier; to: RiderTier }[];
    drivers: { driverId: string; from: DriverLoyaltyTier; to: DriverLoyaltyTier }[];
  };
  goalsReset: {
    weeklyRiderGoals: number;
    monthlyRiderGoals: number;
  };
  guaranteesTriggered: {
    count: number;
    totalPayout: number;
  };
  streaksUpdated: {
    continued: number;
    broken: number;
    milestonesReached: number;
  };
  birthdayRewardsIssued: number;
  creditsExpired: number;
  pointsExpired: number;
}

// ========================================
// REWARD LEDGER TYPES
// ========================================

export type RewardType = 
  | 'points_earned'
  | 'points_bonus'
  | 'points_expired'
  | 'credits_earned'
  | 'credits_used'
  | 'credits_expired'
  | 'birthday_reward'
  | 'referral_bonus'
  | 'goal_bonus'
  | 'tier_upgrade_bonus'
  | 'streak_bonus'
  | 'acceptance_bonus'
  | 'cancellation_bonus'
  | 'long_distance_bonus'
  | 'weather_protection_bonus'
  | 'weekly_guarantee_payout';

export interface RewardLedgerEntry {
  id: string;
  actorId: string;
  actorType: 'rider' | 'driver';
  rewardType: RewardType;
  amount: number;
  rideId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  expiresAt?: Date;
}

// ========================================
// OFF-PEAK DETECTION
// ========================================

export interface OffPeakWindow {
  dayOfWeek: number[];
  startHour: number;
  endHour: number;
}

export const DEFAULT_OFF_PEAK_WINDOWS: OffPeakWindow[] = [
  { dayOfWeek: [1, 2, 3, 4, 5], startHour: 10, endHour: 16 },
  { dayOfWeek: [1, 2, 3, 4, 5], startHour: 20, endHour: 23 },
  { dayOfWeek: [0, 6], startHour: 6, endHour: 10 },
];

export function isOffPeakTime(date: Date, windows: OffPeakWindow[] = DEFAULT_OFF_PEAK_WINDOWS): boolean {
  const dayOfWeek = date.getDay();
  const hour = date.getHours();
  
  return windows.some(window => 
    window.dayOfWeek.includes(dayOfWeek) && 
    hour >= window.startHour && 
    hour < window.endHour
  );
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

export function getRiderTierConfig(tier: RiderTier): RiderTierConfig {
  return RIDER_TIER_CONFIGS.find(c => c.tier === tier) ?? RIDER_TIER_CONFIGS[0];
}

export function getDriverTierConfig(tier: DriverLoyaltyTier): DriverTierConfig {
  return DRIVER_TIER_CONFIGS.find(c => c.tier === tier) ?? DRIVER_TIER_CONFIGS[0];
}

export function calculateRiderTier(lifetimePoints: number): RiderTier {
  const sortedConfigs = [...RIDER_TIER_CONFIGS].sort((a, b) => b.minLifetimePoints - a.minLifetimePoints);
  for (const config of sortedConfigs) {
    if (lifetimePoints >= config.minLifetimePoints) {
      return config.tier;
    }
  }
  return 'bronze';
}

export function calculateDriverTier(
  lifetimeRides: number,
  acceptanceRate: number,
  cancellationRate: number
): DriverLoyaltyTier {
  const sortedConfigs = [...DRIVER_TIER_CONFIGS].sort((a, b) => b.minLifetimeRides - a.minLifetimeRides);
  for (const config of sortedConfigs) {
    if (
      lifetimeRides >= config.minLifetimeRides &&
      acceptanceRate >= config.minAcceptanceRate &&
      cancellationRate <= config.maxCancellationRate
    ) {
      return config.tier;
    }
  }
  return 'silver';
}

export function getNextRiderTier(currentTier: RiderTier): RiderTier | null {
  const tierOrder: RiderTier[] = ['bronze', 'silver', 'gold', 'platinum'];
  const currentIndex = tierOrder.indexOf(currentTier);
  if (currentIndex < tierOrder.length - 1) {
    return tierOrder[currentIndex + 1];
  }
  return null;
}

export function getNextDriverTier(currentTier: DriverLoyaltyTier): DriverLoyaltyTier | null {
  const tierOrder: DriverLoyaltyTier[] = ['silver', 'gold', 'platinum', 'diamond'];
  const currentIndex = tierOrder.indexOf(currentTier);
  if (currentIndex < tierOrder.length - 1) {
    return tierOrder[currentIndex + 1];
  }
  return null;
}

export function getWeekStartDate(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function getMonthStartDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export function isSameWeek(date1: Date, date2: Date): boolean {
  const week1 = getWeekStartDate(date1);
  const week2 = getWeekStartDate(date2);
  return isSameDay(week1, week2);
}

export function isSameMonth(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth()
  );
}

export function isBirthday(month: number | null, day: number | null, checkDate: Date): boolean {
  if (month === null || day === null) return false;
  return checkDate.getMonth() + 1 === month && checkDate.getDate() === day;
}

export default {
  RIDER_TIER_CONFIGS,
  DRIVER_TIER_CONFIGS,
  DRIVER_STREAK_CONFIGS,
  DRIVER_ACCEPTANCE_BONUSES,
  DRIVER_CANCELLATION_BONUSES,
  DEFAULT_RIDER_POINTS_CONFIG,
  DEFAULT_RIDER_WEEKLY_GOALS,
  DEFAULT_RIDER_MONTHLY_GOALS,
  DEFAULT_WEEKLY_GUARANTEE_CONFIG,
  DEFAULT_LONG_DISTANCE_PICKUP_CONFIG,
  DEFAULT_OFF_PEAK_WINDOWS,
  getRiderTierConfig,
  getDriverTierConfig,
  calculateRiderTier,
  calculateDriverTier,
  getNextRiderTier,
  getNextDriverTier,
  getWeekStartDate,
  getMonthStartDate,
  isOffPeakTime,
  isSameDay,
  isSameWeek,
  isSameMonth,
  isBirthday,
};
