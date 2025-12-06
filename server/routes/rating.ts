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

const RATING_WEIGHTS = {
  customer: {
    overall: 0.6,
    behavior: 0.25,
    communication: 0.15,
  },
  driver: {
    overall: 0.4,
    safety: 0.25,
    navigation: 0.15,
    behavior: 0.1,
    vehicleCondition: 0.1,
  },
  partner: {
    overall: 0.4,
    foodQuality: 0.25,
    packingQuality: 0.1,
    onTime: 0.15,
    accuracy: 0.1,
  },
};

function calculateWeightedScore(
  overallRating: number,
  subRatings: Record<string, number> | null | undefined,
  userType: "customer" | "driver" | "partner"
): number {
  const weights = RATING_WEIGHTS[userType];
  let weightedSum = overallRating * weights.overall;
  let remainingWeight = 1.0 - weights.overall;

  if (subRatings) {
    let usedSubWeight = 0;
    Object.entries(weights).forEach(([key, weight]) => {
      if (key !== "overall" && subRatings[key] !== undefined) {
        weightedSum += subRatings[key] * weight;
        usedSubWeight += weight;
      }
    });
    if (usedSubWeight < remainingWeight) {
      weightedSum += overallRating * (remainingWeight - usedSubWeight);
    }
  } else {
    weightedSum += overallRating * remainingWeight;
  }

  return Math.round(weightedSum * 100) / 100;
}

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

    const weightedScore = calculateWeightedScore(rating, subRatings, "customer");

    if (!customerRating) {
      customerRating = await prisma.customerRating.create({
        data: {
          customerId,
          averageRating: weightedScore,
          weightedScoreSum: weightedScore,
          totalRatings: 1,
          oneStarCount: rating === 1 ? 1 : 0,
          twoStarCount: rating === 2 ? 1 : 0,
          threeStarCount: rating === 3 ? 1 : 0,
          fourStarCount: rating === 4 ? 1 : 0,
          fiveStarCount: rating === 5 ? 1 : 0,
          behaviorScore: subRatings?.behavior,
          behaviorScoreSum: subRatings?.behavior || 0,
          behaviorScoreCount: subRatings?.behavior ? 1 : 0,
          communicationScore: subRatings?.communication,
          communicationScoreSum: subRatings?.communication || 0,
          communicationScoreCount: subRatings?.communication ? 1 : 0,
        },
      });
    } else {
      const starCountField = `${["one", "two", "three", "four", "five"][rating - 1]}StarCount` as const;
      
      customerRating = await prisma.$transaction(async (tx) => {
        const current = await tx.customerRating.findUnique({ where: { customerId } });
        if (!current) throw new Error("Customer rating not found");
        
        const newTotal = current.totalRatings + 1;
        const newWeightedSum = current.weightedScoreSum + weightedScore;
        const newAverage = newWeightedSum / newTotal;
        const newStarCount = (current as any)[starCountField] + 1;

        const updateData: any = {
          totalRatings: newTotal,
          weightedScoreSum: newWeightedSum,
          averageRating: Math.round(newAverage * 100) / 100,
          [starCountField]: newStarCount,
        };

        if (subRatings?.behavior !== undefined) {
          const newBehaviorSum = current.behaviorScoreSum + subRatings.behavior;
          const newBehaviorCount = current.behaviorScoreCount + 1;
          updateData.behaviorScore = Math.round((newBehaviorSum / newBehaviorCount) * 100) / 100;
          updateData.behaviorScoreSum = newBehaviorSum;
          updateData.behaviorScoreCount = newBehaviorCount;
        }
        if (subRatings?.communication !== undefined) {
          const newCommSum = current.communicationScoreSum + subRatings.communication;
          const newCommCount = current.communicationScoreCount + 1;
          updateData.communicationScore = Math.round((newCommSum / newCommCount) * 100) / 100;
          updateData.communicationScoreSum = newCommSum;
          updateData.communicationScoreCount = newCommCount;
        }

        if (newAverage < RATING_THRESHOLDS.customer.cooldown && !current.isRestricted) {
          updateData.isRestricted = true;
          updateData.restrictedAt = new Date();
          updateData.restrictionReason = `Average rating dropped below ${RATING_THRESHOLDS.customer.cooldown}`;
          updateData.restrictionLevel = "cooldown";
        }

        return tx.customerRating.update({
          where: { customerId },
          data: updateData,
        });
      });
      
      const newAverage = customerRating.averageRating;
      if (newAverage < RATING_THRESHOLDS.customer.cooldown && customerRating.isRestricted) {
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
    }

    if (rating <= 2) {
      const penalty = rating === 1 ? FRAUD_SCORE_PENALTIES.veryLowRating : FRAUD_SCORE_PENALTIES.lowRating;
      await updateFraudScoreForRating(customerId, "customer", rating, penalty);
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
    const weightedScore = calculateWeightedScore(rating, subRatings, "driver");

    if (!driverRating) {
      driverRating = await prisma.driverRating.create({
        data: {
          driverId,
          averageRating: weightedScore,
          weightedScoreSum: weightedScore,
          totalRatings: 1,
          oneStarCount: rating === 1 ? 1 : 0,
          twoStarCount: rating === 2 ? 1 : 0,
          threeStarCount: rating === 3 ? 1 : 0,
          fourStarCount: rating === 4 ? 1 : 0,
          fiveStarCount: rating === 5 ? 1 : 0,
          priorityScore: weightedScore >= 4 ? 100 : weightedScore >= 3 ? 75 : 50,
          safetyScore: subRatings?.safety,
          safetyScoreSum: subRatings?.safety || 0,
          safetyScoreCount: subRatings?.safety ? 1 : 0,
          navigationScore: subRatings?.navigation,
          navigationScoreSum: subRatings?.navigation || 0,
          navigationScoreCount: subRatings?.navigation ? 1 : 0,
          behaviorScore: subRatings?.behavior,
          behaviorScoreSum: subRatings?.behavior || 0,
          behaviorScoreCount: subRatings?.behavior ? 1 : 0,
          vehicleCondition: subRatings?.vehicleCondition,
          vehicleConditionSum: subRatings?.vehicleCondition || 0,
          vehicleConditionCount: subRatings?.vehicleCondition ? 1 : 0,
        },
      });
    } else {
      const starCountField = `${["one", "two", "three", "four", "five"][rating - 1]}StarCount` as const;
      
      driverRating = await prisma.$transaction(async (tx) => {
        const current = await tx.driverRating.findUnique({ where: { driverId } });
        if (!current) throw new Error("Driver rating not found");
        
        const newTotal = current.totalRatings + 1;
        const newWeightedSum = current.weightedScoreSum + weightedScore;
        const newAverage = newWeightedSum / newTotal;
        const newStarCount = (current as any)[starCountField] + 1;

        let newPriorityScore = current.priorityScore;
        if (newAverage >= 4.5) newPriorityScore = 100;
        else if (newAverage >= 4.0) newPriorityScore = 85;
        else if (newAverage >= 3.5) newPriorityScore = 70;
        else if (newAverage >= 3.0) newPriorityScore = 50;
        else newPriorityScore = 25;

        const updateData: any = {
          totalRatings: newTotal,
          weightedScoreSum: newWeightedSum,
          averageRating: Math.round(newAverage * 100) / 100,
          [starCountField]: newStarCount,
          priorityScore: newPriorityScore,
        };

        if (subRatings) {
          if (subRatings.safety !== undefined) {
            const newSafetySum = current.safetyScoreSum + subRatings.safety;
            const newSafetyCount = current.safetyScoreCount + 1;
            updateData.safetyScore = Math.round((newSafetySum / newSafetyCount) * 100) / 100;
            updateData.safetyScoreSum = newSafetySum;
            updateData.safetyScoreCount = newSafetyCount;
          }
          if (subRatings.navigation !== undefined) {
            const newNavSum = current.navigationScoreSum + subRatings.navigation;
            const newNavCount = current.navigationScoreCount + 1;
            updateData.navigationScore = Math.round((newNavSum / newNavCount) * 100) / 100;
            updateData.navigationScoreSum = newNavSum;
            updateData.navigationScoreCount = newNavCount;
          }
          if (subRatings.behavior !== undefined) {
            const newBehaviorSum = current.behaviorScoreSum + subRatings.behavior;
            const newBehaviorCount = current.behaviorScoreCount + 1;
            updateData.behaviorScore = Math.round((newBehaviorSum / newBehaviorCount) * 100) / 100;
            updateData.behaviorScoreSum = newBehaviorSum;
            updateData.behaviorScoreCount = newBehaviorCount;
          }
          if (subRatings.vehicleCondition !== undefined) {
            const newVehicleSum = current.vehicleConditionSum + subRatings.vehicleCondition;
            const newVehicleCount = current.vehicleConditionCount + 1;
            updateData.vehicleCondition = Math.round((newVehicleSum / newVehicleCount) * 100) / 100;
            updateData.vehicleConditionSum = newVehicleSum;
            updateData.vehicleConditionCount = newVehicleCount;
          }
        }

        if (newAverage < RATING_THRESHOLDS.driver.temporaryBlock && !current.isRestricted) {
          updateData.isRestricted = true;
          updateData.restrictedAt = new Date();
          updateData.restrictionReason = `Average rating dropped below ${RATING_THRESHOLDS.driver.temporaryBlock}`;
          updateData.restrictionLevel = "temporary_block";
        }

        return tx.driverRating.update({
          where: { driverId },
          data: updateData,
        });
      });
      
      const newAverage = driverRating.averageRating;
      if (newAverage < RATING_THRESHOLDS.driver.temporaryBlock && driverRating.isRestricted) {
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
    }

    if (rating <= 2) {
      const penalty = rating === 1 ? FRAUD_SCORE_PENALTIES.veryLowRating : FRAUD_SCORE_PENALTIES.lowRating;
      await updateFraudScoreForRating(driverId, "driver", rating, penalty);
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
    const weightedScore = calculateWeightedScore(rating, subRatings, "partner");

    if (!partnerRating) {
      partnerRating = await prisma.partnerRating.create({
        data: {
          partnerId,
          partnerType: partnerType || "restaurant",
          averageRating: isDriverRating ? 5.0 : weightedScore,
          weightedScoreSum: isDriverRating ? 0 : weightedScore,
          totalRatings: isDriverRating ? 0 : 1,
          oneStarCount: !isDriverRating && rating === 1 ? 1 : 0,
          twoStarCount: !isDriverRating && rating === 2 ? 1 : 0,
          threeStarCount: !isDriverRating && rating === 3 ? 1 : 0,
          fourStarCount: !isDriverRating && rating === 4 ? 1 : 0,
          fiveStarCount: !isDriverRating && rating === 5 ? 1 : 0,
          driverRatingAvg: isDriverRating ? rating : undefined,
          driverRatingSum: isDriverRating ? rating : 0,
          driverRatingCount: isDriverRating ? 1 : 0,
          foodQualityScore: subRatings?.foodQuality,
          foodQualityScoreSum: subRatings?.foodQuality || 0,
          foodQualityScoreCount: subRatings?.foodQuality ? 1 : 0,
          packingQualityScore: subRatings?.packingQuality,
          packingScoreSum: subRatings?.packingQuality || 0,
          packingScoreCount: subRatings?.packingQuality ? 1 : 0,
          onTimeScore: subRatings?.onTime,
          onTimeScoreSum: subRatings?.onTime || 0,
          onTimeScoreCount: subRatings?.onTime ? 1 : 0,
          accuracyScore: subRatings?.accuracy,
          accuracyScoreSum: subRatings?.accuracy || 0,
          accuracyScoreCount: subRatings?.accuracy ? 1 : 0,
          pickupDelayScore: isDriverRating ? subRatings?.pickupDelay : undefined,
          pickupDelayScoreSum: isDriverRating && subRatings?.pickupDelay ? subRatings.pickupDelay : 0,
          pickupDelayScoreCount: isDriverRating && subRatings?.pickupDelay ? 1 : 0,
          behaviorScore: isDriverRating ? subRatings?.behavior : undefined,
          driverBehaviorScoreSum: isDriverRating && subRatings?.behavior ? subRatings.behavior : 0,
          driverBehaviorScoreCount: isDriverRating && subRatings?.behavior ? 1 : 0,
        },
      });
    } else {
      partnerRating = await prisma.$transaction(async (tx) => {
        const current = await tx.partnerRating.findUnique({ where: { partnerId } });
        if (!current) throw new Error("Partner rating not found");
        
        const updateData: any = {};

        if (isDriverRating) {
          const newDriverCount = current.driverRatingCount + 1;
          const newDriverSum = current.driverRatingSum + rating;
          const newDriverAvg = newDriverSum / newDriverCount;

          updateData.driverRatingCount = newDriverCount;
          updateData.driverRatingSum = newDriverSum;
          updateData.driverRatingAvg = Math.round(newDriverAvg * 100) / 100;

          if (subRatings?.pickupDelay !== undefined) {
            const newDelaySum = current.pickupDelayScoreSum + subRatings.pickupDelay;
            const newDelayCount = current.pickupDelayScoreCount + 1;
            updateData.pickupDelayScore = Math.round((newDelaySum / newDelayCount) * 100) / 100;
            updateData.pickupDelayScoreSum = newDelaySum;
            updateData.pickupDelayScoreCount = newDelayCount;
          }
          if (subRatings?.behavior !== undefined) {
            const newBehaviorSum = current.driverBehaviorScoreSum + subRatings.behavior;
            const newBehaviorCount = current.driverBehaviorScoreCount + 1;
            updateData.behaviorScore = Math.round((newBehaviorSum / newBehaviorCount) * 100) / 100;
            updateData.driverBehaviorScoreSum = newBehaviorSum;
            updateData.driverBehaviorScoreCount = newBehaviorCount;
          }
        } else {
          const starCountField = `${["one", "two", "three", "four", "five"][rating - 1]}StarCount` as const;
          const newTotal = current.totalRatings + 1;
          const newWeightedSum = current.weightedScoreSum + weightedScore;
          const newAverage = newWeightedSum / newTotal;
          const newStarCount = (current as any)[starCountField] + 1;

          updateData.totalRatings = newTotal;
          updateData.weightedScoreSum = newWeightedSum;
          updateData.averageRating = Math.round(newAverage * 100) / 100;
          updateData[starCountField] = newStarCount;

          if (subRatings?.foodQuality !== undefined) {
            const newFoodSum = current.foodQualityScoreSum + subRatings.foodQuality;
            const newFoodCount = current.foodQualityScoreCount + 1;
            updateData.foodQualityScore = Math.round((newFoodSum / newFoodCount) * 100) / 100;
            updateData.foodQualityScoreSum = newFoodSum;
            updateData.foodQualityScoreCount = newFoodCount;
          }
          if (subRatings?.packingQuality !== undefined) {
            const newPackSum = current.packingScoreSum + subRatings.packingQuality;
            const newPackCount = current.packingScoreCount + 1;
            updateData.packingQualityScore = Math.round((newPackSum / newPackCount) * 100) / 100;
            updateData.packingScoreSum = newPackSum;
            updateData.packingScoreCount = newPackCount;
          }
          if (subRatings?.onTime !== undefined) {
            const newTimeSum = current.onTimeScoreSum + subRatings.onTime;
            const newTimeCount = current.onTimeScoreCount + 1;
            updateData.onTimeScore = Math.round((newTimeSum / newTimeCount) * 100) / 100;
            updateData.onTimeScoreSum = newTimeSum;
            updateData.onTimeScoreCount = newTimeCount;
          }
          if (subRatings?.accuracy !== undefined) {
            const newAccSum = current.accuracyScoreSum + subRatings.accuracy;
            const newAccCount = current.accuracyScoreCount + 1;
            updateData.accuracyScore = Math.round((newAccSum / newAccCount) * 100) / 100;
            updateData.accuracyScoreSum = newAccSum;
            updateData.accuracyScoreCount = newAccCount;
          }

          let newVisibilityRank = current.searchVisibilityRank;
          if (newAverage >= 4.5) newVisibilityRank = 100;
          else if (newAverage >= 4.0) newVisibilityRank = 85;
          else if (newAverage >= 3.5) newVisibilityRank = 70;
          else if (newAverage >= 3.0) newVisibilityRank = 50;
          else newVisibilityRank = 25;

          updateData.searchVisibilityRank = newVisibilityRank;

          if (newAverage < RATING_THRESHOLDS.partner.visibilityReduction && !current.isRestricted) {
            updateData.isRestricted = true;
            updateData.restrictedAt = new Date();
            updateData.restrictionReason = `Average rating dropped below ${RATING_THRESHOLDS.partner.visibilityReduction}`;
          }
        }

        return tx.partnerRating.update({
          where: { partnerId },
          data: updateData,
        });
      });
      
      const newAverage = partnerRating.averageRating;
      if (!isDriverRating) {
        if (newAverage < RATING_THRESHOLDS.partner.visibilityReduction && partnerRating.isRestricted) {
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
    }

    if (rating <= 2) {
      const penalty = rating === 1 ? FRAUD_SCORE_PENALTIES.veryLowRating : FRAUD_SCORE_PENALTIES.lowRating;
      await updateFraudScoreForRating(partnerId, "partner", rating, penalty);
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
