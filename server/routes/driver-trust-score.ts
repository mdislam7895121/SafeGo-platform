import { Router, Response } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

function serializeDecimal(value: any): number {
  if (value === null || value === undefined) return 0;
  return parseFloat(value.toString());
}

interface TrustScoreBreakdown {
  onTimeArrivals: { score: number; weight: number; weighted: number; rawValue: number };
  riderRatings: { score: number; weight: number; weighted: number; rawValue: number };
  cancellationRate: { score: number; weight: number; weighted: number; rawValue: number };
  safetyBehavior: { score: number; weight: number; weighted: number; rawValue: number };
  supportTickets: { score: number; weight: number; weighted: number; rawValue: number };
}

function calculateTrustScore(stats: {
  onTimeArrivalRate: number;
  riderRatingAvg: number;
  cancellationRate: number;
  safetyViolationCount: number;
  supportTicketScore: number;
  totalTrips: number;
}): { score: number; breakdown: TrustScoreBreakdown } {
  const weights = {
    onTimeArrivals: 0.25,
    riderRatings: 0.25,
    cancellationRate: 0.20,
    safetyBehavior: 0.20,
    supportTickets: 0.10
  };

  const onTimeScore = Math.min(100, stats.onTimeArrivalRate * 100);
  const riderRatingScore = Math.min(100, (stats.riderRatingAvg / 5) * 100);
  const cancellationScore = Math.max(0, 100 - (stats.cancellationRate * 500));
  const safetyScore = Math.max(0, 100 - (stats.safetyViolationCount * 10));
  const supportScore = stats.supportTicketScore;

  const breakdown: TrustScoreBreakdown = {
    onTimeArrivals: {
      score: Math.round(onTimeScore),
      weight: weights.onTimeArrivals,
      weighted: Math.round(onTimeScore * weights.onTimeArrivals),
      rawValue: stats.onTimeArrivalRate
    },
    riderRatings: {
      score: Math.round(riderRatingScore),
      weight: weights.riderRatings,
      weighted: Math.round(riderRatingScore * weights.riderRatings),
      rawValue: stats.riderRatingAvg
    },
    cancellationRate: {
      score: Math.round(cancellationScore),
      weight: weights.cancellationRate,
      weighted: Math.round(cancellationScore * weights.cancellationRate),
      rawValue: stats.cancellationRate
    },
    safetyBehavior: {
      score: Math.round(safetyScore),
      weight: weights.safetyBehavior,
      weighted: Math.round(safetyScore * weights.safetyBehavior),
      rawValue: stats.safetyViolationCount
    },
    supportTickets: {
      score: Math.round(supportScore),
      weight: weights.supportTickets,
      weighted: Math.round(supportScore * weights.supportTickets),
      rawValue: stats.supportTicketScore
    }
  };

  const totalScore = Math.round(
    breakdown.onTimeArrivals.weighted +
    breakdown.riderRatings.weighted +
    breakdown.cancellationRate.weighted +
    breakdown.safetyBehavior.weighted +
    breakdown.supportTickets.weighted
  );

  return {
    score: Math.min(100, Math.max(0, totalScore)),
    breakdown
  };
}

function getTrustScoreStatus(score: number): { color: string; label: string; description: string } {
  if (score >= 80) {
    return {
      color: "green",
      label: "Excellent",
      description: "You're a top-rated driver! Eligible for priority dispatch and bonus incentives."
    };
  } else if (score >= 40) {
    return {
      color: "yellow",
      label: "Good",
      description: "You're doing well. Focus on the improvement tips to reach Excellent status."
    };
  } else {
    return {
      color: "red",
      label: "Needs Improvement",
      description: "Your trust score is low. This may affect trip priority. Follow improvement tips urgently."
    };
  }
}

function getImprovementTips(breakdown: TrustScoreBreakdown): string[] {
  const tips: string[] = [];

  if (breakdown.onTimeArrivals.score < 80) {
    tips.push("Aim to arrive at pickup locations on time. Use navigation apps for better route planning.");
  }
  if (breakdown.riderRatings.score < 80) {
    tips.push("Provide excellent customer service. Keep your vehicle clean and be courteous to riders.");
  }
  if (breakdown.cancellationRate.score < 80) {
    tips.push("Avoid cancelling accepted trips. Only accept trips you can complete.");
  }
  if (breakdown.safetyBehavior.score < 80) {
    tips.push("Drive safely. Avoid harsh braking and speeding to improve your safety score.");
  }
  if (breakdown.supportTickets.score < 80) {
    tips.push("Resolve disputes professionally. Good communication with support improves this score.");
  }

  if (tips.length === 0) {
    tips.push("Keep up the great work! Maintain your excellent driving habits.");
  }

  return tips;
}

router.use(authenticateToken);
router.use(requireRole(["driver"]));

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        driverStats: true
      }
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    if (!driverProfile.isVerified) {
      return res.status(403).json({ 
        error: "KYC verification required to view trust score",
        kyc_required: true 
      });
    }

    let stats = driverProfile.driverStats;
    
    if (!stats) {
      stats = await prisma.driverStats.create({
        data: {
          driverId: driverProfile.id,
          trustScore: 75,
          onTimeArrivalRate: 0.85,
          riderRatingAvg: 5.0,
          cancellationRate: 0.05,
          safetyViolationCount: 0,
          supportTicketScore: 100,
          lastTrustScoreUpdate: new Date()
        }
      });
    }

    const { score, breakdown } = calculateTrustScore({
      onTimeArrivalRate: serializeDecimal(stats.onTimeArrivalRate),
      riderRatingAvg: serializeDecimal(stats.riderRatingAvg),
      cancellationRate: serializeDecimal(stats.cancellationRate),
      safetyViolationCount: stats.safetyViolationCount,
      supportTicketScore: stats.supportTicketScore,
      totalTrips: stats.totalTrips
    });

    const status = getTrustScoreStatus(score);
    const tips = getImprovementTips(breakdown);

    const bonusEligible = score >= 90;
    const penaltyApplied = score < 40;

    res.json({
      trustScore: score,
      status,
      breakdown,
      tips,
      bonusEligible,
      penaltyApplied,
      lastUpdated: stats.lastTrustScoreUpdate?.toISOString() || new Date().toISOString(),
      stats: {
        totalTrips: stats.totalTrips,
        rating: serializeDecimal(stats.rating),
        onTimeArrivals: stats.totalOnTimeArrivals,
        lateArrivals: stats.totalLateArrivals,
        cancellations: stats.totalCancellations
      }
    });
  } catch (error) {
    console.error("Get trust score error:", error);
    res.status(500).json({ error: "Failed to fetch trust score" });
  }
});

router.get("/history", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId }
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const stats = await prisma.driverStats.findUnique({
      where: { driverId: driverProfile.id }
    });

    if (!stats) {
      return res.json({ history: [] });
    }

    const storedBreakdown = stats.trustScoreBreakdown as TrustScoreBreakdown | null;

    const history = [
      {
        date: stats.lastTrustScoreUpdate?.toISOString() || new Date().toISOString(),
        score: stats.trustScore,
        breakdown: storedBreakdown || null
      }
    ];

    res.json({ history });
  } catch (error) {
    console.error("Get trust score history error:", error);
    res.status(500).json({ error: "Failed to fetch trust score history" });
  }
});

router.post("/recalculate-all", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const allDriverStats = await prisma.driverStats.findMany({
      include: {
        driver: {
          select: { id: true, isVerified: true }
        }
      }
    });

    let updated = 0;
    let skipped = 0;

    for (const stats of allDriverStats) {
      if (!stats.driver.isVerified) {
        skipped++;
        continue;
      }

      const { score, breakdown } = calculateTrustScore({
        onTimeArrivalRate: serializeDecimal(stats.onTimeArrivalRate),
        riderRatingAvg: serializeDecimal(stats.riderRatingAvg),
        cancellationRate: serializeDecimal(stats.cancellationRate),
        safetyViolationCount: stats.safetyViolationCount,
        supportTicketScore: stats.supportTicketScore,
        totalTrips: stats.totalTrips
      });

      await prisma.driverStats.update({
        where: { id: stats.id },
        data: {
          trustScore: score,
          trustScoreBreakdown: breakdown as unknown as Prisma.InputJsonValue,
          lastTrustScoreUpdate: new Date()
        }
      });

      updated++;
    }

    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        actorId: userId,
        actorEmail: user.email,
        actorRole: "admin",
        actionType: "TRUST_SCORE_BATCH_RECALCULATE",
        entityType: "driver_stats",
        entityId: "batch",
        description: `Admin triggered batch trust score recalculation. Updated: ${updated}, Skipped: ${skipped}`,
        metadata: { updated, skipped, totalProcessed: allDriverStats.length }
      }
    });

    res.json({
      success: true,
      message: "Batch trust score recalculation complete",
      updated,
      skipped,
      totalProcessed: allDriverStats.length
    });
  } catch (error) {
    console.error("Batch recalculate trust scores error:", error);
    res.status(500).json({ error: "Failed to recalculate trust scores" });
  }
});

router.post("/recalculate", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        driverStats: true
      }
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    if (!driverProfile.isVerified) {
      return res.status(403).json({ 
        error: "KYC verification required",
        kyc_required: true 
      });
    }

    const stats = driverProfile.driverStats;
    if (!stats) {
      return res.status(404).json({ error: "Driver stats not found" });
    }

    const { score, breakdown } = calculateTrustScore({
      onTimeArrivalRate: serializeDecimal(stats.onTimeArrivalRate),
      riderRatingAvg: serializeDecimal(stats.riderRatingAvg),
      cancellationRate: serializeDecimal(stats.cancellationRate),
      safetyViolationCount: stats.safetyViolationCount,
      supportTicketScore: stats.supportTicketScore,
      totalTrips: stats.totalTrips
    });

    await prisma.driverStats.update({
      where: { driverId: driverProfile.id },
      data: {
        trustScore: score,
        trustScoreBreakdown: breakdown as unknown as Prisma.InputJsonValue,
        lastTrustScoreUpdate: new Date()
      }
    });

    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        actorId: userId,
        actorEmail: "driver@safego.app",
        actorRole: "driver",
        actionType: "TRUST_SCORE_RECALCULATE",
        entityType: "driver_stats",
        entityId: stats.id,
        description: `Driver requested trust score recalculation. New score: ${score}`,
        metadata: { previousScore: stats.trustScore, newScore: score }
      }
    });

    res.json({
      success: true,
      trustScore: score,
      breakdown,
      message: "Trust score recalculated successfully"
    });
  } catch (error) {
    console.error("Recalculate trust score error:", error);
    res.status(500).json({ error: "Failed to recalculate trust score" });
  }
});

export default router;
