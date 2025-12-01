import { Router } from "express";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { logAuditEvent } from "../utils/audit";

type IncentiveGoalPeriod = "DAILY" | "WEEKLY" | "MONTHLY";
type IncentiveGoalType = "TRIPS" | "EARNINGS" | "RATING";
type IncentiveCycleStatus = "ACTIVE" | "COMPLETED" | "EXPIRED" | "BONUS_PAID";
type AchievementType = 
  | "FIVE_STAR_WEEK" 
  | "ZERO_CANCEL_STREAK" 
  | "HUNDRED_RIDES" 
  | "WEEKLY_PRO_DRIVER" 
  | "THOUSAND_TRIPS" 
  | "FIRST_TRIP" 
  | "EARLY_BIRD" 
  | "NIGHT_OWL" 
  | "FIVE_STAR_MONTH" 
  | "PERFECT_STREAK_10" 
  | "LOYALTY_30_DAYS" 
  | "LOYALTY_90_DAYS";
type RewardType = "TIER_BONUS" | "PROMO_BONUS" | "ACHIEVEMENT_BONUS" | "INCENTIVE_BONUS" | "REFERRAL_BONUS";
type DriverRewardTier = "BRONZE" | "SILVER" | "GOLD";

const router = Router();

function serializeDecimal(value: any): number {
  if (value === null || value === undefined) return 0;
  return parseFloat(value.toString());
}

function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getEndOfWeek(date: Date): Date {
  const d = new Date(getStartOfWeek(date));
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getEndOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getDriverRewardTier(points: number): DriverRewardTier {
  if (points >= 1500) return "GOLD";
  if (points >= 500) return "SILVER";
  return "BRONZE";
}

interface AchievementConfig {
  name: string;
  description: string;
  icon: string;
  requiredCount: number;
  bonusAmount: number;
}

const ACHIEVEMENT_CONFIG: Record<AchievementType, AchievementConfig> = {
  FIRST_TRIP: { name: "First Ride", description: "Complete your first trip", icon: "rocket", requiredCount: 1, bonusAmount: 5 },
  HUNDRED_RIDES: { name: "Century Club", description: "Complete 100 trips", icon: "trophy", requiredCount: 100, bonusAmount: 50 },
  THOUSAND_TRIPS: { name: "Road Warrior", description: "Complete 1,000 trips", icon: "medal", requiredCount: 1000, bonusAmount: 200 },
  FIVE_STAR_WEEK: { name: "5-Star Week", description: "Maintain 5.0 rating for 7 days", icon: "star", requiredCount: 7, bonusAmount: 25 },
  FIVE_STAR_MONTH: { name: "5-Star Month", description: "Maintain 4.9+ rating for 30 days", icon: "crown", requiredCount: 30, bonusAmount: 75 },
  ZERO_CANCEL_STREAK: { name: "Zero Cancel Streak", description: "Complete 50 trips with no cancellations", icon: "shield-check", requiredCount: 50, bonusAmount: 30 },
  WEEKLY_PRO_DRIVER: { name: "Weekly Pro Driver", description: "Meet weekly pro driver criteria", icon: "badge-check", requiredCount: 1, bonusAmount: 20 },
  EARLY_BIRD: { name: "Early Bird", description: "Complete 10 trips before 8 AM", icon: "sunrise", requiredCount: 10, bonusAmount: 15 },
  NIGHT_OWL: { name: "Night Owl", description: "Complete 10 trips after 10 PM", icon: "moon", requiredCount: 10, bonusAmount: 15 },
  PERFECT_STREAK_10: { name: "Perfect 10", description: "Get 10 consecutive 5-star ratings", icon: "zap", requiredCount: 10, bonusAmount: 20 },
  LOYALTY_30_DAYS: { name: "30 Day Streak", description: "Stay active for 30 consecutive days", icon: "calendar", requiredCount: 30, bonusAmount: 40 },
  LOYALTY_90_DAYS: { name: "90 Day Veteran", description: "Stay active for 90 consecutive days", icon: "award", requiredCount: 90, bonusAmount: 100 },
};

interface TierRewardInfo {
  name: string;
  color: string;
  benefits: string[];
  minPoints: number;
}

const TIER_REWARDS: Record<DriverRewardTier, TierRewardInfo> = {
  BRONZE: { 
    name: "Bronze", 
    color: "#CD7F32", 
    benefits: ["Access to standard promotions", "Basic support priority", "Weekly earning summaries"],
    minPoints: 0
  },
  SILVER: { 
    name: "Silver", 
    color: "#C0C0C0", 
    benefits: ["Priority promotion access", "Faster support response", "Bonus multiplier 1.1x", "Exclusive weekly challenges"],
    minPoints: 500
  },
  GOLD: { 
    name: "Gold", 
    color: "#FFD700", 
    benefits: ["VIP promotion access", "Priority support queue", "Bonus multiplier 1.25x", "Early access to new features", "Monthly bonus rewards"],
    minPoints: 1500
  },
};

async function countTripsInPeriod(driverId: string, start: Date, end: Date): Promise<number> {
  const [rides, food, delivery] = await Promise.all([
    prisma.ride.count({
      where: {
        driverId,
        status: "completed",
        isDemo: false,
        completedAt: { gte: start, lte: end },
      },
    }),
    prisma.foodOrder.count({
      where: {
        driverId,
        status: "delivered",
        isDemo: false,
        deliveredAt: { gte: start, lte: end },
      },
    }),
    prisma.delivery.count({
      where: {
        driverId,
        status: "delivered",
        isDemo: false,
        deliveredAt: { gte: start, lte: end },
      },
    }),
  ]);
  return rides + food + delivery;
}

async function getEarningsInPeriod(driverId: string, start: Date, end: Date): Promise<number> {
  const [rides, food, delivery] = await Promise.all([
    prisma.ride.aggregate({
      where: { driverId, status: "completed", isDemo: false, completedAt: { gte: start, lte: end } },
      _sum: { driverPayout: true },
    }),
    prisma.foodOrder.aggregate({
      where: { driverId, status: "delivered", isDemo: false, deliveredAt: { gte: start, lte: end } },
      _sum: { driverPayout: true },
    }),
    prisma.delivery.aggregate({
      where: { driverId, status: "delivered", isDemo: false, deliveredAt: { gte: start, lte: end } },
      _sum: { driverPayout: true },
    }),
  ]);
  return serializeDecimal(rides._sum.driverPayout) + 
         serializeDecimal(food._sum.driverPayout) + 
         serializeDecimal(delivery._sum.driverPayout);
}

async function getTotalTrips(driverId: string): Promise<number> {
  const [rides, food, delivery] = await Promise.all([
    prisma.ride.count({ where: { driverId, status: "completed", isDemo: false } }),
    prisma.foodOrder.count({ where: { driverId, status: "delivered", isDemo: false } }),
    prisma.delivery.count({ where: { driverId, status: "delivered", isDemo: false } }),
  ]);
  return rides + food + delivery;
}

async function getFiveStarCount(driverId: string): Promise<number> {
  const [rides, food] = await Promise.all([
    prisma.ride.count({ where: { driverId, customerRating: 5, isDemo: false } }),
    prisma.foodOrder.count({ where: { driverId, customerRating: 5, isDemo: false } }),
  ]);
  return rides + food;
}

router.get(
  "/",
  authenticateToken,
  requireRole(["driver"]),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;

      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
        select: { id: true, isVerified: true, verificationStatus: true, isSuspended: true },
      });

      if (!driverProfile) {
        return res.status(403).json({ error: "Driver profile not found" });
      }

      if (driverProfile.isSuspended) {
        return res.status(403).json({ error: "Account is suspended" });
      }

      const driverId = driverProfile.id;
      const isKycApproved = driverProfile.isVerified && driverProfile.verificationStatus === "approved";
      const now = new Date();

      const todayStart = getStartOfDay(now);
      const todayEnd = getEndOfDay(now);
      const weekStart = getStartOfWeek(now);
      const weekEnd = getEndOfWeek(now);
      const monthStart = getStartOfMonth(now);
      const monthEnd = getEndOfMonth(now);

      const [dailyTrips, weeklyTrips, monthlyTrips] = await Promise.all([
        countTripsInPeriod(driverId, todayStart, todayEnd),
        countTripsInPeriod(driverId, weekStart, weekEnd),
        countTripsInPeriod(driverId, monthStart, monthEnd),
      ]);

      let dailyEarnings = 0;
      let weeklyEarnings = 0;
      let monthlyEarnings = 0;

      if (isKycApproved) {
        [dailyEarnings, weeklyEarnings, monthlyEarnings] = await Promise.all([
          getEarningsInPeriod(driverId, todayStart, todayEnd),
          getEarningsInPeriod(driverId, weekStart, weekEnd),
          getEarningsInPeriod(driverId, monthStart, monthEnd),
        ]);
      }

      const dailyGoal = 10;
      const weeklyGoal = 50;
      const monthlyGoal = 150;
      const dailyEarningsGoal = 100;
      const weeklyEarningsGoal = 500;
      const monthlyEarningsGoal = 2000;

      const activeCycles = await prisma.driverIncentiveCycle.findMany({
        where: {
          driverId,
          status: "ACTIVE",
          periodEnd: { gte: now },
        },
        orderBy: { periodEnd: "asc" },
      });

      const driverPoints = await prisma.driverPoints.findUnique({
        where: { driverId },
        select: { totalPoints: true, lifetimePoints: true },
      });

      const totalPoints = driverPoints?.totalPoints || 0;
      const currentTier = getDriverRewardTier(totalPoints);

      const upcomingMilestones = [];
      
      if (dailyTrips < dailyGoal) {
        upcomingMilestones.push({
          type: "DAILY_TRIPS",
          current: dailyTrips,
          target: dailyGoal,
          progress: Math.round((dailyTrips / dailyGoal) * 100),
          description: `Complete ${dailyGoal} trips today`,
          expiresAt: todayEnd,
        });
      }

      if (weeklyTrips < weeklyGoal) {
        upcomingMilestones.push({
          type: "WEEKLY_TRIPS",
          current: weeklyTrips,
          target: weeklyGoal,
          progress: Math.round((weeklyTrips / weeklyGoal) * 100),
          description: `Complete ${weeklyGoal} trips this week`,
          expiresAt: weekEnd,
        });
      }

      if (monthlyTrips < monthlyGoal) {
        upcomingMilestones.push({
          type: "MONTHLY_TRIPS",
          current: monthlyTrips,
          target: monthlyGoal,
          progress: Math.round((monthlyTrips / monthlyGoal) * 100),
          description: `Complete ${monthlyGoal} trips this month`,
          expiresAt: monthEnd,
        });
      }

      await logAuditEvent({
        actorId: userId,
        actorEmail: "",
        actorRole: "driver",
        actionType: "VIEW_INCENTIVES",
        entityType: "incentives",
        entityId: driverId,
        description: "Driver viewed incentives dashboard",
        metadata: { dailyTrips, weeklyTrips, monthlyTrips },
      });

      res.json({
        goals: {
          daily: {
            trips: { current: dailyTrips, target: dailyGoal, progress: Math.min(100, Math.round((dailyTrips / dailyGoal) * 100)) },
            earnings: isKycApproved ? { current: dailyEarnings, target: dailyEarningsGoal, progress: Math.min(100, Math.round((dailyEarnings / dailyEarningsGoal) * 100)) } : null,
          },
          weekly: {
            trips: { current: weeklyTrips, target: weeklyGoal, progress: Math.min(100, Math.round((weeklyTrips / weeklyGoal) * 100)) },
            earnings: isKycApproved ? { current: weeklyEarnings, target: weeklyEarningsGoal, progress: Math.min(100, Math.round((weeklyEarnings / weeklyEarningsGoal) * 100)) } : null,
          },
          monthly: {
            trips: { current: monthlyTrips, target: monthlyGoal, progress: Math.min(100, Math.round((monthlyTrips / monthlyGoal) * 100)) },
            earnings: isKycApproved ? { current: monthlyEarnings, target: monthlyEarningsGoal, progress: Math.min(100, Math.round((monthlyEarnings / monthlyEarningsGoal) * 100)) } : null,
          },
        },
        upcomingMilestones,
        activeCycles: activeCycles.map(c => ({
          id: c.id,
          period: c.period,
          goalType: c.goalType,
          targetValue: c.targetValue,
          currentValue: c.currentValue,
          progress: Math.min(100, Math.round((c.currentValue / c.targetValue) * 100)),
          bonusAmount: serializeDecimal(c.bonusAmount),
          currency: c.currency,
          periodStart: c.periodStart,
          periodEnd: c.periodEnd,
          status: c.status,
        })),
        currentTier,
        tierInfo: TIER_REWARDS[currentTier],
        totalPoints,
        kycApproved: isKycApproved,
      });
    } catch (error: any) {
      console.error("Error fetching incentives:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

router.get(
  "/achievements",
  authenticateToken,
  requireRole(["driver"]),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;

      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
        select: { id: true, isVerified: true, verificationStatus: true, isSuspended: true },
      });

      if (!driverProfile) {
        return res.status(403).json({ error: "Driver profile not found" });
      }

      if (driverProfile.isSuspended) {
        return res.status(403).json({ error: "Account is suspended" });
      }

      const driverId = driverProfile.id;
      const isKycApproved = driverProfile.isVerified && driverProfile.verificationStatus === "approved";

      const existingAchievements = await prisma.driverAchievement.findMany({
        where: { driverId },
      });

      const achievementMap = new Map(existingAchievements.map(a => [a.achievementType, a]));

      const [totalTrips, fiveStarRatings] = await Promise.all([
        getTotalTrips(driverId),
        getFiveStarCount(driverId),
      ]);

      const allAchievements = Object.entries(ACHIEVEMENT_CONFIG).map(([type, config]) => {
        const existing = achievementMap.get(type as AchievementType);
        
        let progressCount = 0;
        if (type === "FIRST_TRIP" || type === "HUNDRED_RIDES" || type === "THOUSAND_TRIPS") {
          progressCount = Math.min(totalTrips, config.requiredCount);
        } else if (type === "PERFECT_STREAK_10") {
          progressCount = Math.min(fiveStarRatings, config.requiredCount);
        }

        const actualProgress = existing?.progressCount || progressCount;

        return {
          type,
          ...config,
          isUnlocked: existing?.isUnlocked || false,
          unlockedAt: existing?.unlockedAt || null,
          progressCount: actualProgress,
          requiredCount: config.requiredCount,
          progress: Math.min(100, Math.round((actualProgress / config.requiredCount) * 100)),
          bonusAmount: isKycApproved ? config.bonusAmount : 0,
          bonusPaid: existing?.bonusPaid || false,
        };
      });

      const unlockedCount = allAchievements.filter(a => a.isUnlocked).length;
      const totalBonusEarned = isKycApproved 
        ? allAchievements.filter(a => a.bonusPaid).reduce((sum, a) => sum + a.bonusAmount, 0) 
        : 0;

      await logAuditEvent({
        actorId: userId,
        actorEmail: "",
        actorRole: "driver",
        actionType: "VIEW_ACHIEVEMENTS",
        entityType: "achievements",
        entityId: driverId,
        description: "Driver viewed achievements",
        metadata: { unlockedCount, totalAchievements: allAchievements.length },
      });

      res.json({
        achievements: allAchievements,
        summary: {
          unlocked: unlockedCount,
          total: allAchievements.length,
          totalBonusEarned,
          progress: Math.round((unlockedCount / allAchievements.length) * 100),
        },
        kycApproved: isKycApproved,
      });
    } catch (error: any) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

router.get(
  "/rewards",
  authenticateToken,
  requireRole(["driver"]),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { page = "1", limit = "20" } = req.query;

      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(50, Math.max(1, parseInt(limit as string) || 20));
      const skip = (pageNum - 1) * limitNum;

      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
        select: { id: true, isVerified: true, verificationStatus: true, isSuspended: true },
      });

      if (!driverProfile) {
        return res.status(403).json({ error: "Driver profile not found" });
      }

      if (driverProfile.isSuspended) {
        return res.status(403).json({ error: "Account is suspended" });
      }

      const driverId = driverProfile.id;
      const isKycApproved = driverProfile.isVerified && driverProfile.verificationStatus === "approved";

      const driverPoints = await prisma.driverPoints.findUnique({
        where: { driverId },
        select: { totalPoints: true, lifetimePoints: true },
      });

      const totalPoints = driverPoints?.totalPoints || 0;
      const currentTier = getDriverRewardTier(totalPoints);

      const now = new Date();
      const activePromotions = await prisma.driverPromotion.findMany({
        where: {
          status: "ACTIVE",
          startAt: { lte: now },
          endAt: { gte: now },
          isDemo: false,
        },
        orderBy: { endAt: "asc" },
        take: 5,
      });

      const [rewardHistory, totalRewards] = await Promise.all([
        prisma.driverRewardLedger.findMany({
          where: { driverId },
          orderBy: { issuedAt: "desc" },
          skip,
          take: limitNum,
          include: {
            promotion: { select: { name: true } },
          },
        }),
        prisma.driverRewardLedger.count({ where: { driverId } }),
      ]);

      const totalEarnedRewards = await prisma.driverRewardLedger.aggregate({
        where: { driverId, isPaid: true },
        _sum: { amount: true },
      });

      const tierRewards = Object.entries(TIER_REWARDS).map(([tier, info]) => ({
        tier,
        ...info,
        isUnlocked: totalPoints >= info.minPoints,
        isCurrent: tier === currentTier,
        pointsNeeded: Math.max(0, info.minPoints - totalPoints),
      }));

      const nextTier = tierRewards.find(t => !t.isUnlocked && t.pointsNeeded > 0);

      await logAuditEvent({
        actorId: userId,
        actorEmail: "",
        actorRole: "driver",
        actionType: "VIEW_REWARDS",
        entityType: "rewards",
        entityId: driverId,
        description: "Driver viewed rewards",
        metadata: { currentTier, totalPoints },
      });

      res.json({
        currentTier,
        tierInfo: TIER_REWARDS[currentTier],
        totalPoints,
        nextTier: nextTier ? {
          tier: nextTier.tier,
          name: nextTier.name,
          pointsNeeded: nextTier.pointsNeeded,
          benefits: nextTier.benefits,
        } : null,
        tierRewards,
        activePromotions: activePromotions.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          type: p.type,
          serviceType: p.serviceType,
          startAt: p.startAt,
          endAt: p.endAt,
          rewardPerUnit: serializeDecimal(p.rewardPerUnit),
          targetTrips: p.targetTrips,
          targetEarnings: p.targetEarnings ? serializeDecimal(p.targetEarnings) : null,
        })),
        rewardHistory: isKycApproved ? rewardHistory.map(r => ({
          id: r.id,
          rewardType: r.rewardType,
          tier: r.tier,
          amount: serializeDecimal(r.amount),
          currency: r.currency,
          description: r.description,
          promotionName: r.promotion?.name || null,
          isPaid: r.isPaid,
          paidAt: r.paidAt,
          issuedAt: r.issuedAt,
        })) : [],
        totalEarnedRewards: isKycApproved ? serializeDecimal(totalEarnedRewards._sum.amount) : 0,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalRewards,
          totalPages: Math.ceil(totalRewards / limitNum),
        },
        kycApproved: isKycApproved,
      });
    } catch (error: any) {
      console.error("Error fetching rewards:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

router.get(
  "/stats",
  authenticateToken,
  requireRole(["driver"]),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;

      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
        select: { id: true, isVerified: true, verificationStatus: true, isSuspended: true },
      });

      if (!driverProfile) {
        return res.status(403).json({ error: "Driver profile not found" });
      }

      const driverId = driverProfile.id;
      const isKycApproved = driverProfile.isVerified && driverProfile.verificationStatus === "approved";

      const [
        totalAchievements,
        unlockedAchievements,
        totalRewardsEarned,
        activeIncentives,
        completedIncentives,
      ] = await Promise.all([
        prisma.driverAchievement.count({ where: { driverId } }),
        prisma.driverAchievement.count({ where: { driverId, isUnlocked: true } }),
        prisma.driverRewardLedger.aggregate({
          where: { driverId, isPaid: true },
          _sum: { amount: true },
        }),
        prisma.driverIncentiveCycle.count({ where: { driverId, status: "ACTIVE" } }),
        prisma.driverIncentiveCycle.count({ where: { driverId, status: { in: ["COMPLETED", "BONUS_PAID"] } } }),
      ]);

      const driverPoints = await prisma.driverPoints.findUnique({
        where: { driverId },
        select: { totalPoints: true },
      });

      res.json({
        achievements: {
          unlocked: unlockedAchievements,
          total: Object.keys(ACHIEVEMENT_CONFIG).length,
        },
        incentives: {
          active: activeIncentives,
          completed: completedIncentives,
        },
        rewards: {
          totalEarned: isKycApproved ? serializeDecimal(totalRewardsEarned._sum.amount) : 0,
        },
        tier: {
          current: getDriverRewardTier(driverPoints?.totalPoints || 0),
          points: driverPoints?.totalPoints || 0,
        },
        kycApproved: isKycApproved,
      });
    } catch (error: any) {
      console.error("Error fetching incentive stats:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
