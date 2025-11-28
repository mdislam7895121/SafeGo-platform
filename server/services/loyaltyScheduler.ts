/**
 * SafeGo Loyalty Scheduler
 * 
 * Manages scheduled loyalty processing tasks:
 * - Daily batch processing at 2 AM for tier updates, goal resets, streak tracking
 * - Real-time per-ride loyalty updates
 * 
 * Integrates with:
 * - Rider Loyalty Engine
 * - Driver Loyalty Engine
 */

import { runDailyRiderProcessing, DailyRiderProcessingResult } from './riderLoyaltyEngine';
import { runDailyDriverProcessing, DailyDriverProcessingResult } from './driverLoyaltyEngine';

// ========================================
// SCHEDULER STATE
// ========================================

interface SchedulerState {
  isRunning: boolean;
  lastDailyRun: Date | null;
  nextScheduledRun: Date | null;
  schedulerInterval: ReturnType<typeof setInterval> | null;
  runCount: number;
  lastResults: {
    rider: DailyRiderProcessingResult | null;
    driver: DailyDriverProcessingResult | null;
  };
}

const schedulerState: SchedulerState = {
  isRunning: false,
  lastDailyRun: null,
  nextScheduledRun: null,
  schedulerInterval: null,
  runCount: 0,
  lastResults: {
    rider: null,
    driver: null,
  },
};

// ========================================
// DAILY PROCESSING
// ========================================

export interface CombinedDailyProcessingResult {
  processedAt: Date;
  riderResults: DailyRiderProcessingResult;
  driverResults: DailyDriverProcessingResult;
  totalProcessed: number;
  tierChanges: {
    riderUpgrades: number;
    riderDowngrades: number;
    driverUpgrades: number;
    driverDowngrades: number;
  };
  goalsReset: {
    weeklyRider: number;
    monthlyRider: number;
  };
  guaranteesTriggered: number;
  totalGuaranteePayout: number;
  birthdayRewardsIssued: number;
  streaksBroken: number;
}

export function runDailyLoyaltyProcessing(): CombinedDailyProcessingResult {
  console.log('[LoyaltyScheduler] Starting daily loyalty processing...');
  const startTime = Date.now();
  
  const riderResults = runDailyRiderProcessing();
  const driverResults = runDailyDriverProcessing();
  
  const result: CombinedDailyProcessingResult = {
    processedAt: new Date(),
    riderResults,
    driverResults,
    totalProcessed: riderResults.ridersProcessed + driverResults.driversProcessed,
    tierChanges: {
      riderUpgrades: riderResults.tierUpgrades.length,
      riderDowngrades: riderResults.tierDowngrades.length,
      driverUpgrades: driverResults.tierUpgrades.length,
      driverDowngrades: driverResults.tierDowngrades.length,
    },
    goalsReset: {
      weeklyRider: riderResults.weeklyGoalsReset,
      monthlyRider: riderResults.monthlyGoalsReset,
    },
    guaranteesTriggered: driverResults.weeklyGuaranteesTriggered.length,
    totalGuaranteePayout: driverResults.weeklyGuaranteesTriggered.reduce((sum, g) => sum + g.amount, 0),
    birthdayRewardsIssued: riderResults.birthdayRewardsIssued.length,
    streaksBroken: driverResults.streaksBroken,
  };
  
  schedulerState.lastDailyRun = new Date();
  schedulerState.runCount++;
  schedulerState.lastResults = {
    rider: riderResults,
    driver: driverResults,
  };
  
  const duration = Date.now() - startTime;
  console.log(`[LoyaltyScheduler] Daily processing complete in ${duration}ms`);
  console.log(`[LoyaltyScheduler] Processed: ${result.totalProcessed} users`);
  console.log(`[LoyaltyScheduler] Tier changes: ${result.tierChanges.riderUpgrades + result.tierChanges.driverUpgrades} upgrades, ${result.tierChanges.riderDowngrades + result.tierChanges.driverDowngrades} downgrades`);
  console.log(`[LoyaltyScheduler] Weekly guarantees: ${result.guaranteesTriggered} triggered, $${result.totalGuaranteePayout.toFixed(2)} paid`);
  
  return result;
}

// ========================================
// SCHEDULER MANAGEMENT
// ========================================

function getNext2AMTime(): Date {
  const now = new Date();
  const next2AM = new Date(now);
  next2AM.setHours(2, 0, 0, 0);
  
  if (now >= next2AM) {
    next2AM.setDate(next2AM.getDate() + 1);
  }
  
  return next2AM;
}

function getMillisecondsUntil(targetDate: Date): number {
  return Math.max(0, targetDate.getTime() - Date.now());
}

export function startLoyaltyScheduler(): void {
  if (schedulerState.isRunning) {
    console.log('[LoyaltyScheduler] Scheduler already running');
    return;
  }
  
  schedulerState.isRunning = true;
  schedulerState.nextScheduledRun = getNext2AMTime();
  
  console.log(`[LoyaltyScheduler] Starting scheduler, next run at ${schedulerState.nextScheduledRun.toISOString()}`);
  
  const scheduleNextRun = () => {
    const next2AM = getNext2AMTime();
    schedulerState.nextScheduledRun = next2AM;
    const msUntil2AM = getMillisecondsUntil(next2AM);
    
    console.log(`[LoyaltyScheduler] Scheduling next run in ${Math.round(msUntil2AM / 1000 / 60)} minutes`);
    
    setTimeout(() => {
      if (schedulerState.isRunning) {
        try {
          runDailyLoyaltyProcessing();
        } catch (error) {
          console.error('[LoyaltyScheduler] Error during daily processing:', error);
        }
        scheduleNextRun();
      }
    }, msUntil2AM);
  };
  
  scheduleNextRun();
}

export function stopLoyaltyScheduler(): void {
  if (!schedulerState.isRunning) {
    console.log('[LoyaltyScheduler] Scheduler not running');
    return;
  }
  
  schedulerState.isRunning = false;
  schedulerState.nextScheduledRun = null;
  
  if (schedulerState.schedulerInterval) {
    clearInterval(schedulerState.schedulerInterval);
    schedulerState.schedulerInterval = null;
  }
  
  console.log('[LoyaltyScheduler] Scheduler stopped');
}

export function getSchedulerStatus(): {
  isRunning: boolean;
  lastDailyRun: Date | null;
  nextScheduledRun: Date | null;
  runCount: number;
  lastResults: typeof schedulerState.lastResults;
} {
  return {
    isRunning: schedulerState.isRunning,
    lastDailyRun: schedulerState.lastDailyRun,
    nextScheduledRun: schedulerState.nextScheduledRun,
    runCount: schedulerState.runCount,
    lastResults: schedulerState.lastResults,
  };
}

export function triggerManualDailyProcessing(): CombinedDailyProcessingResult {
  console.log('[LoyaltyScheduler] Manual daily processing triggered');
  return runDailyLoyaltyProcessing();
}

// ========================================
// EXPORTS
// ========================================

export default {
  runDailyLoyaltyProcessing,
  startLoyaltyScheduler,
  stopLoyaltyScheduler,
  getSchedulerStatus,
  triggerManualDailyProcessing,
};
