/**
 * SafeGo Rider Loyalty Engine
 * 
 * Comprehensive rider loyalty program featuring:
 * - Tiered rewards: Bronze → Silver → Gold → Platinum
 * - Points per ride based on fare, time, and location
 * - Weekly and monthly ride goals with rewards
 * - Auto-applied ride credits
 * - Birthday rewards
 * - Off-peak discounts for loyal riders
 * - Referral bonus integration
 * 
 * Integration:
 * - Real-time updates per completed ride
 * - Daily batch processing at 2 AM for tier updates, goal resets
 * - Integrates with fare engine for discount application
 */

import {
  RiderTier,
  RiderLoyaltyState,
  RiderLoyaltyResult,
  RiderPointsBreakdown,
  RiderLoyaltyContext,
  RiderTierConfig,
  RiderPointsConfig,
  RiderWeeklyGoal,
  RiderMonthlyGoal,
  RewardLedgerEntry,
  RIDER_TIER_CONFIGS,
  DEFAULT_RIDER_POINTS_CONFIG,
  DEFAULT_RIDER_WEEKLY_GOALS,
  DEFAULT_RIDER_MONTHLY_GOALS,
  getRiderTierConfig,
  calculateRiderTier,
  getNextRiderTier,
  getWeekStartDate,
  getMonthStartDate,
  isOffPeakTime,
  isSameWeek,
  isSameMonth,
  isBirthday,
} from '@shared/loyalty';

// ========================================
// STATE MANAGEMENT (In-Memory Store)
// ========================================

const riderLoyaltyStore: Map<string, RiderLoyaltyState> = new Map();
const rewardLedger: RewardLedgerEntry[] = [];

export function getRiderLoyaltyState(riderId: string): RiderLoyaltyState | null {
  return riderLoyaltyStore.get(riderId) ?? null;
}

export function createRiderLoyaltyState(riderId: string, birthdayMonth?: number, birthdayDay?: number): RiderLoyaltyState {
  const now = new Date();
  const state: RiderLoyaltyState = {
    riderId,
    currentTier: 'bronze',
    lifetimePoints: 0,
    currentPoints: 0,
    availableCredits: 0,
    weeklyRideCount: 0,
    weeklyGoalProgress: DEFAULT_RIDER_WEEKLY_GOALS.map(g => ({
      goalId: g.id,
      completed: false,
      completedAt: null,
    })),
    monthlyRideCount: 0,
    monthlyGoalProgress: DEFAULT_RIDER_MONTHLY_GOALS.map(g => ({
      goalId: g.id,
      completed: false,
      completedAt: null,
    })),
    referralCount: 0,
    referralCreditsEarned: 0,
    birthdayMonth: birthdayMonth ?? null,
    birthdayDay: birthdayDay ?? null,
    birthdayRewardClaimedThisYear: false,
    nextTierProgress: 0,
    pointsToNextTier: RIDER_TIER_CONFIGS[1].minLifetimePoints,
    memberSince: now,
    lastRideDate: null,
    weekStartDate: getWeekStartDate(now),
    monthStartDate: getMonthStartDate(now),
  };
  riderLoyaltyStore.set(riderId, state);
  return state;
}

export function updateRiderLoyaltyState(riderId: string, updates: Partial<RiderLoyaltyState>): RiderLoyaltyState | null {
  const state = riderLoyaltyStore.get(riderId);
  if (!state) return null;
  
  const updated = { ...state, ...updates };
  riderLoyaltyStore.set(riderId, updated);
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
// POINTS CALCULATION
// ========================================

export function calculateRidePoints(
  context: RiderLoyaltyContext,
  config: RiderPointsConfig = DEFAULT_RIDER_POINTS_CONFIG
): RiderPointsBreakdown {
  const tierConfig = getRiderTierConfig(context.riderState.currentTier);
  
  const basePoints = Math.floor(context.fareAmount * config.basePointsPerDollar);
  
  const tierMultiplierPoints = Math.floor(basePoints * (tierConfig.pointsMultiplier - 1));
  
  let timeBonusPoints = 0;
  if (context.isOffPeak) {
    timeBonusPoints = config.offPeakBonus;
  }
  
  let locationBonusPoints = 0;
  if (context.isAirport) {
    locationBonusPoints = config.airportBonus;
  }
  
  let distanceBonusPoints = 0;
  if (context.distanceMiles >= config.longDistanceThresholdMiles) {
    distanceBonusPoints = config.longDistanceBonus;
  }
  
  let goalBonusPoints = 0;
  
  const totalPoints = basePoints + tierMultiplierPoints + timeBonusPoints + locationBonusPoints + distanceBonusPoints + goalBonusPoints;
  
  return {
    basePoints,
    tierMultiplierPoints,
    timeBonusPoints,
    locationBonusPoints,
    distanceBonusPoints,
    goalBonusPoints,
    totalPoints,
  };
}

const processedReferrals = new Set<string>();

export function hasReferralBeenProcessed(referrerId: string, referredId: string): boolean {
  return processedReferrals.has(`${referrerId}:${referredId}`);
}

export function markReferralProcessed(referrerId: string, referredId: string): void {
  processedReferrals.add(`${referrerId}:${referredId}`);
}

// ========================================
// GOAL TRACKING
// ========================================

export function checkWeeklyGoals(
  state: RiderLoyaltyState,
  goals: RiderWeeklyGoal[] = DEFAULT_RIDER_WEEKLY_GOALS
): { completedGoal: RiderWeeklyGoal | null; newProgress: typeof state.weeklyGoalProgress } {
  let completedGoal: RiderWeeklyGoal | null = null;
  const newProgress = state.weeklyGoalProgress.map(progress => {
    if (progress.completed) return progress;
    
    const goal = goals.find(g => g.id === progress.goalId);
    if (!goal) return progress;
    
    if (state.weeklyRideCount >= goal.ridesRequired) {
      if (!completedGoal || goal.ridesRequired > completedGoal.ridesRequired) {
        completedGoal = goal;
      }
      return {
        ...progress,
        completed: true,
        completedAt: new Date(),
      };
    }
    return progress;
  });
  
  return { completedGoal, newProgress };
}

export function checkMonthlyGoals(
  state: RiderLoyaltyState,
  goals: RiderMonthlyGoal[] = DEFAULT_RIDER_MONTHLY_GOALS
): { completedGoal: RiderMonthlyGoal | null; newProgress: typeof state.monthlyGoalProgress } {
  let completedGoal: RiderMonthlyGoal | null = null;
  const newProgress = state.monthlyGoalProgress.map(progress => {
    if (progress.completed) return progress;
    
    const goal = goals.find(g => g.id === progress.goalId);
    if (!goal) return progress;
    
    if (state.monthlyRideCount >= goal.ridesRequired) {
      if (!completedGoal || goal.ridesRequired > completedGoal.ridesRequired) {
        completedGoal = goal;
      }
      return {
        ...progress,
        completed: true,
        completedAt: new Date(),
      };
    }
    return progress;
  });
  
  return { completedGoal, newProgress };
}

// ========================================
// CREDITS & DISCOUNTS
// ========================================

export function calculateOffPeakDiscount(
  fareAmount: number,
  tier: RiderTier,
  isOffPeak: boolean
): { discountAmount: number; discountPercent: number } {
  if (!isOffPeak) {
    return { discountAmount: 0, discountPercent: 0 };
  }
  
  const tierConfig = getRiderTierConfig(tier);
  const discountPercent = tierConfig.offPeakDiscountPercent;
  const discountAmount = Math.round((fareAmount * discountPercent / 100) * 100) / 100;
  
  return { discountAmount, discountPercent };
}

export function applyCredits(
  fareAmount: number,
  availableCredits: number,
  useCredits: boolean
): { creditsApplied: number; remainingFare: number; remainingCredits: number } {
  if (!useCredits || availableCredits <= 0) {
    return {
      creditsApplied: 0,
      remainingFare: fareAmount,
      remainingCredits: availableCredits,
    };
  }
  
  const creditsApplied = Math.min(availableCredits, fareAmount);
  const remainingFare = Math.max(0, fareAmount - creditsApplied);
  const remainingCredits = availableCredits - creditsApplied;
  
  return { creditsApplied, remainingFare, remainingCredits };
}

// ========================================
// TIER PROGRESSION
// ========================================

export function checkTierProgression(
  currentTier: RiderTier,
  lifetimePoints: number
): { upgraded: boolean; newTier: RiderTier; progressToNext: number; pointsToNext: number | null } {
  const newTier = calculateRiderTier(lifetimePoints);
  const upgraded = newTier !== currentTier && 
    RIDER_TIER_CONFIGS.findIndex(c => c.tier === newTier) > 
    RIDER_TIER_CONFIGS.findIndex(c => c.tier === currentTier);
  
  const nextTier = getNextRiderTier(newTier);
  let progressToNext = 100;
  let pointsToNext: number | null = null;
  
  if (nextTier) {
    const currentConfig = getRiderTierConfig(newTier);
    const nextConfig = getRiderTierConfig(nextTier);
    const pointsInCurrentTier = lifetimePoints - currentConfig.minLifetimePoints;
    const pointsNeededForNext = nextConfig.minLifetimePoints - currentConfig.minLifetimePoints;
    progressToNext = Math.min(100, Math.floor((pointsInCurrentTier / pointsNeededForNext) * 100));
    pointsToNext = nextConfig.minLifetimePoints - lifetimePoints;
  }
  
  return { upgraded, newTier, progressToNext, pointsToNext };
}

// ========================================
// BIRTHDAY REWARDS
// ========================================

export function checkBirthdayReward(
  state: RiderLoyaltyState,
  checkDate: Date = new Date()
): { available: boolean; credits: number } {
  if (state.birthdayRewardClaimedThisYear) {
    return { available: false, credits: 0 };
  }
  
  if (!isBirthday(state.birthdayMonth, state.birthdayDay, checkDate)) {
    return { available: false, credits: 0 };
  }
  
  const tierConfig = getRiderTierConfig(state.currentTier);
  return { available: true, credits: tierConfig.birthdayRewardCredits };
}

export function claimBirthdayReward(riderId: string): { success: boolean; credits: number } {
  const state = getRiderLoyaltyState(riderId);
  if (!state) {
    return { success: false, credits: 0 };
  }
  
  const { available, credits } = checkBirthdayReward(state);
  if (!available) {
    return { success: false, credits: 0 };
  }
  
  updateRiderLoyaltyState(riderId, {
    availableCredits: state.availableCredits + credits,
    birthdayRewardClaimedThisYear: true,
  });
  
  addRewardLedgerEntry({
    actorId: riderId,
    actorType: 'rider',
    rewardType: 'birthday_reward',
    amount: credits,
    description: `Birthday reward for ${state.currentTier} tier`,
  });
  
  return { success: true, credits };
}

// ========================================
// REFERRAL SYSTEM
// ========================================

export function processReferralBonus(
  referrerId: string,
  newRiderId: string,
  config: RiderPointsConfig = DEFAULT_RIDER_POINTS_CONFIG
): { success: boolean; bonusPoints: number; alreadyProcessed: boolean } {
  if (hasReferralBeenProcessed(referrerId, newRiderId)) {
    return { success: false, bonusPoints: 0, alreadyProcessed: true };
  }
  
  const referrerState = getRiderLoyaltyState(referrerId);
  if (!referrerState) {
    return { success: false, bonusPoints: 0, alreadyProcessed: false };
  }
  
  const bonusPoints = config.referralBonus;
  
  updateRiderLoyaltyState(referrerId, {
    lifetimePoints: referrerState.lifetimePoints + bonusPoints,
    currentPoints: referrerState.currentPoints + bonusPoints,
    referralCount: referrerState.referralCount + 1,
    referralCreditsEarned: referrerState.referralCreditsEarned + 10,
    availableCredits: referrerState.availableCredits + 10,
  });
  
  markReferralProcessed(referrerId, newRiderId);
  
  addRewardLedgerEntry({
    actorId: referrerId,
    actorType: 'rider',
    rewardType: 'referral_bonus',
    amount: bonusPoints,
    description: `Referral bonus for inviting rider ${newRiderId}`,
    metadata: { referredRiderId: newRiderId },
  });
  
  return { success: true, bonusPoints, alreadyProcessed: false };
}

// ========================================
// MAIN RIDE COMPLETION PROCESSOR
// ========================================

export function processRideCompletion(context: RiderLoyaltyContext): RiderLoyaltyResult {
  let state = context.riderState;
  const now = context.rideTime;
  
  if (!isSameWeek(state.weekStartDate, now)) {
    state = {
      ...state,
      weeklyRideCount: 0,
      weeklyGoalProgress: DEFAULT_RIDER_WEEKLY_GOALS.map(g => ({
        goalId: g.id,
        completed: false,
        completedAt: null,
      })),
      weekStartDate: getWeekStartDate(now),
    };
  }
  
  if (!isSameMonth(state.monthStartDate, now)) {
    const currentYear = now.getFullYear();
    const lastYear = state.monthStartDate.getFullYear();
    
    state = {
      ...state,
      monthlyRideCount: 0,
      monthlyGoalProgress: DEFAULT_RIDER_MONTHLY_GOALS.map(g => ({
        goalId: g.id,
        completed: false,
        completedAt: null,
      })),
      monthStartDate: getMonthStartDate(now),
      birthdayRewardClaimedThisYear: currentYear !== lastYear ? false : state.birthdayRewardClaimedThisYear,
    };
  }
  
  const pointsBreakdown = calculateRidePoints(context);
  
  const { discountAmount, discountPercent } = calculateOffPeakDiscount(
    context.fareAmount,
    state.currentTier,
    context.isOffPeak
  );
  
  const { creditsApplied, remainingCredits } = applyCredits(
    context.fareAmount - discountAmount,
    state.availableCredits,
    context.useCredits
  );
  
  const { available: birthdayAvailable } = checkBirthdayReward(state, now);
  
  const newWeeklyRideCount = state.weeklyRideCount + 1;
  const newMonthlyRideCount = state.monthlyRideCount + 1;
  
  const tempState = { ...state, weeklyRideCount: newWeeklyRideCount, monthlyRideCount: newMonthlyRideCount };
  const { completedGoal: weeklyGoalCompleted, newProgress: weeklyProgress } = checkWeeklyGoals(tempState);
  const { completedGoal: monthlyGoalCompleted, newProgress: monthlyProgress } = checkMonthlyGoals({
    ...tempState,
    weeklyGoalProgress: weeklyProgress,
  });
  
  let goalBonusPoints = 0;
  let goalCredits = 0;
  
  if (weeklyGoalCompleted) {
    goalBonusPoints += weeklyGoalCompleted.pointsBonus;
    goalCredits += weeklyGoalCompleted.creditReward;
  }
  
  if (monthlyGoalCompleted) {
    const tierConfig = getRiderTierConfig(state.currentTier);
    const multiplier = monthlyGoalCompleted.tierMultiplierApplied ? tierConfig.monthlyGoalBonusMultiplier : 1;
    goalBonusPoints += Math.floor(monthlyGoalCompleted.pointsBonus * multiplier);
    goalCredits += Math.floor(monthlyGoalCompleted.creditReward * multiplier);
  }
  
  const finalPointsBreakdown: RiderPointsBreakdown = {
    ...pointsBreakdown,
    goalBonusPoints,
    totalPoints: pointsBreakdown.totalPoints + goalBonusPoints,
  };
  
  let firstRideBonus = 0;
  if (context.isFirstRide) {
    firstRideBonus = DEFAULT_RIDER_POINTS_CONFIG.firstRideBonus;
    finalPointsBreakdown.totalPoints += firstRideBonus;
  }
  
  const newLifetimePoints = state.lifetimePoints + finalPointsBreakdown.totalPoints;
  const { upgraded, newTier, progressToNext, pointsToNext } = checkTierProgression(state.currentTier, newLifetimePoints);
  
  const updatedState: RiderLoyaltyState = {
    ...state,
    currentTier: newTier,
    lifetimePoints: newLifetimePoints,
    currentPoints: state.currentPoints + finalPointsBreakdown.totalPoints,
    availableCredits: remainingCredits + goalCredits,
    weeklyRideCount: newWeeklyRideCount,
    weeklyGoalProgress: weeklyProgress,
    monthlyRideCount: newMonthlyRideCount,
    monthlyGoalProgress: monthlyProgress,
    nextTierProgress: progressToNext,
    pointsToNextTier: pointsToNext,
    lastRideDate: now,
  };
  
  riderLoyaltyStore.set(context.riderId, updatedState);
  
  addRewardLedgerEntry({
    actorId: context.riderId,
    actorType: 'rider',
    rewardType: 'points_earned',
    amount: finalPointsBreakdown.totalPoints,
    rideId: context.rideId,
    description: `Points earned for ride: ${finalPointsBreakdown.basePoints} base + ${finalPointsBreakdown.tierMultiplierPoints} tier + ${finalPointsBreakdown.timeBonusPoints + finalPointsBreakdown.locationBonusPoints + finalPointsBreakdown.distanceBonusPoints} bonus + ${goalBonusPoints} goal`,
  });
  
  if (creditsApplied > 0) {
    addRewardLedgerEntry({
      actorId: context.riderId,
      actorType: 'rider',
      rewardType: 'credits_used',
      amount: -creditsApplied,
      rideId: context.rideId,
      description: `Credits applied to ride fare`,
    });
  }
  
  if (goalCredits > 0) {
    addRewardLedgerEntry({
      actorId: context.riderId,
      actorType: 'rider',
      rewardType: 'goal_bonus',
      amount: goalCredits,
      rideId: context.rideId,
      description: `Goal completion bonus credits`,
    });
  }
  
  if (upgraded) {
    addRewardLedgerEntry({
      actorId: context.riderId,
      actorType: 'rider',
      rewardType: 'tier_upgrade_bonus',
      amount: 0,
      description: `Tier upgraded from ${state.currentTier} to ${newTier}`,
    });
  }
  
  return {
    pointsEarned: finalPointsBreakdown,
    creditsApplied,
    offPeakDiscountApplied: discountAmount,
    offPeakDiscountPercent: discountPercent,
    birthdayRewardAvailable: birthdayAvailable,
    weeklyGoalCompleted: weeklyGoalCompleted?.id ?? null,
    monthlyGoalCompleted: monthlyGoalCompleted?.id ?? null,
    tierUpgraded: upgraded,
    newTier: upgraded ? newTier : null,
    flags: {
      isOffPeak: context.isOffPeak,
      isAirport: context.isAirport,
      isLongDistance: context.distanceMiles >= DEFAULT_RIDER_POINTS_CONFIG.longDistanceThresholdMiles,
      isBirthday: birthdayAvailable,
      isFirstRide: context.isFirstRide,
      wasReferred: context.wasReferred,
      creditAutoApplied: creditsApplied > 0 && context.useCredits,
      weeklyGoalJustCompleted: weeklyGoalCompleted !== null,
      monthlyGoalJustCompleted: monthlyGoalCompleted !== null,
      tierJustUpgraded: upgraded,
    },
  };
}

// ========================================
// DAILY BATCH PROCESSING
// ========================================

export interface DailyRiderProcessingResult {
  processedAt: Date;
  ridersProcessed: number;
  tierUpgrades: { riderId: string; from: RiderTier; to: RiderTier }[];
  tierDowngrades: { riderId: string; from: RiderTier; to: RiderTier }[];
  weeklyGoalsReset: number;
  monthlyGoalsReset: number;
  birthdayRewardsIssued: { riderId: string; credits: number }[];
  birthdayFlagsReset: number;
}

export function runDailyRiderProcessing(): DailyRiderProcessingResult {
  const now = new Date();
  const result: DailyRiderProcessingResult = {
    processedAt: now,
    ridersProcessed: 0,
    tierUpgrades: [],
    tierDowngrades: [],
    weeklyGoalsReset: 0,
    monthlyGoalsReset: 0,
    birthdayRewardsIssued: [],
    birthdayFlagsReset: 0,
  };
  
  const entries = Array.from(riderLoyaltyStore.entries());
  for (const [riderId, state] of entries) {
    result.ridersProcessed++;
    
    if (!isSameWeek(state.weekStartDate, now)) {
      updateRiderLoyaltyState(riderId, {
        weeklyRideCount: 0,
        weeklyGoalProgress: DEFAULT_RIDER_WEEKLY_GOALS.map((g: RiderWeeklyGoal) => ({
          goalId: g.id,
          completed: false,
          completedAt: null,
        })),
        weekStartDate: getWeekStartDate(now),
      });
      result.weeklyGoalsReset++;
    }
    
    if (!isSameMonth(state.monthStartDate, now)) {
      const shouldResetBirthday = now.getFullYear() !== state.monthStartDate.getFullYear();
      updateRiderLoyaltyState(riderId, {
        monthlyRideCount: 0,
        monthlyGoalProgress: DEFAULT_RIDER_MONTHLY_GOALS.map((g: RiderMonthlyGoal) => ({
          goalId: g.id,
          completed: false,
          completedAt: null,
        })),
        monthStartDate: getMonthStartDate(now),
        birthdayRewardClaimedThisYear: shouldResetBirthday ? false : state.birthdayRewardClaimedThisYear,
      });
      result.monthlyGoalsReset++;
      if (shouldResetBirthday) {
        result.birthdayFlagsReset++;
      }
    }
    
    const { available } = checkBirthdayReward(state, now);
    if (available) {
      const { success, credits: claimedCredits } = claimBirthdayReward(riderId);
      if (success) {
        result.birthdayRewardsIssued.push({ riderId, credits: claimedCredits });
      }
    }
  }
  
  console.log(`[RiderLoyaltyEngine] Daily processing complete: ${result.ridersProcessed} riders processed`);
  
  return result;
}

// ========================================
// ADMIN METRICS
// ========================================

export function getRiderLoyaltyMetrics(): {
  totalRiders: number;
  ridersByTier: Record<RiderTier, number>;
  totalPointsIssued: number;
  totalCreditsIssued: number;
  avgPointsPerRide: number;
  weeklyGoalCompletionRate: number;
  monthlyGoalCompletionRate: number;
} {
  const ridersByTier: Record<RiderTier, number> = {
    bronze: 0,
    silver: 0,
    gold: 0,
    platinum: 0,
  };
  
  let totalPoints = 0;
  let totalCredits = 0;
  let weeklyGoalsCompleted = 0;
  let monthlyGoalsCompleted = 0;
  let totalWeeklyGoals = 0;
  let totalMonthlyGoals = 0;
  
  const states = Array.from(riderLoyaltyStore.values());
  for (const state of states) {
    ridersByTier[state.currentTier]++;
    totalPoints += state.lifetimePoints;
    totalCredits += state.referralCreditsEarned + 
      state.weeklyGoalProgress.filter((g: { completed: boolean }) => g.completed).length * 5 +
      state.monthlyGoalProgress.filter((g: { completed: boolean }) => g.completed).length * 25;
    
    weeklyGoalsCompleted += state.weeklyGoalProgress.filter((g: { completed: boolean }) => g.completed).length;
    monthlyGoalsCompleted += state.monthlyGoalProgress.filter((g: { completed: boolean }) => g.completed).length;
    totalWeeklyGoals += state.weeklyGoalProgress.length;
    totalMonthlyGoals += state.monthlyGoalProgress.length;
  }
  
  const totalRiders = riderLoyaltyStore.size;
  const totalRides = rewardLedger.filter(e => e.rewardType === 'points_earned').length;
  
  return {
    totalRiders,
    ridersByTier,
    totalPointsIssued: totalPoints,
    totalCreditsIssued: totalCredits,
    avgPointsPerRide: totalRides > 0 ? Math.round(totalPoints / totalRides) : 0,
    weeklyGoalCompletionRate: totalWeeklyGoals > 0 ? Math.round((weeklyGoalsCompleted / totalWeeklyGoals) * 100) : 0,
    monthlyGoalCompletionRate: totalMonthlyGoals > 0 ? Math.round((monthlyGoalsCompleted / totalMonthlyGoals) * 100) : 0,
  };
}

export function getRiderRewardHistory(riderId: string, limit: number = 50): RewardLedgerEntry[] {
  return rewardLedger
    .filter(e => e.actorId === riderId && e.actorType === 'rider')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

// ========================================
// EXPORTS
// ========================================

export default {
  getRiderLoyaltyState,
  createRiderLoyaltyState,
  updateRiderLoyaltyState,
  calculateRidePoints,
  checkWeeklyGoals,
  checkMonthlyGoals,
  calculateOffPeakDiscount,
  applyCredits,
  checkTierProgression,
  checkBirthdayReward,
  claimBirthdayReward,
  processReferralBonus,
  processRideCompletion,
  runDailyRiderProcessing,
  getRiderLoyaltyMetrics,
  getRiderRewardHistory,
  RIDER_TIER_CONFIGS,
  DEFAULT_RIDER_POINTS_CONFIG,
  DEFAULT_RIDER_WEEKLY_GOALS,
  DEFAULT_RIDER_MONTHLY_GOALS,
};
