import { prisma } from "../db";

/**
 * SafeGo Points Service
 * Handles tier calculation with order_index enforcement
 * Ensures Premium always appears before Diamond
 */

export class PointsService {
  /**
   * Calculate driver's current tier based on total points
   * Returns null if points < 500 (no tier yet)
   * Always sorts by displayOrder ascending to ensure Premium before Diamond
   */
  async calculateCurrentTier(totalPoints: number, countryCode?: string) {
    // If less than 500 points, no tier yet
    if (totalPoints < 500) {
      return null;
    }

    // Get all active tiers for the country (fallback to global)
    const tiers = await prisma.driverTier.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        displayOrder: "asc", // CRITICAL: This ensures Premium (3) comes before Diamond (4)
      },
    });

    // Find the highest tier where totalPoints >= requiredPoints
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
   * Returns null if already at Diamond tier
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
   * Get all tiers ordered by displayOrder (Blue → Gold → Premium → Diamond)
   */
  async getAllTiers() {
    return await prisma.driverTier.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        displayOrder: "asc", // Ensures correct order: Blue, Gold, Premium, Diamond
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
   */
  async getOrCreateDriverPoints(driverId: string) {
    let driverPoints = await prisma.driverPoints.findUnique({
      where: { driverId },
      include: {
        tier: true,
      },
    });

    if (!driverPoints) {
      // Create new points record with no tier (undefined for Prisma)
      driverPoints = await prisma.driverPoints.create({
        data: {
          driverId,
          // No tier until 500 points - don't set currentTierId
          totalPoints: 0,
          lifetimePoints: 0,
        },
        include: {
          tier: true,
        },
      });
    }

    return driverPoints;
  }

  /**
   * Award points to driver and update tier if needed
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

    // Calculate new total
    const newTotal = driverPoints.totalPoints + points;
    const newLifetime = driverPoints.lifetimePoints + points;

    // Calculate new tier
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
      totalPoints: newTotal,
      lifetimePoints: newLifetime,
      lastEarnedAt: new Date(),
    };

    // Only set currentTierId if newTier exists
    if (newTier) {
      updateData.currentTierId = newTier.id;
    } else {
      // Explicitly unset tier if points < 500
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
   * Get driver points data for UI
   */
  async getDriverPointsData(driverId: string) {
    const driverPoints = await this.getOrCreateDriverPoints(driverId);
    const allTiers = await this.getAllTiers();

    // Get current tier (might be null if < 500 points)
    const currentTier = driverPoints.tier;
    const currentDisplayOrder = currentTier?.displayOrder || 0;

    // Get next tier
    const nextTier = await this.getNextTier(currentDisplayOrder);

    // Calculate progress
    let progressPercentage = 0;
    let pointsToNextTier = 0;

    if (!currentTier) {
      // No tier yet, show progress to Blue (500 points)
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
      // At max tier (Diamond)
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
      totalPoints: driverPoints.totalPoints,
      lifetimePoints: driverPoints.lifetimePoints,
      nextTier,
      progressPercentage: Math.min(progressPercentage, 100),
      pointsToNextTier: Math.max(pointsToNextTier, 0),
      allTiers: tiersWithStatus,
      transactions,
      hasNoTier: !currentTier && driverPoints.totalPoints < 500,
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
