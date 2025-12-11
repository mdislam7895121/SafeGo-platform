/**
 * SafeGo Performance Scoring Automation Service
 * Automatic scoring for drivers and partners based on rating, delays, cancellations, fraud alerts
 */

import { prisma } from '../../db';
import { Prisma } from '@prisma/client';

export interface PerformanceMetrics {
  rating: number;
  ratingCount: number;
  completionRate: number;
  onTimeRate: number;
  cancellationRate: number;
  acceptanceRate: number;
  fraudAlertCount: number;
  complaintCount: number;
  totalTrips: number;
}

export interface PerformanceScore {
  partnerId: string;
  partnerType: 'driver' | 'restaurant' | 'shop' | 'ticket_operator' | 'rental_operator';
  overallScore: number;
  breakdown: ScoreBreakdown;
  tier: 'platinum' | 'gold' | 'silver' | 'bronze' | 'warning' | 'suspended';
  trend: 'improving' | 'stable' | 'declining';
  recommendations: string[];
  calculatedAt: Date;
}

export interface ScoreBreakdown {
  ratingScore: number;
  completionScore: number;
  onTimeScore: number;
  cancellationScore: number;
  acceptanceScore: number;
  safetyScore: number;
}

interface ScoringWeights {
  rating: number;
  completion: number;
  onTime: number;
  cancellation: number;
  acceptance: number;
  safety: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  rating: 0.30,
  completion: 0.20,
  onTime: 0.15,
  cancellation: 0.15,
  acceptance: 0.10,
  safety: 0.10,
};

const TIER_THRESHOLDS = {
  platinum: 90,
  gold: 75,
  silver: 60,
  bronze: 45,
  warning: 30,
};

export class PerformanceScoringService {
  private static instance: PerformanceScoringService;
  private weights: ScoringWeights;
  private isRunning: boolean;
  private scheduledJob: NodeJS.Timeout | null;

  private constructor() {
    this.weights = DEFAULT_WEIGHTS;
    this.isRunning = false;
    this.scheduledJob = null;
  }

  public static getInstance(): PerformanceScoringService {
    if (!PerformanceScoringService.instance) {
      PerformanceScoringService.instance = new PerformanceScoringService();
    }
    return PerformanceScoringService.instance;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    this.scheduledJob = setInterval(
      () => this.runDailyScoring(),
      24 * 60 * 60 * 1000
    );
    
    console.log('[PerformanceScoringService] Started - daily scoring enabled');
  }

  stop(): void {
    if (this.scheduledJob) {
      clearInterval(this.scheduledJob);
      this.scheduledJob = null;
    }
    this.isRunning = false;
    console.log('[PerformanceScoringService] Stopped');
  }

  async runDailyScoring(): Promise<void> {
    console.log('[PerformanceScoringService] Running daily scoring...');

    try {
      await this.scoreAllDrivers();
      await this.scoreAllRestaurants();
      await this.scoreAllShops();
    } catch (error) {
      console.error('[PerformanceScoringService] Daily scoring error:', error);
    }
  }

  private async scoreAllDrivers(): Promise<void> {
    const drivers = await prisma.driverProfile.findMany({
      where: {
        isVerified: true,
      },
      include: {
        driverStats: true,
      },
    });

    for (const driver of drivers) {
      try {
        await this.calculateDriverScore(driver.id);
      } catch (error) {
        console.error(`[PerformanceScoringService] Failed to score driver ${driver.id}:`, error);
      }
    }

    console.log(`[PerformanceScoringService] Scored ${drivers.length} drivers`);
  }

  private async scoreAllRestaurants(): Promise<void> {
    const restaurants = await prisma.restaurantProfile.findMany({
      where: {
        isVerified: true,
      },
    });

    for (const restaurant of restaurants) {
      try {
        await this.calculateRestaurantScore(restaurant.id);
      } catch (error) {
        console.error(`[PerformanceScoringService] Failed to score restaurant ${restaurant.id}:`, error);
      }
    }

    console.log(`[PerformanceScoringService] Scored ${restaurants.length} restaurants`);
  }

  private async scoreAllShops(): Promise<void> {
    const shops = await prisma.shopPartnerProfile.findMany({
      where: {
        isVerified: true,
      },
    });

    for (const shop of shops) {
      try {
        await this.calculateShopScore(shop.id);
      } catch (error) {
        console.error(`[PerformanceScoringService] Failed to score shop ${shop.id}:`, error);
      }
    }

    console.log(`[PerformanceScoringService] Scored ${shops.length} shops`);
  }

  async calculateDriverScore(driverId: string): Promise<PerformanceScore> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [stats, rides, complaints, fraudAlerts] = await Promise.all([
      prisma.driverStats.findUnique({
        where: { driverId },
      }),
      prisma.ride.findMany({
        where: {
          driverId,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.driverComplaint.count({
        where: {
          driverId,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.automationLog.count({
        where: {
          automationType: 'fraud_detection',
          entityId: driverId,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
    ]);

    const metrics = this.calculateDriverMetrics(rides, stats, complaints, fraudAlerts);
    const score = this.computeScore(metrics, 'driver');

    await this.saveScore(driverId, 'driver', score);
    await this.updateDriverTrustScore(driverId, score);

    return score;
  }

  async calculateRestaurantScore(restaurantId: string): Promise<PerformanceScore> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [restaurant, orders, complaints] = await Promise.all([
      prisma.restaurantProfile.findUnique({
        where: { id: restaurantId },
      }),
      prisma.foodOrder.findMany({
        where: {
          restaurantId,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.driverComplaint.count({
        where: {
          restaurantId,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
    ]);

    const metrics = this.calculateRestaurantMetrics(orders, restaurant, complaints);
    const score = this.computeScore(metrics, 'restaurant');

    await this.saveScore(restaurantId, 'restaurant', score);

    return score;
  }

  async calculateShopScore(shopId: string): Promise<PerformanceScore> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [shop, orders] = await Promise.all([
      prisma.shopPartnerProfile.findUnique({
        where: { id: shopId },
      }),
      prisma.productOrder.findMany({
        where: {
          shopPartnerId: shopId,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
    ]);

    const metrics = this.calculateShopMetrics(orders, shop);
    const score = this.computeScore(metrics, 'shop');

    await this.saveScore(shopId, 'shop', score);

    return score;
  }

  private calculateDriverMetrics(
    rides: any[],
    stats: any,
    complaints: number,
    fraudAlerts: number
  ): PerformanceMetrics {
    const completedRides = rides.filter(r => r.status === 'completed');
    const cancelledRides = rides.filter(r => r.status === 'cancelled' && r.cancelledBy === 'driver');
    const lateRides = rides.filter(r => {
      if (!r.driverArrivedAt || !r.requestedAt) return false;
      const waitTime = (new Date(r.driverArrivedAt).getTime() - new Date(r.requestedAt).getTime()) / 60000;
      return waitTime > 10;
    });

    return {
      rating: stats ? Number(stats.rating) : 5.0,
      ratingCount: stats?.totalRatingsReceived || 0,
      completionRate: rides.length > 0 ? completedRides.length / rides.length : 1.0,
      onTimeRate: rides.length > 0 ? (rides.length - lateRides.length) / rides.length : 1.0,
      cancellationRate: rides.length > 0 ? cancelledRides.length / rides.length : 0,
      acceptanceRate: stats ? 1 - Number(stats.cancellationRate) : 0.95,
      fraudAlertCount: fraudAlerts,
      complaintCount: complaints,
      totalTrips: completedRides.length,
    };
  }

  private calculateRestaurantMetrics(
    orders: any[],
    restaurant: any,
    complaints: number
  ): PerformanceMetrics {
    const completedOrders = orders.filter(o => o.status === 'delivered');
    const cancelledOrders = orders.filter(o => 
      o.status === 'cancelled' && o.whoCancelled === 'restaurant'
    );
    const lateOrders = orders.filter(o => {
      if (!o.pickedUpAt || !o.readyAt) return false;
      const waitTime = (new Date(o.pickedUpAt).getTime() - new Date(o.readyAt).getTime()) / 60000;
      return waitTime > 15;
    });

    return {
      rating: restaurant?.averageRating || 5.0,
      ratingCount: restaurant?.totalRatings || 0,
      completionRate: orders.length > 0 ? completedOrders.length / orders.length : 1.0,
      onTimeRate: orders.length > 0 ? (orders.length - lateOrders.length) / orders.length : 1.0,
      cancellationRate: orders.length > 0 ? cancelledOrders.length / orders.length : 0,
      acceptanceRate: 0.95,
      fraudAlertCount: 0,
      complaintCount: complaints,
      totalTrips: completedOrders.length,
    };
  }

  private calculateShopMetrics(orders: any[], shop: any): PerformanceMetrics {
    const completedOrders = orders.filter(o => o.status === 'delivered');
    const cancelledOrders = orders.filter(o => o.status === 'cancelled');

    return {
      rating: 4.5,
      ratingCount: 0,
      completionRate: orders.length > 0 ? completedOrders.length / orders.length : 1.0,
      onTimeRate: 0.95,
      cancellationRate: orders.length > 0 ? cancelledOrders.length / orders.length : 0,
      acceptanceRate: 0.95,
      fraudAlertCount: 0,
      complaintCount: 0,
      totalTrips: completedOrders.length,
    };
  }

  private computeScore(
    metrics: PerformanceMetrics,
    partnerType: string
  ): PerformanceScore {
    const breakdown: ScoreBreakdown = {
      ratingScore: (metrics.rating / 5) * 100,
      completionScore: metrics.completionRate * 100,
      onTimeScore: metrics.onTimeRate * 100,
      cancellationScore: (1 - metrics.cancellationRate) * 100,
      acceptanceScore: metrics.acceptanceRate * 100,
      safetyScore: Math.max(0, 100 - (metrics.fraudAlertCount * 20) - (metrics.complaintCount * 10)),
    };

    const overallScore = 
      breakdown.ratingScore * this.weights.rating +
      breakdown.completionScore * this.weights.completion +
      breakdown.onTimeScore * this.weights.onTime +
      breakdown.cancellationScore * this.weights.cancellation +
      breakdown.acceptanceScore * this.weights.acceptance +
      breakdown.safetyScore * this.weights.safety;

    const tier = this.determineTier(overallScore);
    const recommendations = this.generateRecommendations(metrics, breakdown);

    return {
      partnerId: '',
      partnerType: partnerType as any,
      overallScore: Math.round(overallScore * 10) / 10,
      breakdown,
      tier,
      trend: 'stable',
      recommendations,
      calculatedAt: new Date(),
    };
  }

  private determineTier(score: number): PerformanceScore['tier'] {
    if (score >= TIER_THRESHOLDS.platinum) return 'platinum';
    if (score >= TIER_THRESHOLDS.gold) return 'gold';
    if (score >= TIER_THRESHOLDS.silver) return 'silver';
    if (score >= TIER_THRESHOLDS.bronze) return 'bronze';
    if (score >= TIER_THRESHOLDS.warning) return 'warning';
    return 'suspended';
  }

  private generateRecommendations(
    metrics: PerformanceMetrics,
    breakdown: ScoreBreakdown
  ): string[] {
    const recommendations: string[] = [];

    if (breakdown.ratingScore < 80) {
      recommendations.push('Focus on customer service to improve your rating');
    }
    if (breakdown.onTimeScore < 85) {
      recommendations.push('Try to reduce wait times for customers');
    }
    if (breakdown.cancellationScore < 90) {
      recommendations.push('Avoid cancelling trips/orders when possible');
    }
    if (breakdown.acceptanceScore < 85) {
      recommendations.push('Accept more requests to improve your score');
    }
    if (breakdown.safetyScore < 80) {
      recommendations.push('Review safety guidelines and best practices');
    }

    return recommendations;
  }

  private async saveScore(
    partnerId: string,
    partnerType: string,
    score: PerformanceScore
  ): Promise<void> {
    score.partnerId = partnerId;

    try {
      await prisma.automationLog.create({
        data: {
          automationType: 'performance_scoring',
          entityType: partnerType,
          entityId: partnerId,
          status: score.tier,
          score: score.overallScore,
          metadata: {
            breakdown: score.breakdown,
            recommendations: score.recommendations,
            trend: score.trend,
          },
        },
      });
    } catch (error) {
      console.error('[PerformanceScoringService] Failed to save score:', error);
    }
  }

  private async updateDriverTrustScore(driverId: string, score: PerformanceScore): Promise<void> {
    try {
      await prisma.driverStats.upsert({
        where: { driverId },
        update: {
          trustScore: Math.round(score.overallScore),
          trustScoreBreakdown: score.breakdown as any,
          lastTrustScoreUpdate: new Date(),
        },
        create: {
          driverId,
          trustScore: Math.round(score.overallScore),
          trustScoreBreakdown: score.breakdown as any,
          lastTrustScoreUpdate: new Date(),
        },
      });
    } catch (error) {
      console.error('[PerformanceScoringService] Failed to update trust score:', error);
    }
  }

  async getPartnerScore(
    partnerId: string,
    partnerType: string
  ): Promise<PerformanceScore | null> {
    const log = await prisma.automationLog.findFirst({
      where: {
        automationType: 'performance_scoring',
        entityType: partnerType,
        entityId: partnerId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!log) return null;

    return {
      partnerId,
      partnerType: partnerType as any,
      overallScore: log.score || 0,
      breakdown: (log.metadata as any)?.breakdown || {},
      tier: log.status as any,
      trend: (log.metadata as any)?.trend || 'stable',
      recommendations: (log.metadata as any)?.recommendations || [],
      calculatedAt: log.createdAt,
    };
  }

  async getLeaderboard(
    partnerType: string,
    limit: number = 50
  ): Promise<any[]> {
    const logs = await prisma.automationLog.findMany({
      where: {
        automationType: 'performance_scoring',
        entityType: partnerType,
      },
      orderBy: { score: 'desc' },
      distinct: ['entityId'],
      take: limit,
    });

    return logs.map(log => ({
      partnerId: log.entityId,
      score: log.score,
      tier: log.status,
      calculatedAt: log.createdAt,
    }));
  }

  updateWeights(newWeights: Partial<ScoringWeights>): void {
    this.weights = { ...this.weights, ...newWeights };
  }

  getWeights(): ScoringWeights {
    return { ...this.weights };
  }
}

export const performanceScoringService = PerformanceScoringService.getInstance();
