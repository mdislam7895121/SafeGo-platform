import { Router, Request, Response } from "express";
import { prisma } from "../db";

const router = Router();

const RATING_THRESHOLDS = {
  driver: {
    warning: 4.0,
    temporaryBlock: 3.5,
    permanentBlock: 2.5,
  },
  customer: {
    warning: 3.5,
    cooldown: 3.0,
    block: 2.5,
  },
  partner: {
    warning: 3.5,
    visibilityReduction: 3.0,
    block: 2.5,
  },
};

const FRAUD_SCORE_PENALTIES = {
  lowRating: 10,
  veryLowRating: 20,
  multipleLowRatings24h: 15,
};

async function updateFraudScoreForRating(
  userId: string,
  userRole: string,
  ratingValue: number,
  penalty: number
): Promise<void> {
  try {
    const existingScore = await prisma.fraudScore.findUnique({
      where: { id: `${userRole}_${userId}` },
    });

    if (existingScore) {
      const newScore = Math.min(100, existingScore.currentScore + penalty);
      const scoreHistory = (existingScore.scoreHistory as any[]) || [];
      scoreHistory.push({
        date: new Date().toISOString(),
        score: newScore,
        reason: `Low rating received (${ratingValue} stars)`,
      });

      await prisma.fraudScore.update({
        where: { id: `${userRole}_${userId}` },
        data: {
          currentScore: newScore,
          scoreHistory: scoreHistory,
          lastCalculatedAt: new Date(),
        },
      });
    }
  } catch (error) {
    console.warn("[Rating] Could not update fraud score:", error);
  }
}

async function checkMultipleLowRatings(
  userId: string,
  userRole: string
): Promise<number> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const lowRatings = await prisma.ratingSubmission.count({
    where: {
      targetId: userId,
      targetRole: userRole as any,
      rating: { lte: 2 },
      createdAt: { gte: twentyFourHoursAgo },
    },
  });

  return lowRatings;
}

async function createReputationFlag(
  userId: string,
  userRole: string,
  flagType: any,
  flagReason: string,
  severity: string,
  triggerRating: number,
  restrictionApplied?: string,
  restrictionEndsAt?: Date
): Promise<void> {
  try {
    await prisma.reputationFlag.create({
      data: {
        userId,
        userRole,
        flagType,
        flagReason,
        severity,
        triggerRating,
        status: "active",
        restrictionApplied,
        restrictionEndsAt,
      },
    });
  } catch (error) {
    console.warn("[Rating] Could not create reputation flag:", error);
  }
}

async function logReputationEvent(
  userId: string,
  userRole: string,
  eventType: string,
  eventDetails: any,
  ratingSubmissionId?: string,
  ratingValue?: number,
  previousAverage?: number,
  newAverage?: number,
  fraudScoreImpact?: number,
  actionType?: string,
  actionDetails?: string,
  triggeredBy?: string
): Promise<void> {
  try {
    await prisma.reputationLog.create({
      data: {
        userId,
        userRole,
        eventType,
        eventDetails,
        ratingSubmissionId,
        ratingValue,
        previousAverage,
        newAverage,
        fraudScoreImpact,
        actionType,
        actionDetails,
        triggeredBy,
      },
    });
  } catch (error) {
    console.warn("[Rating] Could not log reputation event:", error);
  }
}

router.post("/customer", async (req: Request, res: Response) => {
  try {
    const { customerId, driverId, orderId, serviceType, rating, comment, subRatings } = req.body;

    if (!customerId || !driverId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Invalid rating data" });
    }

    const ratingSubmission = await prisma.ratingSubmission.create({
      data: {
        raterId: driverId,
        raterRole: "driver",
        targetId: customerId,
        targetRole: "customer",
        serviceType: serviceType || "ride",
        orderId,
        rating,
        comment,
        subRatings,
        isLocked: true,
        processedAt: new Date(),
      },
    });

    let customerRating = await prisma.customerRating.findUnique({
      where: { customerId },
    });

    const previousAverage = customerRating?.averageRating || 5.0;

    if (!customerRating) {
      customerRating = await prisma.customerRating.create({
        data: {
          customerId,
          averageRating: rating,
          totalRatings: 1,
          oneStarCount: rating === 1 ? 1 : 0,
          twoStarCount: rating === 2 ? 1 : 0,
          threeStarCount: rating === 3 ? 1 : 0,
          fourStarCount: rating === 4 ? 1 : 0,
          fiveStarCount: rating === 5 ? 1 : 0,
        },
      });
    } else {
      const starCountField = `${["one", "two", "three", "four", "five"][rating - 1]}StarCount` as const;
      const newTotal = customerRating.totalRatings + 1;
      const newAverage =
        (customerRating.averageRating * customerRating.totalRatings + rating) / newTotal;

      const updateData: any = {
        totalRatings: newTotal,
        averageRating: Math.round(newAverage * 100) / 100,
        [starCountField]: { increment: 1 },
      };

      if (newAverage < RATING_THRESHOLDS.customer.cooldown && !customerRating.isRestricted) {
        updateData.isRestricted = true;
        updateData.restrictedAt = new Date();
        updateData.restrictionReason = `Average rating dropped below ${RATING_THRESHOLDS.customer.cooldown}`;
        updateData.restrictionLevel = "cooldown";

        await createReputationFlag(
          customerId,
          "customer",
          "low_rating_block",
          `Customer rating dropped to ${newAverage.toFixed(2)}`,
          "high",
          newAverage,
          "cooldown",
          new Date(Date.now() + 24 * 60 * 60 * 1000)
        );

        await updateFraudScoreForRating(customerId, "customer", rating, FRAUD_SCORE_PENALTIES.veryLowRating);
      } else if (newAverage < RATING_THRESHOLDS.customer.warning && newAverage >= RATING_THRESHOLDS.customer.cooldown) {
        await createReputationFlag(
          customerId,
          "customer",
          "low_rating_warning",
          `Customer rating dropped to ${newAverage.toFixed(2)}`,
          "medium",
          newAverage
        );
      }

      customerRating = await prisma.customerRating.update({
        where: { customerId },
        data: updateData,
      });
    }

    const lowRatingCount = await checkMultipleLowRatings(customerId, "customer");
    if (lowRatingCount >= 3) {
      await createReputationFlag(
        customerId,
        "customer",
        "multiple_low_ratings",
        `Received ${lowRatingCount} low ratings in 24 hours`,
        "high",
        rating
      );
      await updateFraudScoreForRating(customerId, "customer", rating, FRAUD_SCORE_PENALTIES.multipleLowRatings24h);
    }

    await logReputationEvent(
      customerId,
      "customer",
      "rating_received",
      { orderId, serviceType, rater: driverId },
      ratingSubmission.id,
      rating,
      previousAverage,
      customerRating.averageRating,
      rating <= 2 ? FRAUD_SCORE_PENALTIES.lowRating : 0,
      customerRating.isRestricted ? "cooldown" : "none",
      undefined,
      "system"
    );

    console.log(`[Rating] Customer ${customerId} rated ${rating} stars by driver ${driverId}`);

    res.json({
      success: true,
      ratingId: ratingSubmission.id,
      newAverageRating: customerRating.averageRating,
      totalRatings: customerRating.totalRatings,
    });
  } catch (error) {
    console.error("[Rating] Customer rating error:", error);
    res.status(500).json({ error: "Failed to submit customer rating" });
  }
});

router.post("/driver", async (req: Request, res: Response) => {
  try {
    const { driverId, customerId, orderId, serviceType, rating, comment, subRatings } = req.body;

    if (!driverId || !customerId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Invalid rating data" });
    }

    const ratingSubmission = await prisma.ratingSubmission.create({
      data: {
        raterId: customerId,
        raterRole: "customer",
        targetId: driverId,
        targetRole: "driver",
        serviceType: serviceType || "ride",
        orderId,
        rating,
        comment,
        subRatings,
        isLocked: true,
        processedAt: new Date(),
      },
    });

    let driverRating = await prisma.driverRating.findUnique({
      where: { driverId },
    });

    const previousAverage = driverRating?.averageRating || 5.0;

    if (!driverRating) {
      driverRating = await prisma.driverRating.create({
        data: {
          driverId,
          averageRating: rating,
          totalRatings: 1,
          oneStarCount: rating === 1 ? 1 : 0,
          twoStarCount: rating === 2 ? 1 : 0,
          threeStarCount: rating === 3 ? 1 : 0,
          fourStarCount: rating === 4 ? 1 : 0,
          fiveStarCount: rating === 5 ? 1 : 0,
          priorityScore: rating >= 4 ? 100 : rating >= 3 ? 75 : 50,
        },
      });
    } else {
      const starCountField = `${["one", "two", "three", "four", "five"][rating - 1]}StarCount` as const;
      const newTotal = driverRating.totalRatings + 1;
      const newAverage =
        (driverRating.averageRating * driverRating.totalRatings + rating) / newTotal;

      let newPriorityScore = driverRating.priorityScore;
      if (newAverage >= 4.5) newPriorityScore = 100;
      else if (newAverage >= 4.0) newPriorityScore = 85;
      else if (newAverage >= 3.5) newPriorityScore = 70;
      else if (newAverage >= 3.0) newPriorityScore = 50;
      else newPriorityScore = 25;

      const updateData: any = {
        totalRatings: newTotal,
        averageRating: Math.round(newAverage * 100) / 100,
        [starCountField]: { increment: 1 },
        priorityScore: newPriorityScore,
      };

      if (subRatings) {
        if (subRatings.safety !== undefined) updateData.safetyScore = subRatings.safety;
        if (subRatings.navigation !== undefined) updateData.navigationScore = subRatings.navigation;
        if (subRatings.behavior !== undefined) updateData.behaviorScore = subRatings.behavior;
        if (subRatings.vehicleCondition !== undefined) updateData.vehicleCondition = subRatings.vehicleCondition;
      }

      if (newAverage < RATING_THRESHOLDS.driver.temporaryBlock && !driverRating.isRestricted) {
        updateData.isRestricted = true;
        updateData.restrictedAt = new Date();
        updateData.restrictionReason = `Average rating dropped below ${RATING_THRESHOLDS.driver.temporaryBlock}`;
        updateData.restrictionLevel = "temporary_block";

        await createReputationFlag(
          driverId,
          "driver",
          "low_rating_block",
          `Driver rating dropped to ${newAverage.toFixed(2)}`,
          "critical",
          newAverage,
          "temporary_block",
          new Date(Date.now() + 72 * 60 * 60 * 1000)
        );

        await updateFraudScoreForRating(driverId, "driver", rating, FRAUD_SCORE_PENALTIES.veryLowRating);
      } else if (newAverage < RATING_THRESHOLDS.driver.warning && newAverage >= RATING_THRESHOLDS.driver.temporaryBlock) {
        await createReputationFlag(
          driverId,
          "driver",
          "low_rating_warning",
          `Driver rating dropped to ${newAverage.toFixed(2)}`,
          "medium",
          newAverage
        );
      }

      driverRating = await prisma.driverRating.update({
        where: { driverId },
        data: updateData,
      });
    }

    const lowRatingCount = await checkMultipleLowRatings(driverId, "driver");
    if (lowRatingCount >= 3) {
      await createReputationFlag(
        driverId,
        "driver",
        "multiple_low_ratings",
        `Received ${lowRatingCount} low ratings in 24 hours`,
        "critical",
        rating
      );
      await updateFraudScoreForRating(driverId, "driver", rating, FRAUD_SCORE_PENALTIES.multipleLowRatings24h);
    }

    await logReputationEvent(
      driverId,
      "driver",
      "rating_received",
      { orderId, serviceType, rater: customerId },
      ratingSubmission.id,
      rating,
      previousAverage,
      driverRating.averageRating,
      rating <= 2 ? FRAUD_SCORE_PENALTIES.lowRating : 0,
      driverRating.isRestricted ? "temporary_block" : "none",
      undefined,
      "system"
    );

    console.log(`[Rating] Driver ${driverId} rated ${rating} stars by customer ${customerId}`);

    res.json({
      success: true,
      ratingId: ratingSubmission.id,
      newAverageRating: driverRating.averageRating,
      totalRatings: driverRating.totalRatings,
      priorityScore: driverRating.priorityScore,
    });
  } catch (error) {
    console.error("[Rating] Driver rating error:", error);
    res.status(500).json({ error: "Failed to submit driver rating" });
  }
});

router.post("/partner", async (req: Request, res: Response) => {
  try {
    const {
      partnerId,
      partnerType,
      raterId,
      raterRole,
      orderId,
      serviceType,
      rating,
      comment,
      subRatings,
    } = req.body;

    if (!partnerId || !raterId || !raterRole || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Invalid rating data" });
    }

    const ratingSubmission = await prisma.ratingSubmission.create({
      data: {
        raterId,
        raterRole: raterRole as any,
        targetId: partnerId,
        targetRole: "partner",
        serviceType: serviceType || "food_delivery",
        orderId,
        rating,
        comment,
        subRatings,
        isLocked: true,
        processedAt: new Date(),
      },
    });

    let partnerRating = await prisma.partnerRating.findUnique({
      where: { partnerId },
    });

    const previousAverage = partnerRating?.averageRating || 5.0;
    const isDriverRating = raterRole === "driver";

    if (!partnerRating) {
      partnerRating = await prisma.partnerRating.create({
        data: {
          partnerId,
          partnerType: partnerType || "restaurant",
          averageRating: isDriverRating ? 5.0 : rating,
          totalRatings: isDriverRating ? 0 : 1,
          oneStarCount: !isDriverRating && rating === 1 ? 1 : 0,
          twoStarCount: !isDriverRating && rating === 2 ? 1 : 0,
          threeStarCount: !isDriverRating && rating === 3 ? 1 : 0,
          fourStarCount: !isDriverRating && rating === 4 ? 1 : 0,
          fiveStarCount: !isDriverRating && rating === 5 ? 1 : 0,
          driverRatingAvg: isDriverRating ? rating : undefined,
          driverRatingCount: isDriverRating ? 1 : 0,
          foodQualityScore: subRatings?.foodQuality,
          packingQualityScore: subRatings?.packingQuality,
          onTimeScore: subRatings?.onTime,
          pickupDelayScore: isDriverRating ? subRatings?.pickupDelay : undefined,
          behaviorScore: isDriverRating ? subRatings?.behavior : undefined,
        },
      });
    } else {
      const updateData: any = {};

      if (isDriverRating) {
        const newDriverCount = partnerRating.driverRatingCount + 1;
        const currentDriverAvg = partnerRating.driverRatingAvg || 5.0;
        const newDriverAvg = (currentDriverAvg * partnerRating.driverRatingCount + rating) / newDriverCount;

        updateData.driverRatingCount = newDriverCount;
        updateData.driverRatingAvg = Math.round(newDriverAvg * 100) / 100;

        if (subRatings?.pickupDelay !== undefined) updateData.pickupDelayScore = subRatings.pickupDelay;
        if (subRatings?.behavior !== undefined) updateData.behaviorScore = subRatings.behavior;
      } else {
        const starCountField = `${["one", "two", "three", "four", "five"][rating - 1]}StarCount` as const;
        const newTotal = partnerRating.totalRatings + 1;
        const newAverage =
          (partnerRating.averageRating * partnerRating.totalRatings + rating) / newTotal;

        updateData.totalRatings = newTotal;
        updateData.averageRating = Math.round(newAverage * 100) / 100;
        updateData[starCountField] = { increment: 1 };

        if (subRatings?.foodQuality !== undefined) updateData.foodQualityScore = subRatings.foodQuality;
        if (subRatings?.packingQuality !== undefined) updateData.packingQualityScore = subRatings.packingQuality;
        if (subRatings?.onTime !== undefined) updateData.onTimeScore = subRatings.onTime;

        let newVisibilityRank = partnerRating.searchVisibilityRank;
        if (newAverage >= 4.5) newVisibilityRank = 100;
        else if (newAverage >= 4.0) newVisibilityRank = 85;
        else if (newAverage >= 3.5) newVisibilityRank = 70;
        else if (newAverage >= 3.0) newVisibilityRank = 50;
        else newVisibilityRank = 25;

        updateData.searchVisibilityRank = newVisibilityRank;

        if (newAverage < RATING_THRESHOLDS.partner.visibilityReduction && !partnerRating.isRestricted) {
          updateData.isRestricted = true;
          updateData.restrictedAt = new Date();
          updateData.restrictionReason = `Average rating dropped below ${RATING_THRESHOLDS.partner.visibilityReduction}`;

          await createReputationFlag(
            partnerId,
            "partner",
            "low_rating_block",
            `Partner rating dropped to ${newAverage.toFixed(2)}`,
            "high",
            newAverage,
            "visibility_reduction"
          );
        } else if (newAverage < RATING_THRESHOLDS.partner.warning && newAverage >= RATING_THRESHOLDS.partner.visibilityReduction) {
          await createReputationFlag(
            partnerId,
            "partner",
            "low_rating_warning",
            `Partner rating dropped to ${newAverage.toFixed(2)}`,
            "medium",
            newAverage
          );
        }
      }

      partnerRating = await prisma.partnerRating.update({
        where: { partnerId },
        data: updateData,
      });
    }

    await logReputationEvent(
      partnerId,
      "partner",
      "rating_received",
      { orderId, serviceType, rater: raterId, raterRole },
      ratingSubmission.id,
      rating,
      previousAverage,
      partnerRating.averageRating,
      rating <= 2 ? FRAUD_SCORE_PENALTIES.lowRating : 0,
      partnerRating.isRestricted ? "visibility_reduction" : "none",
      undefined,
      "system"
    );

    console.log(`[Rating] Partner ${partnerId} rated ${rating} stars by ${raterRole} ${raterId}`);

    res.json({
      success: true,
      ratingId: ratingSubmission.id,
      newAverageRating: partnerRating.averageRating,
      totalRatings: partnerRating.totalRatings,
      searchVisibilityRank: partnerRating.searchVisibilityRank,
    });
  } catch (error) {
    console.error("[Rating] Partner rating error:", error);
    res.status(500).json({ error: "Failed to submit partner rating" });
  }
});

router.get("/customer/:customerId", async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const rating = await prisma.customerRating.findUnique({
      where: { customerId },
    });

    if (!rating) {
      return res.json({
        customerId,
        averageRating: 5.0,
        totalRatings: 0,
        breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        isRestricted: false,
      });
    }

    res.json({
      customerId,
      averageRating: rating.averageRating,
      totalRatings: rating.totalRatings,
      breakdown: {
        1: rating.oneStarCount,
        2: rating.twoStarCount,
        3: rating.threeStarCount,
        4: rating.fourStarCount,
        5: rating.fiveStarCount,
      },
      isRestricted: rating.isRestricted,
      restrictionLevel: rating.restrictionLevel,
      last30DaysAverage: rating.last30DaysAverage,
      ratingTrend: rating.ratingTrend,
    });
  } catch (error) {
    console.error("[Rating] Get customer rating error:", error);
    res.status(500).json({ error: "Failed to get customer rating" });
  }
});

router.get("/driver/:driverId", async (req: Request, res: Response) => {
  try {
    const { driverId } = req.params;

    const rating = await prisma.driverRating.findUnique({
      where: { driverId },
    });

    if (!rating) {
      return res.json({
        driverId,
        averageRating: 5.0,
        totalRatings: 0,
        breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        priorityScore: 100,
        isRestricted: false,
      });
    }

    res.json({
      driverId,
      averageRating: rating.averageRating,
      totalRatings: rating.totalRatings,
      breakdown: {
        1: rating.oneStarCount,
        2: rating.twoStarCount,
        3: rating.threeStarCount,
        4: rating.fourStarCount,
        5: rating.fiveStarCount,
      },
      subRatings: {
        safety: rating.safetyScore,
        navigation: rating.navigationScore,
        behavior: rating.behaviorScore,
        vehicleCondition: rating.vehicleCondition,
      },
      priorityScore: rating.priorityScore,
      isRestricted: rating.isRestricted,
      restrictionLevel: rating.restrictionLevel,
      last30DaysAverage: rating.last30DaysAverage,
      ratingTrend: rating.ratingTrend,
    });
  } catch (error) {
    console.error("[Rating] Get driver rating error:", error);
    res.status(500).json({ error: "Failed to get driver rating" });
  }
});

router.get("/partner/:partnerId", async (req: Request, res: Response) => {
  try {
    const { partnerId } = req.params;

    const rating = await prisma.partnerRating.findUnique({
      where: { partnerId },
    });

    if (!rating) {
      return res.json({
        partnerId,
        averageRating: 5.0,
        totalRatings: 0,
        breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        searchVisibilityRank: 100,
        isRestricted: false,
      });
    }

    res.json({
      partnerId,
      partnerType: rating.partnerType,
      averageRating: rating.averageRating,
      totalRatings: rating.totalRatings,
      breakdown: {
        1: rating.oneStarCount,
        2: rating.twoStarCount,
        3: rating.threeStarCount,
        4: rating.fourStarCount,
        5: rating.fiveStarCount,
      },
      subRatings: {
        foodQuality: rating.foodQualityScore,
        packingQuality: rating.packingQualityScore,
        onTime: rating.onTimeScore,
      },
      driverRatings: {
        average: rating.driverRatingAvg,
        count: rating.driverRatingCount,
        pickupDelay: rating.pickupDelayScore,
        behavior: rating.behaviorScore,
      },
      searchVisibilityRank: rating.searchVisibilityRank,
      isRestricted: rating.isRestricted,
      last30DaysAverage: rating.last30DaysAverage,
      ratingTrend: rating.ratingTrend,
    });
  } catch (error) {
    console.error("[Rating] Get partner rating error:", error);
    res.status(500).json({ error: "Failed to get partner rating" });
  }
});

router.get("/submissions", async (req: Request, res: Response) => {
  try {
    const { targetId, targetRole, limit = "50", offset = "0" } = req.query;

    const where: any = {};
    if (targetId) where.targetId = targetId;
    if (targetRole) where.targetRole = targetRole;

    const submissions = await prisma.ratingSubmission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.ratingSubmission.count({ where });

    res.json({
      submissions,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    console.error("[Rating] Get submissions error:", error);
    res.status(500).json({ error: "Failed to get rating submissions" });
  }
});

export default router;
