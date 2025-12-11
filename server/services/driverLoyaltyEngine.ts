/**
 * SafeGo Driver Loyalty & Earnings Engine
 * 
 * Comprehensive driver loyalty program featuring:
 * - Tiers: Silver → Gold → Platinum → Diamond
 * - Bonuses for high acceptance rate and low cancellation
 * - Weekly guaranteed earnings trigger
 * - Additional bonus for long-distance pickups
 * - Weather protection bonus auto-integration
 * - Loyalty streak rewards (7-day, 14-day, 30-day)
 * 
 * Integration:
 * - Real-time updates per completed ride
 * - Daily batch processing at 2 AM for tier updates, streak tracking
 * - Integrates with driver incentive engine for bonus stacking
 */

import {
  DriverLoyaltyTier,
  DriverLoyaltyState,
  DriverLoyaltyResult,
  DriverLoyaltyBonusBreakdown,
  DriverLoyaltyContext,
  DriverTierConfig,
  DriverStreakConfig,
  DriverAcceptanceBonusConfig,
  DriverCancellationBonusConfig,
  WeeklyGuaranteeConfig,
  LongDistancePickupConfig,
  RewardLedgerEntry,
  DRIVER_TIER_CONFIGS,
  DRIVER_STREAK_CONFIGS,
  DRIVER_ACCEPTANCE_BONUSES,
  DRIVER_CANCELLATION_BONUSES,
  DEFAULT_WEEKLY_GUARANTEE_CONFIG,
  DEFAULT_LONG_DISTANCE_PICKUP_CONFIG,
  getDriverTierConfig,
  calculateDriverTier,
  getNextDriverTier,
  getWeekStartDate,
  getMonthStartDate,
  isSameDay,
  isSameWeek,
  isSameMonth,
} from '@shared/loyalty';

// ========================================
// STATE MANAGEMENT (In-Memory Store)
// ========================================

const driverLoyaltyStore: Map<string, DriverLoyaltyState> = new Map();
const rewardLedger: RewardLedgerEntry[] = [];

export function getDriverLoyaltyState(driverId: string): DriverLoyaltyState | null {
  return driverLoyaltyStore.get(driverId) ?? null;
}

export function createDriverLoyaltyState(driverId: string): DriverLoyaltyState {
  const now = new Date();
  const state: DriverLoyaltyState = {
    driverId,
    currentTier: 'silver',
    lifetimeRides: 0,
    weeklyRides: 0,
    monthlyRides: 0,
    weeklyEarnings: 0,
    weeklyHoursOnline: 0,
    weeklyPeakHours: 0,
    acceptanceRate: 100,
    cancellationRate: 0,
    currentStreak: 0,
    longestStreak: 0,
    dailyRideCounts: [],
    streakBonusesEarned: [],
    weeklyGuaranteeEligible: false,
    weeklyGuaranteePayout: 0,
    tierProgress: 0,
    ridesToNextTier: DRIVER_TIER_CONFIGS[1].minLifetimeRides,
    memberSince: now,
    lastRideDate: null,
    weekStartDate: getWeekStartDate(now),
    monthStartDate: getMonthStartDate(now),
    rating: 5.0,
  };
  driverLoyaltyStore.set(driverId, state);
  return state;
}

export function updateDriverLoyaltyState(driverId: string, updates: Partial<DriverLoyaltyState>): DriverLoyaltyState | null {
  const state = driverLoyaltyStore.get(driverId);
  if (!state) return null;
  
  const updated = { ...state, ...updates };
  driverLoyaltyStore.set(driverId, updated);
  return updated;
}

function addRewardLedgerEntry(entry: Omit<RewardLedgerEntry, 'id' | 'createdAt'>): void {
  rewardLedger.push({
    ...entry,
    id: `reward_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date(),
  });
}

// ========================================
// TIER PROGRESSION
// ========================================

export function checkDriverTierProgression(
  state: DriverLoyaltyState
): { upgraded: boolean; downgraded: boolean; newTier: DriverLoyaltyTier; progressToNext: number; ridesToNext: number | null } {
  const newTier = calculateDriverTier(state.lifetimeRides, state.acceptanceRate, state.cancellationRate);
  const currentTierIndex = DRIVER_TIER_CONFIGS.findIndex(c => c.tier === state.currentTier);
  const newTierIndex = DRIVER_TIER_CONFIGS.findIndex(c => c.tier === newTier);
  
  const upgraded = newTierIndex > currentTierIndex;
  const downgraded = newTierIndex < currentTierIndex;
  
  const nextTier = getNextDriverTier(newTier);
  let progressToNext = 100;
  let ridesToNext: number | null = null;
  
  if (nextTier) {
    const currentConfig = getDriverTierConfig(newTier);
    const nextConfig = getDriverTierConfig(nextTier);
    const ridesInCurrentTier = state.lifetimeRides - currentConfig.minLifetimeRides;
    const ridesNeededForNext = nextConfig.minLifetimeRides - currentConfig.minLifetimeRides;
    progressToNext = Math.min(100, Math.floor((ridesInCurrentTier / ridesNeededForNext) * 100));
    ridesToNext = nextConfig.minLifetimeRides - state.lifetimeRides;
  }
  
  return { upgraded, downgraded, newTier, progressToNext, ridesToNext };
}

// ========================================
// ACCEPTANCE & CANCELLATION BONUSES
// ========================================

export function calculateAcceptanceRateBonus(
  baseEarnings: number,
  acceptanceRate: number,
  configs: DriverAcceptanceBonusConfig[] = DRIVER_ACCEPTANCE_BONUSES
): { bonusPercent: number; bonusAmount: number } {
  const sortedConfigs = [...configs].sort((a, b) => b.minAcceptanceRate - a.minAcceptanceRate);
  
  for (const config of sortedConfigs) {
    if (acceptanceRate >= config.minAcceptanceRate) {
      const bonusAmount = Math.round((baseEarnings * config.bonusPercent / 100) * 100) / 100;
      return { bonusPercent: config.bonusPercent, bonusAmount };
    }
  }
  
  return { bonusPercent: 0, bonusAmount: 0 };
}

export function calculateCancellationRateBonus(
  baseEarnings: number,
  cancellationRate: number,
  configs: DriverCancellationBonusConfig[] = DRIVER_CANCELLATION_BONUSES
): { bonusPercent: number; bonusAmount: number } {
  const sortedConfigs = [...configs].sort((a, b) => a.maxCancellationRate - b.maxCancellationRate);
  
  for (const config of sortedConfigs) {
    if (cancellationRate <= config.maxCancellationRate) {
      const bonusAmount = Math.round((baseEarnings * config.bonusPercent / 100) * 100) / 100;
      return { bonusPercent: config.bonusPercent, bonusAmount };
    }
  }
  
  return { bonusPercent: 0, bonusAmount: 0 };
}

// ========================================
// WEEKLY GUARANTEE
// ========================================

export function checkWeeklyGuarantee(
  state: DriverLoyaltyState,
  config: WeeklyGuaranteeConfig = DEFAULT_WEEKLY_GUARANTEE_CONFIG
): { eligible: boolean; topUpAmount: number; shortfall: number } {
  const tierConfig = getDriverTierConfig(state.currentTier);
  const guaranteeAmount = config.guaranteedEarnings + tierConfig.weeklyGuaranteeBonus;
  
  const meetsHoursRequirement = state.weeklyHoursOnline >= config.minHoursOnline;
  const meetsRidesRequirement = state.weeklyRides >= config.minRidesCompleted;
  const meetsPeakHoursRequirement = state.weeklyPeakHours >= config.peakHoursRequired;
  
  const eligible = meetsHoursRequirement && meetsRidesRequirement && meetsPeakHoursRequirement;
  
  if (!eligible) {
    return { eligible: false, topUpAmount: 0, shortfall: 0 };
  }
  
  const shortfall = Math.max(0, guaranteeAmount - state.weeklyEarnings);
  const topUpAmount = Math.round(shortfall * 100) / 100;
  
  return { eligible, topUpAmount, shortfall };
}

// ========================================
// LONG-DISTANCE PICKUP BONUS
// ========================================

export function calculateLongDistancePickupBonus(
  pickupDistanceMiles: number,
  tier: DriverLoyaltyTier,
  config: LongDistancePickupConfig = DEFAULT_LONG_DISTANCE_PICKUP_CONFIG
): { isLongDistance: boolean; bonusAmount: number } {
  if (pickupDistanceMiles < config.thresholdMiles) {
    return { isLongDistance: false, bonusAmount: 0 };
  }
  
  const tierConfig = getDriverTierConfig(tier);
  const extraMiles = pickupDistanceMiles - config.thresholdMiles;
  const baseBonus = config.baseBonusAmount + (extraMiles * config.perMileBonus);
  const tierBonus = baseBonus * (1 + tierConfig.longDistancePickupBonusPercent / 100);
  const bonusAmount = Math.min(config.maxBonus, Math.round(tierBonus * 100) / 100);
  
  return { isLongDistance: true, bonusAmount };
}

// ========================================
// WEATHER PROTECTION BONUS
// ========================================

export function calculateWeatherProtectionBonus(
  baseEarnings: number,
  weatherCondition: string | undefined,
  tier: DriverLoyaltyTier
): { hasProtection: boolean; bonusAmount: number } {
  const severeWeatherConditions = ['heavy_rain', 'snow', 'storm', 'fog', 'low_visibility'];
  
  if (!weatherCondition || !severeWeatherConditions.includes(weatherCondition)) {
    return { hasProtection: false, bonusAmount: 0 };
  }
  
  const tierConfig = getDriverTierConfig(tier);
  const protectionMultiplier = tierConfig.weatherProtectionMultiplier - 1;
  const bonusAmount = Math.round((baseEarnings * protectionMultiplier) * 100) / 100;
  
  return { hasProtection: true, bonusAmount };
}

// ========================================
// STREAK TRACKING
// ========================================

export function updateStreak(
  state: DriverLoyaltyState,
  rideDate: Date,
  minRidesPerDay: number = 5
): { 
  streakContinued: boolean; 
  streakBroken: boolean; 
  newStreak: number; 
  milestoneReached: number | null;
  bonusAmount: number;
} {
  const dateStr = rideDate.toISOString().split('T')[0];
  
  let dailyRideCounts = [...state.dailyRideCounts];
  const existingDay = dailyRideCounts.find(d => d.date === dateStr);
  
  if (existingDay) {
    existingDay.count++;
  } else {
    dailyRideCounts.push({ date: dateStr, count: 1 });
  }
  
  dailyRideCounts = dailyRideCounts
    .filter(d => {
      const dayDate = new Date(d.date);
      const diffDays = Math.floor((rideDate.getTime() - dayDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 30;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  let currentStreak = 0;
  let checkDate = new Date(rideDate);
  checkDate.setHours(0, 0, 0, 0);
  
  while (true) {
    const checkDateStr = checkDate.toISOString().split('T')[0];
    const dayRecord = dailyRideCounts.find(d => d.date === checkDateStr);
    
    if (dayRecord && dayRecord.count >= minRidesPerDay) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  
  const streakBroken = currentStreak === 0 && state.currentStreak > 0;
  const streakContinued = currentStreak > 0 && currentStreak >= state.currentStreak;
  
  let milestoneReached: number | null = null;
  let bonusAmount = 0;
  
  for (const config of DRIVER_STREAK_CONFIGS) {
    if (currentStreak >= config.streakDays && state.currentStreak < config.streakDays) {
      const alreadyEarned = state.streakBonusesEarned.some(
        b => b.streakDays === config.streakDays && 
        isSameWeek(new Date(b.earnedAt), rideDate)
      );
      
      if (!alreadyEarned) {
        milestoneReached = config.streakDays;
        bonusAmount = config.bonusAmount;
        break;
      }
    }
  }
  
  return {
    streakContinued,
    streakBroken,
    newStreak: currentStreak,
    milestoneReached,
    bonusAmount,
  };
}

// ========================================
// TIER EARNINGS MULTIPLIER
// ========================================

export function calculateTierEarningsBonus(
  baseEarnings: number,
  tier: DriverLoyaltyTier
): number {
  const tierConfig = getDriverTierConfig(tier);
  const multiplier = tierConfig.earningsMultiplier - 1;
  return Math.round((baseEarnings * multiplier) * 100) / 100;
}

// ========================================
// MAIN RIDE COMPLETION PROCESSOR
// ========================================

export function processDriverRideCompletion(context: DriverLoyaltyContext): DriverLoyaltyResult {
  let state = context.driverState;
  const now = context.rideTime;
  
  if (!isSameWeek(state.weekStartDate, now)) {
    const { eligible, topUpAmount } = checkWeeklyGuarantee(state);
    if (eligible && topUpAmount > 0) {
      addRewardLedgerEntry({
        actorId: context.driverId,
        actorType: 'driver',
        rewardType: 'weekly_guarantee_payout',
        amount: topUpAmount,
        description: `Weekly guarantee top-up for previous week`,
      });
    }
    
    state = {
      ...state,
      weeklyRides: 0,
      weeklyEarnings: 0,
      weeklyHoursOnline: 0,
      weeklyPeakHours: 0,
      weeklyGuaranteeEligible: false,
      weeklyGuaranteePayout: 0,
      weekStartDate: getWeekStartDate(now),
    };
  }
  
  if (!isSameMonth(state.monthStartDate, now)) {
    state = {
      ...state,
      monthlyRides: 0,
      monthStartDate: getMonthStartDate(now),
    };
  }
  
  const tierEarningsBonus = calculateTierEarningsBonus(context.baseDriverEarnings, state.currentTier);
  
  const { bonusPercent: acceptanceBonusPercent, bonusAmount: acceptanceRateBonus } = 
    calculateAcceptanceRateBonus(context.baseDriverEarnings, context.acceptanceRateCurrent);
  
  const { bonusPercent: cancellationBonusPercent, bonusAmount: cancellationRateBonus } = 
    calculateCancellationRateBonus(context.baseDriverEarnings, context.cancellationRateCurrent);
  
  const { isLongDistance, bonusAmount: longDistancePickupBonus } = 
    calculateLongDistancePickupBonus(context.pickupDistanceMiles, state.currentTier);
  
  const { hasProtection, bonusAmount: weatherProtectionBonus } = 
    calculateWeatherProtectionBonus(context.baseDriverEarnings, context.weatherCondition, state.currentTier);
  
  const { 
    streakContinued, 
    streakBroken, 
    newStreak, 
    milestoneReached, 
    bonusAmount: streakBonus 
  } = updateStreak(state, now);
  
  const bonusBreakdown: DriverLoyaltyBonusBreakdown = {
    tierEarningsBonus,
    acceptanceRateBonus,
    cancellationRateBonus,
    streakBonus,
    longDistancePickupBonus,
    weatherProtectionBonus,
    weeklyGuaranteeTopUp: 0,
    totalLoyaltyBonus: tierEarningsBonus + acceptanceRateBonus + cancellationRateBonus + 
      streakBonus + longDistancePickupBonus + weatherProtectionBonus,
  };
  
  const newLifetimeRides = state.lifetimeRides + 1;
  const newWeeklyRides = state.weeklyRides + 1;
  const newMonthlyRides = state.monthlyRides + 1;
  const newWeeklyEarnings = state.weeklyEarnings + context.baseDriverEarnings + bonusBreakdown.totalLoyaltyBonus;
  
  const updatedStateForTierCheck: DriverLoyaltyState = {
    ...state,
    lifetimeRides: newLifetimeRides,
    acceptanceRate: context.acceptanceRateCurrent,
    cancellationRate: context.cancellationRateCurrent,
  };
  
  const { upgraded, downgraded, newTier, progressToNext, ridesToNext } = 
    checkDriverTierProgression(updatedStateForTierCheck);
  
  let dailyRideCounts = [...state.dailyRideCounts];
  const dateStr = now.toISOString().split('T')[0];
  const existingDay = dailyRideCounts.find(d => d.date === dateStr);
  if (existingDay) {
    existingDay.count++;
  } else {
    dailyRideCounts.push({ date: dateStr, count: 1 });
  }
  dailyRideCounts = dailyRideCounts.slice(-30);
  
  let streakBonuses = [...state.streakBonusesEarned];
  if (milestoneReached) {
    streakBonuses.push({
      streakDays: milestoneReached,
      earnedAt: now,
      amount: streakBonus,
    });
  }
  
  const updatedState: DriverLoyaltyState = {
    ...state,
    currentTier: newTier,
    lifetimeRides: newLifetimeRides,
    weeklyRides: newWeeklyRides,
    monthlyRides: newMonthlyRides,
    weeklyEarnings: newWeeklyEarnings,
    weeklyHoursOnline: context.hoursOnlineThisWeek,
    weeklyPeakHours: context.peakHoursThisWeek,
    acceptanceRate: context.acceptanceRateCurrent,
    cancellationRate: context.cancellationRateCurrent,
    currentStreak: newStreak,
    longestStreak: Math.max(state.longestStreak, newStreak),
    dailyRideCounts,
    streakBonusesEarned: streakBonuses,
    tierProgress: progressToNext,
    ridesToNextTier: ridesToNext,
    lastRideDate: now,
  };
  
  driverLoyaltyStore.set(context.driverId, updatedState);
  
  if (tierEarningsBonus > 0) {
    addRewardLedgerEntry({
      actorId: context.driverId,
      actorType: 'driver',
      rewardType: 'streak_bonus',
      amount: tierEarningsBonus,
      rideId: context.rideId,
      description: `${state.currentTier} tier earnings bonus`,
    });
  }
  
  if (acceptanceRateBonus > 0) {
    addRewardLedgerEntry({
      actorId: context.driverId,
      actorType: 'driver',
      rewardType: 'acceptance_bonus',
      amount: acceptanceRateBonus,
      rideId: context.rideId,
      description: `Acceptance rate bonus (${acceptanceBonusPercent}% for ${context.acceptanceRateCurrent}% rate)`,
    });
  }
  
  if (cancellationRateBonus > 0) {
    addRewardLedgerEntry({
      actorId: context.driverId,
      actorType: 'driver',
      rewardType: 'cancellation_bonus',
      amount: cancellationRateBonus,
      rideId: context.rideId,
      description: `Low cancellation bonus (${cancellationBonusPercent}% for ${context.cancellationRateCurrent}% rate)`,
    });
  }
  
  if (longDistancePickupBonus > 0) {
    addRewardLedgerEntry({
      actorId: context.driverId,
      actorType: 'driver',
      rewardType: 'long_distance_bonus',
      amount: longDistancePickupBonus,
      rideId: context.rideId,
      description: `Long-distance pickup bonus (${context.pickupDistanceMiles.toFixed(1)} miles)`,
    });
  }
  
  if (weatherProtectionBonus > 0) {
    addRewardLedgerEntry({
      actorId: context.driverId,
      actorType: 'driver',
      rewardType: 'weather_protection_bonus',
      amount: weatherProtectionBonus,
      rideId: context.rideId,
      description: `Weather protection bonus (${context.weatherCondition})`,
    });
  }
  
  if (streakBonus > 0 && milestoneReached) {
    addRewardLedgerEntry({
      actorId: context.driverId,
      actorType: 'driver',
      rewardType: 'streak_bonus',
      amount: streakBonus,
      rideId: context.rideId,
      description: `${milestoneReached}-day streak milestone bonus`,
    });
  }
  
  if (upgraded) {
    addRewardLedgerEntry({
      actorId: context.driverId,
      actorType: 'driver',
      rewardType: 'tier_upgrade_bonus',
      amount: 0,
      description: `Tier upgraded from ${state.currentTier} to ${newTier}`,
    });
  }
  
  const tierConfig = getDriverTierConfig(newTier);
  
  return {
    bonusBreakdown,
    tierUpgraded: upgraded,
    newTier: upgraded ? newTier : null,
    streakContinued,
    streakBroken,
    newStreakDays: newStreak,
    streakMilestoneReached: milestoneReached,
    weeklyGuaranteeTriggered: false,
    flags: {
      isLongDistancePickup: isLongDistance,
      hasWeatherProtection: hasProtection,
      hasAcceptanceBonus: acceptanceRateBonus > 0,
      hasCancellationBonus: cancellationRateBonus > 0,
      hasStreakBonus: streakBonus > 0,
      hasWeeklyGuarantee: false,
      tierJustUpgraded: upgraded,
      streakJustBroken: streakBroken,
      streakMilestoneJustReached: milestoneReached !== null,
      priorityDispatchEnabled: tierConfig.priorityDispatch,
    },
  };
}

// ========================================
// DAILY BATCH PROCESSING
// ========================================

export interface DailyDriverProcessingResult {
  processedAt: Date;
  driversProcessed: number;
  tierUpgrades: { driverId: string; from: DriverLoyaltyTier; to: DriverLoyaltyTier }[];
  tierDowngrades: { driverId: string; from: DriverLoyaltyTier; to: DriverLoyaltyTier }[];
  weeklyGuaranteesTriggered: { driverId: string; amount: number }[];
  streaksBroken: number;
  streakMilestonesReached: number;
}

export function runDailyDriverProcessing(): DailyDriverProcessingResult {
  const now = new Date();
  const result: DailyDriverProcessingResult = {
    processedAt: now,
    driversProcessed: 0,
    tierUpgrades: [],
    tierDowngrades: [],
    weeklyGuaranteesTriggered: [],
    streaksBroken: 0,
    streakMilestonesReached: 0,
  };
  
  const entries = Array.from(driverLoyaltyStore.entries());
  for (const [driverId, state] of entries) {
    result.driversProcessed++;
    
    if (!isSameWeek(state.weekStartDate, now)) {
      const { eligible, topUpAmount } = checkWeeklyGuarantee(state);
      
      if (eligible && topUpAmount > 0) {
        result.weeklyGuaranteesTriggered.push({ driverId, amount: topUpAmount });
        
        addRewardLedgerEntry({
          actorId: driverId,
          actorType: 'driver',
          rewardType: 'weekly_guarantee_payout',
          amount: topUpAmount,
          description: `Weekly guarantee top-up`,
        });
      }
      
      updateDriverLoyaltyState(driverId, {
        weeklyRides: 0,
        weeklyEarnings: 0,
        weeklyHoursOnline: 0,
        weeklyPeakHours: 0,
        weeklyGuaranteeEligible: false,
        weeklyGuaranteePayout: topUpAmount,
        weekStartDate: getWeekStartDate(now),
      });
    }
    
    if (!isSameMonth(state.monthStartDate, now)) {
      updateDriverLoyaltyState(driverId, {
        monthlyRides: 0,
        monthStartDate: getMonthStartDate(now),
      });
    }
    
    const { upgraded, downgraded, newTier } = checkDriverTierProgression(state);
    
    if (upgraded) {
      result.tierUpgrades.push({ driverId, from: state.currentTier, to: newTier });
      updateDriverLoyaltyState(driverId, { currentTier: newTier });
    } else if (downgraded) {
      result.tierDowngrades.push({ driverId, from: state.currentTier, to: newTier });
      updateDriverLoyaltyState(driverId, { currentTier: newTier });
    }
    
    if (state.lastRideDate) {
      const daysSinceLastRide = Math.floor(
        (now.getTime() - state.lastRideDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceLastRide > 1 && state.currentStreak > 0) {
        result.streaksBroken++;
        updateDriverLoyaltyState(driverId, { currentStreak: 0 });
      }
    }
  }
  
  console.log(`[DriverLoyaltyEngine] Daily processing complete: ${result.driversProcessed} drivers processed`);
  
  return result;
}

// ========================================
// ADMIN METRICS
// ========================================

export function getDriverLoyaltyMetrics(): {
  totalDrivers: number;
  driversByTier: Record<DriverLoyaltyTier, number>;
  avgAcceptanceRate: number;
  avgCancellationRate: number;
  totalLoyaltyBonusesPaid: number;
  totalWeeklyGuaranteesPaid: number;
  avgStreakDays: number;
  streakMilestonesReached: Record<number, number>;
} {
  const driversByTier: Record<DriverLoyaltyTier, number> = {
    silver: 0,
    gold: 0,
    platinum: 0,
    diamond: 0,
  };
  
  let totalAcceptanceRate = 0;
  let totalCancellationRate = 0;
  let totalStreakDays = 0;
  const streakMilestonesReached: Record<number, number> = { 7: 0, 14: 0, 30: 0 };
  
  const states = Array.from(driverLoyaltyStore.values());
  for (const state of states) {
    driversByTier[state.currentTier]++;
    totalAcceptanceRate += state.acceptanceRate;
    totalCancellationRate += state.cancellationRate;
    totalStreakDays += state.currentStreak;
    
    for (const bonus of state.streakBonusesEarned) {
      if (streakMilestonesReached[bonus.streakDays] !== undefined) {
        streakMilestonesReached[bonus.streakDays]++;
      }
    }
  }
  
  const totalDrivers = driverLoyaltyStore.size;
  
  const loyaltyBonuses = rewardLedger.filter(e => 
    e.actorType === 'driver' && 
    ['acceptance_bonus', 'cancellation_bonus', 'streak_bonus', 'long_distance_bonus', 'weather_protection_bonus'].includes(e.rewardType)
  );
  
  const guaranteeBonuses = rewardLedger.filter(e => 
    e.actorType === 'driver' && e.rewardType === 'weekly_guarantee_payout'
  );
  
  return {
    totalDrivers,
    driversByTier,
    avgAcceptanceRate: totalDrivers > 0 ? Math.round(totalAcceptanceRate / totalDrivers) : 0,
    avgCancellationRate: totalDrivers > 0 ? Math.round((totalCancellationRate / totalDrivers) * 10) / 10 : 0,
    totalLoyaltyBonusesPaid: loyaltyBonuses.reduce((sum, e) => sum + e.amount, 0),
    totalWeeklyGuaranteesPaid: guaranteeBonuses.reduce((sum, e) => sum + e.amount, 0),
    avgStreakDays: totalDrivers > 0 ? Math.round(totalStreakDays / totalDrivers) : 0,
    streakMilestonesReached,
  };
}

export function getDriverRewardHistory(driverId: string, limit: number = 50): RewardLedgerEntry[] {
  return rewardLedger
    .filter(e => e.actorId === driverId && e.actorType === 'driver')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

// ========================================
// EXPORTS
// ========================================

export default {
  getDriverLoyaltyState,
  createDriverLoyaltyState,
  updateDriverLoyaltyState,
  checkDriverTierProgression,
  calculateAcceptanceRateBonus,
  calculateCancellationRateBonus,
  checkWeeklyGuarantee,
  calculateLongDistancePickupBonus,
  calculateWeatherProtectionBonus,
  updateStreak,
  calculateTierEarningsBonus,
  processDriverRideCompletion,
  runDailyDriverProcessing,
  getDriverLoyaltyMetrics,
  getDriverRewardHistory,
  DRIVER_TIER_CONFIGS,
  DRIVER_STREAK_CONFIGS,
  DRIVER_ACCEPTANCE_BONUSES,
  DRIVER_CANCELLATION_BONUSES,
  DEFAULT_WEEKLY_GUARANTEE_CONFIG,
  DEFAULT_LONG_DISTANCE_PICKUP_CONFIG,
};
