/**
 * CycleTrackingService - Manages 90-day rolling point cycles
 *
 * Responsibilities:
 * - Initialize 90-day cycles for new drivers
 * - Track cycle progress (days remaining, points needed)
 * - Automatically reset points at cycle end
 * - Preserve lifetime points for analytics
 * - Handle cycle transitions and tier recalculation
 */

import { prisma } from "../db"; // Use shared Prisma client singleton

interface CycleStatus {
  isActive: boolean;
  cycleStartDate: Date;
  cycleEndDate: Date;
  daysRemaining: number;
  daysElapsed: number;
  totalDays: number;
  cycleProgress: number; // Percentage 0-100
}

interface CycleResetResult {
  driverId: string;
  previousStatusPoints: number;
  lifetimePointsPreserved: number;
  newCycleStart: Date;
  newCycleEnd: Date;
  tierBefore: string | null;
  tierAfter: string | null;
}

export class CycleTrackingService {
  private static readonly CYCLE_DAYS = 90;

  /**
   * Initialize a new 90-day cycle for a driver
   */
  public static async initializeCycle(
    driverId: string
  ): Promise<{ cycleStartDate: Date; cycleEndDate: Date }> {
    const now = new Date();
    const cycleEnd = new Date(now);
    cycleEnd.setDate(cycleEnd.getDate() + this.CYCLE_DAYS);

    await prisma.driverPoints.upsert({
      where: { driverId },
      create: {
        driverId,
        totalPoints: 0,
        lifetimePoints: 0,
        cycleStartDate: now,
        cycleEndDate: cycleEnd,
      },
      update: {
        cycleStartDate: now,
        cycleEndDate: cycleEnd,
      },
    });

    return {
      cycleStartDate: now,
      cycleEndDate: cycleEnd,
    };
  }

  /**
   * Get current cycle status for a driver
   */
  public static async getCycleStatus(
    driverId: string
  ): Promise<CycleStatus | null> {
    const driverPoints = await prisma.driverPoints.findUnique({
      where: { driverId },
    });

    if (!driverPoints || !driverPoints.cycleStartDate || !driverPoints.cycleEndDate) {
      return null;
    }

    const now = new Date();
    const startDate = driverPoints.cycleStartDate;
    const endDate = driverPoints.cycleEndDate;

    const totalMs = endDate.getTime() - startDate.getTime();
    const elapsedMs = now.getTime() - startDate.getTime();
    const remainingMs = endDate.getTime() - now.getTime();

    const totalDays = Math.ceil(totalMs / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));

    const cycleProgress = Math.min(100, Math.max(0, (daysElapsed / totalDays) * 100));

    return {
      isActive: now < endDate,
      cycleStartDate: startDate,
      cycleEndDate: endDate,
      daysRemaining,
      daysElapsed,
      totalDays,
      cycleProgress: Math.round(cycleProgress),
    };
  }

  /**
   * Reset cycle for a driver (called when 90 days expire)
   * Preserves lifetime points, resets status points to 0
   */
  public static async resetCycle(driverId: string): Promise<CycleResetResult> {
    const driverPoints = await prisma.driverPoints.findUnique({
      where: { driverId },
      include: { tier: true },
    });

    if (!driverPoints) {
      throw new Error(`Driver points not found for driver ${driverId}`);
    }

    const previousStatusPoints = driverPoints.totalPoints;
    const lifetimePoints = driverPoints.lifetimePoints;
    const tierBefore = driverPoints.tier?.name || null;

    // Calculate new cycle dates
    const now = new Date();
    const newCycleEnd = new Date(now);
    newCycleEnd.setDate(newCycleEnd.getDate() + this.CYCLE_DAYS);

    // Reset status points to 0, preserve lifetime points
    // Remove tier (driver needs to re-earn it)
    await prisma.driverPoints.update({
      where: { driverId },
      data: {
        totalPoints: 0, // Reset 90-day status points
        currentTierId: null, // Remove tier - must re-earn
        cycleStartDate: now,
        cycleEndDate: newCycleEnd,
        // lifetimePoints stays the same
      },
    });

    return {
      driverId,
      previousStatusPoints,
      lifetimePointsPreserved: lifetimePoints,
      newCycleStart: now,
      newCycleEnd: newCycleEnd,
      tierBefore,
      tierAfter: null, // Always null after reset
    };
  }

  /**
   * Check and reset expired cycles (called by scheduled job)
   */
  public static async resetExpiredCycles(): Promise<CycleResetResult[]> {
    const now = new Date();

    // Find all drivers with expired cycles
    const expiredDrivers = await prisma.driverPoints.findMany({
      where: {
        cycleEndDate: {
          lte: now, // Cycle end date is in the past
        },
      },
      include: { tier: true },
    });

    console.log(`[CycleTracking] Found ${expiredDrivers.length} expired cycles to reset`);

    const results: CycleResetResult[] = [];

    for (const driver of expiredDrivers) {
      try {
        const result = await this.resetCycle(driver.driverId);
        results.push(result);
        console.log(
          `[CycleTracking] Reset cycle for driver ${driver.driverId}: ${result.previousStatusPoints} pts → 0 pts (${result.lifetimePointsPreserved} lifetime pts preserved)`
        );
      } catch (error) {
        console.error(
          `[CycleTracking] Failed to reset cycle for driver ${driver.driverId}:`,
          error
        );
      }
    }

    return results;
  }

  /**
   * Get days remaining until cycle reset
   */
  public static async getDaysUntilReset(driverId: string): Promise<number | null> {
    const status = await this.getCycleStatus(driverId);
    return status?.daysRemaining || null;
  }

  /**
   * Check if driver's cycle needs initialization
   */
  public static async needsCycleInitialization(driverId: string): Promise<boolean> {
    const driverPoints = await prisma.driverPoints.findUnique({
      where: { driverId },
      select: { cycleStartDate: true, cycleEndDate: true },
    });

    if (!driverPoints) {
      return true; // No points record at all
    }

    return !driverPoints.cycleStartDate || !driverPoints.cycleEndDate;
  }

  /**
   * Backfill cycle dates for existing drivers (migration helper)
   */
  public static async backfillCycleDates(): Promise<number> {
    const driversNeedingInit = await prisma.driverPoints.findMany({
      where: {
        OR: [
          { cycleStartDate: null },
          { cycleEndDate: null },
        ],
      },
    });

    console.log(
      `[CycleTracking] Backfilling cycles for ${driversNeedingInit.length} drivers`
    );

    for (const driver of driversNeedingInit) {
      await this.initializeCycle(driver.driverId);
    }

    return driversNeedingInit.length;
  }
}
