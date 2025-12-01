import { prisma } from '../prisma';
import type { IncentiveRecommendation, DriverEngagementMetric } from '@prisma/client';

interface DriverPerformanceData {
  driverId: string;
  tripsCompleted: number;
  avgRating: number;
  onTimeRate: number;
  acceptanceRate: number;
  hoursOnline: number;
  peakHoursWorked: number;
  grossEarnings: number;
}

interface DemandForecast {
  countryCode: string;
  cityCode?: string;
  zoneId?: string;
  expectedDemand: number;
  expectedSupply: number;
  demandSupplyRatio: number;
  timestamp: Date;
}

interface IncentiveRecommendationCreate {
  countryCode: string;
  cityCode?: string;
  zoneId?: string;
  type: 'surge_pricing' | 'bonus_tier' | 'target_zone' | 'peak_hour_bonus' | 'completion_bonus' | 'rating_bonus';
  title: string;
  description: string;
  suggestedMultiplier?: number;
  suggestedAmount?: number;
  suggestedStartTime?: Date;
  suggestedEndTime?: Date;
  demandForecast?: number;
  supplyForecast?: number;
  confidenceScore?: number;
}

class IncentiveEngine {
  async analyzeDriverPerformance(driverId: string, days: number = 7): Promise<DriverPerformanceData | null> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    
    const metrics = await prisma.driverEngagementMetric.findMany({
      where: {
        driverId,
        date: { gte: fromDate },
      },
      orderBy: { date: 'desc' },
    });
    
    if (metrics.length === 0) {
      return null;
    }
    
    const totalTrips = metrics.reduce((sum, m) => sum + m.tripsCompleted, 0);
    const avgRating = metrics.reduce((sum, m) => sum + Number(m.avgRating || 0), 0) / metrics.length;
    const avgOnTimeRate = metrics.reduce((sum, m) => sum + Number(m.onTimePickupRate || 0), 0) / metrics.length;
    const avgAcceptanceRate = metrics.reduce((sum, m) => sum + Number(m.acceptanceRate || 0), 0) / metrics.length;
    const totalHours = metrics.reduce((sum, m) => sum + Number(m.hoursOnline), 0);
    const totalPeakHours = metrics.reduce((sum, m) => sum + Number(m.peakHoursWorked), 0);
    const totalEarnings = metrics.reduce((sum, m) => sum + Number(m.grossEarnings), 0);
    
    return {
      driverId,
      tripsCompleted: totalTrips,
      avgRating: Math.round(avgRating * 100) / 100,
      onTimeRate: Math.round(avgOnTimeRate * 100) / 100,
      acceptanceRate: Math.round(avgAcceptanceRate * 100) / 100,
      hoursOnline: Math.round(totalHours * 100) / 100,
      peakHoursWorked: Math.round(totalPeakHours * 100) / 100,
      grossEarnings: Math.round(totalEarnings * 100) / 100,
    };
  }
  
  async recordDailyMetrics(
    driverId: string,
    date: Date,
    metrics: Partial<DriverEngagementMetric>
  ): Promise<DriverEngagementMetric> {
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    
    return prisma.driverEngagementMetric.upsert({
      where: {
        driverId_date: { driverId, date: dateOnly },
      },
      create: {
        driverId,
        date: dateOnly,
        tripsCompleted: metrics.tripsCompleted || 0,
        tripsCancelled: metrics.tripsCancelled || 0,
        hoursOnline: metrics.hoursOnline || 0,
        avgRating: metrics.avgRating,
        onTimePickupRate: metrics.onTimePickupRate,
        acceptanceRate: metrics.acceptanceRate,
        grossEarnings: metrics.grossEarnings || 0,
        bonusEarnings: metrics.bonusEarnings || 0,
        tipsEarnings: metrics.tipsEarnings || 0,
        peakHoursWorked: metrics.peakHoursWorked || 0,
        targetZoneTrips: metrics.targetZoneTrips || 0,
      },
      update: {
        tripsCompleted: metrics.tripsCompleted !== undefined ? { increment: metrics.tripsCompleted } : undefined,
        tripsCancelled: metrics.tripsCancelled !== undefined ? { increment: metrics.tripsCancelled } : undefined,
        hoursOnline: metrics.hoursOnline !== undefined ? { increment: metrics.hoursOnline } : undefined,
        grossEarnings: metrics.grossEarnings !== undefined ? { increment: metrics.grossEarnings } : undefined,
        bonusEarnings: metrics.bonusEarnings !== undefined ? { increment: metrics.bonusEarnings } : undefined,
        tipsEarnings: metrics.tipsEarnings !== undefined ? { increment: metrics.tipsEarnings } : undefined,
        peakHoursWorked: metrics.peakHoursWorked !== undefined ? { increment: metrics.peakHoursWorked } : undefined,
        targetZoneTrips: metrics.targetZoneTrips !== undefined ? { increment: metrics.targetZoneTrips } : undefined,
      },
    });
  }
  
  async predictDemand(
    countryCode: string,
    cityCode?: string,
    zoneId?: string
  ): Promise<DemandForecast> {
    const now = new Date();
    const hourOfDay = now.getHours();
    const dayOfWeek = now.getDay();
    
    let baseDemand = 50;
    
    if ((hourOfDay >= 7 && hourOfDay <= 9) || (hourOfDay >= 17 && hourOfDay <= 19)) {
      baseDemand *= 1.8;
    } else if (hourOfDay >= 22 || hourOfDay <= 5) {
      baseDemand *= 0.5;
    } else if (hourOfDay >= 11 && hourOfDay <= 14) {
      baseDemand *= 1.3;
    }
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      baseDemand *= 0.8;
    }
    if (dayOfWeek === 5) {
      baseDemand *= 1.2;
    }
    
    const expectedDemand = Math.round(baseDemand + Math.random() * 20);
    const expectedSupply = Math.round(baseDemand * 0.7 + Math.random() * 15);
    
    return {
      countryCode,
      cityCode,
      zoneId,
      expectedDemand,
      expectedSupply,
      demandSupplyRatio: Math.round((expectedDemand / Math.max(expectedSupply, 1)) * 100) / 100,
      timestamp: now,
    };
  }
  
  async generateRecommendations(countryCode: string, cityCode?: string): Promise<IncentiveRecommendation[]> {
    const forecast = await this.predictDemand(countryCode, cityCode);
    const recommendations: IncentiveRecommendationCreate[] = [];
    
    if (forecast.demandSupplyRatio > 1.5) {
      const multiplier = Math.min(2.5, 1 + (forecast.demandSupplyRatio - 1) * 0.5);
      
      recommendations.push({
        countryCode,
        cityCode,
        type: 'surge_pricing',
        title: 'High Demand Surge',
        description: `Demand is ${Math.round(forecast.demandSupplyRatio * 100)}% of supply. Recommend surge pricing to attract more drivers.`,
        suggestedMultiplier: Math.round(multiplier * 100) / 100,
        suggestedStartTime: new Date(),
        suggestedEndTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        demandForecast: forecast.expectedDemand,
        supplyForecast: forecast.expectedSupply,
        confidenceScore: 75,
      });
    }
    
    const now = new Date();
    const hourOfDay = now.getHours();
    
    if ((hourOfDay >= 6 && hourOfDay <= 8) || (hourOfDay >= 16 && hourOfDay <= 18)) {
      recommendations.push({
        countryCode,
        cityCode,
        type: 'peak_hour_bonus',
        title: 'Peak Hour Bonus',
        description: 'Offer bonus for drivers completing trips during rush hour.',
        suggestedAmount: 50,
        suggestedStartTime: new Date(),
        suggestedEndTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
        confidenceScore: 80,
      });
    }
    
    recommendations.push({
      countryCode,
      cityCode,
      type: 'completion_bonus',
      title: 'Daily Completion Target',
      description: 'Reward drivers who complete 10+ trips today with a bonus.',
      suggestedAmount: 200,
      confidenceScore: 85,
    });
    
    const createdRecommendations: IncentiveRecommendation[] = [];
    
    for (const rec of recommendations) {
      const existing = await prisma.incentiveRecommendation.findFirst({
        where: {
          countryCode: rec.countryCode,
          cityCode: rec.cityCode || null,
          type: rec.type as any,
          status: { in: ['pending', 'approved'] },
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });
      
      if (!existing) {
        const created = await prisma.incentiveRecommendation.create({
          data: {
            countryCode: rec.countryCode,
            cityCode: rec.cityCode,
            type: rec.type as any,
            status: 'pending',
            title: rec.title,
            description: rec.description,
            suggestedMultiplier: rec.suggestedMultiplier,
            suggestedAmount: rec.suggestedAmount,
            suggestedStartTime: rec.suggestedStartTime,
            suggestedEndTime: rec.suggestedEndTime,
            demandForecast: rec.demandForecast,
            supplyForecast: rec.supplyForecast,
            confidenceScore: rec.confidenceScore,
            modelVersion: '1.0.0',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
        createdRecommendations.push(created);
      }
    }
    
    return createdRecommendations;
  }
  
  async getPendingRecommendations(
    countryCode?: string,
    limit: number = 20
  ): Promise<IncentiveRecommendation[]> {
    return prisma.incentiveRecommendation.findMany({
      where: {
        status: 'pending',
        ...(countryCode ? { countryCode } : {}),
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: [
        { confidenceScore: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });
  }
  
  async approveRecommendation(
    recommendationId: string,
    adminId: string,
    notes?: string
  ): Promise<IncentiveRecommendation | null> {
    const recommendation = await prisma.incentiveRecommendation.findUnique({
      where: { id: recommendationId },
    });
    
    if (!recommendation || recommendation.status !== 'pending') {
      return null;
    }
    
    return prisma.incentiveRecommendation.update({
      where: { id: recommendationId },
      data: {
        status: 'approved',
        reviewedByAdminId: adminId,
        reviewedAt: new Date(),
        adminNotes: notes,
      },
    });
  }
  
  async activateRecommendation(
    recommendationId: string,
    adminId: string
  ): Promise<IncentiveRecommendation | null> {
    const recommendation = await prisma.incentiveRecommendation.findUnique({
      where: { id: recommendationId },
    });
    
    if (!recommendation || !['pending', 'approved'].includes(recommendation.status)) {
      return null;
    }
    
    return prisma.incentiveRecommendation.update({
      where: { id: recommendationId },
      data: {
        status: 'activated',
        activatedAt: new Date(),
        activatedByAdminId: adminId,
      },
    });
  }
  
  async rejectRecommendation(
    recommendationId: string,
    adminId: string,
    reason: string
  ): Promise<IncentiveRecommendation | null> {
    return prisma.incentiveRecommendation.update({
      where: { id: recommendationId },
      data: {
        status: 'rejected',
        reviewedByAdminId: adminId,
        reviewedAt: new Date(),
        adminNotes: reason,
      },
    });
  }
  
  async getRecommendationStats(
    countryCode: string,
    days: number = 30
  ): Promise<{
    total: number;
    pending: number;
    approved: number;
    activated: number;
    rejected: number;
    avgConfidenceScore: number;
  }> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    
    const recommendations = await prisma.incentiveRecommendation.findMany({
      where: {
        countryCode,
        createdAt: { gte: fromDate },
      },
    });
    
    const total = recommendations.length;
    const pending = recommendations.filter(r => r.status === 'pending').length;
    const approved = recommendations.filter(r => r.status === 'approved').length;
    const activated = recommendations.filter(r => r.status === 'activated').length;
    const rejected = recommendations.filter(r => r.status === 'rejected').length;
    
    const avgConfidenceScore = total > 0
      ? recommendations.reduce((sum, r) => sum + Number(r.confidenceScore || 0), 0) / total
      : 0;
    
    return {
      total,
      pending,
      approved,
      activated,
      rejected,
      avgConfidenceScore: Math.round(avgConfidenceScore * 100) / 100,
    };
  }
  
  async getTopPerformingDrivers(
    countryCode: string,
    limit: number = 10,
    days: number = 7
  ): Promise<DriverPerformanceData[]> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    
    const metrics = await prisma.driverEngagementMetric.groupBy({
      by: ['driverId'],
      where: {
        date: { gte: fromDate },
      },
      _sum: {
        tripsCompleted: true,
        grossEarnings: true,
        hoursOnline: true,
        peakHoursWorked: true,
      },
      _avg: {
        avgRating: true,
        onTimePickupRate: true,
        acceptanceRate: true,
      },
      orderBy: {
        _sum: {
          tripsCompleted: 'desc',
        },
      },
      take: limit,
    });
    
    return metrics.map(m => ({
      driverId: m.driverId,
      tripsCompleted: m._sum.tripsCompleted || 0,
      avgRating: Math.round((m._avg.avgRating || 0) * 100) / 100,
      onTimeRate: Math.round((m._avg.onTimePickupRate || 0) * 100) / 100,
      acceptanceRate: Math.round((m._avg.acceptanceRate || 0) * 100) / 100,
      hoursOnline: Math.round((Number(m._sum.hoursOnline) || 0) * 100) / 100,
      peakHoursWorked: Math.round((Number(m._sum.peakHoursWorked) || 0) * 100) / 100,
      grossEarnings: Math.round((Number(m._sum.grossEarnings) || 0) * 100) / 100,
    }));
  }
}

export const incentiveEngine = new IncentiveEngine();
