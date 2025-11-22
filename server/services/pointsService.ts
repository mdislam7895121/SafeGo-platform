import { prisma } from "../db";
import { TimeSlotPointEngine } from "./timeSlotPointEngine";
import { CycleTrackingService } from "./cycleTrackingService";

/**
 * SafeGo Points Service - 3-Tier System with 90-Day Cycles
 * Handles tier calculation with order_index enforcement
 * Only 3 tiers: Blue (1000+), Gold (1500+), Premium (2500+)
 */

export class PointsService {
  /**
   * Calculate driver's current tier based on total points (90-day status points)
   * Returns null if points < 1000 (no tier yet)
   * Always sorts by displayOrder ascending to ensure correct order: Blue → Gold → Premium
   */
  async calculateCurrentTier(totalPoints: number, countryCode?: string) {
    // If less than 1000 points, no tier yet
    if (totalPoints < 1000) {
      return null;
    }

    // Get all active tiers for the country (fallback to global)
    const tiers = await prisma.driverTier.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        displayOrder: "asc", // CRITICAL: This ensures correct order: Blue (1) → Gold (2) → Premium (3)
      },
    });

    // Find the highest tier where totalPoints >= requiredPoints
    // Strict enforcement: must have EXACTLY the required points (1499 ≠ Gold)
    let currentTier = null;
    for (const tier of tiers) {
      if (totalPoints >= tier.requiredPoints) {
        currentTier = tier;
      } else {
        break; // Stop when we find a tier we don't qualify for
      }
    }

    return currentTier;
  }

  /**
   * Get next tier for progression
   * Returns null if already at Premium tier (max tier)
   */
  async getNextTier(currentTierDisplayOrder: number | null) {
    if (currentTierDisplayOrder === null) {
      // If no tier, next tier is Blue (displayOrder 1)
      return await prisma.driverTier.findFirst({
        where: {
          displayOrder: 1,
          isActive: true,
        },
      });
    }

    // Get next tier by displayOrder
    return await prisma.driverTier.findFirst({
      where: {
        displayOrder: currentTierDisplayOrder + 1,
        isActive: true,
      },
      orderBy: {
        displayOrder: "asc",
      },
    });
  }

  /**
   * Get all tiers ordered by displayOrder (Blue → Gold → Premium only)
   */
  async getAllTiers() {
    return await prisma.driverTier.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        displayOrder: "asc", // Ensures correct order: Blue, Gold, Premium
      },
      include: {
        benefits: {
          where: {
            isActive: true,
          },
          orderBy: {
            displayOrder: "asc",
          },
        },
      },
    });
  }

  /**
   * Get or create driver points record
   * Initializes 90-day cycle if needed
   */
  async getOrCreateDriverPoints(driverId: string) {
    let driverPoints = await prisma.driverPoints.findUnique({
      where: { driverId },
      include: {
        tier: true,
      },
    });

    if (!driverPoints) {
      // Initialize 90-day cycle for new driver
      const { cycleStartDate, cycleEndDate } = await CycleTrackingService.initializeCycle(driverId);

      // Create new points record with no tier and cycle dates
      driverPoints = await prisma.driverPoints.create({
        data: {
          driverId,
          // No tier until 1000 points - don't set currentTierId
          totalPoints: 0, // 90-day status points
          lifetimePoints: 0,
          cycleStartDate,
          cycleEndDate,
        },
        include: {
          tier: true,
        },
      });
    } else {
      // Check if existing driver needs cycle initialization
      const needsInit = await CycleTrackingService.needsCycleInitialization(driverId);
      if (needsInit) {
        const { cycleStartDate, cycleEndDate } = await CycleTrackingService.initializeCycle(driverId);
        // Reload to get updated data
        driverPoints = await prisma.driverPoints.findUnique({
          where: { driverId },
          include: { tier: true },
        }) || driverPoints;
      }
    }

    return driverPoints;
  }

  /**
   * Award points to driver and update tier if needed
   * Uses time-slot based calculation for trip completions
   */
  async awardPoints(
    driverId: string,
    points: number,
    reason: string,
    referenceType?: string,
    referenceId?: string,
    metadata?: any
  ) {
    const driverPoints = await this.getOrCreateDriverPoints(driverId);

    // Calculate new total (90-day status points + lifetime points)
    const newTotal = driverPoints.totalPoints + points;
    const newLifetime = driverPoints.lifetimePoints + points;

    // Calculate new tier based on new 90-day status points
    const newTier = await this.calculateCurrentTier(newTotal);

    // Create transaction record
    const transaction = await prisma.pointsTransaction.create({
      data: {
        driverPointsId: driverPoints.id,
        points,
        reason,
        referenceType,
        referenceId,
        metadata,
      },
    });

    // Update driver points with proper null handling
    const updateData: any = {
      totalPoints: newTotal, // 90-day status points
      lifetimePoints: newLifetime, // All-time points
      lastEarnedAt: new Date(),
    };

    // Only set currentTierId if newTier exists
    if (newTier) {
      updateData.currentTierId = newTier.id;
    } else {
      // Explicitly unset tier if points < 1000
      updateData.currentTierId = undefined;
    }

    const updated = await prisma.driverPoints.update({
      where: { id: driverPoints.id },
      data: updateData,
      include: {
        tier: true,
      },
    });

    return {
      updated,
      transaction,
      tierChanged: driverPoints.currentTierId !== (newTier?.id || null),
      previousTier: driverPoints.tier,
      newTier,
    };
  }

  /**
   * Award points for trip completion using time-slot based calculation
   * Points vary by time of day:
   * - 12:00 AM – 8:00 AM → 1 point
   * - 8:00 AM – 3:00 PM → 1 point
   * - 3:00 PM – 5:00 PM → 3 points
   * - 5:00 PM – 12:00 AM → 5 points
   */
  async awardPointsForTripCompletion(
    driverId: string,
    tripId: string,
    tripCompletionTime?: Date,
    driverTimezone?: string,
    countryCode?: string
  ) {
    // Calculate points using time-slot engine (server-validated, tamper-proof)
    const calculation = TimeSlotPointEngine.calculatePoints(
      tripCompletionTime,
      driverTimezone,
      countryCode
    );

    // Log suspicious timing patterns
    if (calculation.isSuspicious) {
      console.warn(
        `[PointsService] Suspicious trip completion detected for driver ${driverId}:`,
        calculation.suspicionReasons
      );
      // Future: Trigger fraud detection alert
    }

    // Award calculated points
    const result = await this.awardPoints(
      driverId,
      calculation.points,
      `Trip completion (${calculation.timeSlot})`,
      "trip",
      tripId,
      {
        timeSlot: calculation.timeSlot,
        calculatedAt: calculation.calculatedAt,
        tripCompletionTime: calculation.tripCompletionTime,
        timezone: calculation.timezone,
        isSuspicious: calculation.isSuspicious,
        suspicionReasons: calculation.suspicionReasons,
      }
    );

    return {
      ...result,
      pointsAwarded: calculation.points,
      timeSlot: calculation.timeSlot,
      isSuspicious: calculation.isSuspicious,
    };
  }

  /**
   * Get driver points data for UI
   * Includes 90-day cycle information
   */
  async getDriverPointsData(driverId: string) {
    const driverPoints = await this.getOrCreateDriverPoints(driverId);
    const allTiers = await this.getAllTiers();

    // Get cycle status
    const cycleStatus = await CycleTrackingService.getCycleStatus(driverId);

    // Get current tier (might be null if < 1000 points)
    const currentTier = driverPoints.tier;
    const currentDisplayOrder = currentTier?.displayOrder || 0;

    // Get next tier
    const nextTier = await this.getNextTier(currentDisplayOrder);

    // Calculate progress
    let progressPercentage = 0;
    let pointsToNextTier = 0;

    if (!currentTier) {
      // No tier yet, show progress to Blue (1000 points)
      const blueTier = allTiers.find(t => t.displayOrder === 1);
      if (blueTier) {
        pointsToNextTier = blueTier.requiredPoints - driverPoints.totalPoints;
        progressPercentage = (driverPoints.totalPoints / blueTier.requiredPoints) * 100;
      }
    } else if (nextTier) {
      // Has tier, show progress to next tier
      const pointsInCurrentTier = driverPoints.totalPoints - currentTier.requiredPoints;
      const pointsNeededForNextTier = nextTier.requiredPoints - currentTier.requiredPoints;
      progressPercentage = (pointsInCurrentTier / pointsNeededForNextTier) * 100;
      pointsToNextTier = nextTier.requiredPoints - driverPoints.totalPoints;
    } else {
      // At max tier (Premium)
      progressPercentage = 100;
      pointsToNextTier = 0;
    }

    // Get recent transactions
    const transactions = await prisma.pointsTransaction.findMany({
      where: {
        driverPointsId: driverPoints.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    // Map all tiers to include unlock status
    const tiersWithStatus = allTiers.map(tier => ({
      ...tier,
      isUnlocked: driverPoints.totalPoints >= tier.requiredPoints,
      isCurrentTier: tier.id === currentTier?.id,
    }));

    return {
      currentTier,
      totalPoints: driverPoints.totalPoints, // 90-day status points
      lifetimePoints: driverPoints.lifetimePoints, // All-time points
      nextTier,
      progressPercentage: Math.min(progressPercentage, 100),
      pointsToNextTier: Math.max(pointsToNextTier, 0),
      allTiers: tiersWithStatus,
      transactions,
      hasNoTier: !currentTier && driverPoints.totalPoints < 1000,
      // 90-day cycle information
      cycleStatus: cycleStatus ? {
        daysRemaining: cycleStatus.daysRemaining,
        daysElapsed: cycleStatus.daysElapsed,
        totalDays: cycleStatus.totalDays,
        cycleProgress: cycleStatus.cycleProgress,
        cycleEndDate: cycleStatus.cycleEndDate,
      } : null,
    };
  }

  /**
   * Get points ledger (activity history) for driver
   */
  async getPointsLedger(driverId: string, limit = 50, offset = 0) {
    const driverPoints = await prisma.driverPoints.findUnique({
      where: { driverId },
    });

    if (!driverPoints) {
      return { transactions: [], total: 0 };
    }

    const [transactions, total] = await Promise.all([
      prisma.pointsTransaction.findMany({
        where: {
          driverPointsId: driverPoints.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
        skip: offset,
      }),
      prisma.pointsTransaction.count({
        where: {
          driverPointsId: driverPoints.id,
        },
      }),
    ]);

    return { transactions, total };
  }
}

export const pointsService = new PointsService();
