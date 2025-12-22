import { prisma } from '../../db';

interface DemandZone {
  area: string;
  lat: number;
  lng: number;
  demandScore: number;
  serviceType: 'RIDE' | 'FOOD' | 'PARCEL';
  trend: 'RISING' | 'STABLE' | 'DECLINING';
  peakHours: string[];
  estimatedDailyOrders: number;
}

interface SupplyGap {
  area: string;
  serviceType: 'RIDE' | 'FOOD' | 'PARCEL';
  currentSupply: number;
  requiredSupply: number;
  gapPercentage: number;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  recommendation: string;
}

interface OnboardingRecommendation {
  partnerType: 'DRIVER' | 'RESTAURANT' | 'COURIER' | 'SHOP_PARTNER';
  area: string;
  priority: number;
  estimatedRevenue: number;
  suggestedIncentive: string;
  marketingMessage: string;
  targetCount: number;
}

interface GrowthForecast {
  period: '7_DAYS' | '30_DAYS';
  zones: Array<{
    area: string;
    predictedGrowth: number;
    confidence: number;
    factors: string[];
  }>;
}

interface SurgePricingRecommendation {
  area: string;
  currentMultiplier: number;
  recommendedMultiplier: number;
  reason: string;
  estimatedRevenueImpact: number;
  timeWindow: string;
}

export const growthEngine = {
  /**
   * Detect demand by area and service type
   */
  async detectDemandZones(countryCode?: string, days: number = 7): Promise<DemandZone[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    // Memory-optimized: limit queries to reduce memory footprint
    const [rides, foodOrders, parcels] = await Promise.all([
      prisma.ride.findMany({
        where: {
          createdAt: { gte: since },
          status: 'completed',
          ...(countryCode ? { customer: { user: { countryCode } } } : {}),
        },
        select: {
          pickupLat: true,
          pickupLng: true,
          createdAt: true,
        },
        take: 1000, // Limit for memory optimization
      }),
      prisma.foodOrder.findMany({
        where: {
          createdAt: { gte: since },
          status: 'delivered',
          ...(countryCode ? { customer: { user: { countryCode } } } : {}),
        },
        select: {
          deliveryLat: true,
          deliveryLng: true,
          createdAt: true,
        },
        take: 1000, // Limit for memory optimization
      }),
      prisma.parcelDelivery.findMany({
        where: {
          createdAt: { gte: since },
          status: 'delivered',
          ...(countryCode ? { sender: { user: { countryCode } } } : {}),
        },
        select: {
          pickupLat: true,
          pickupLng: true,
          createdAt: true,
        },
        take: 500, // Limit for memory optimization
      }),
    ]);

    const demandZones: DemandZone[] = [];

    const gridSize = 0.01;
    const rideGrid = this.aggregateToGrid(
      rides.map(r => ({ lat: r.pickupLat?.toNumber() || 0, lng: r.pickupLng?.toNumber() || 0, time: r.createdAt })),
      gridSize
    );

    for (const [key, data] of Object.entries(rideGrid)) {
      const [lat, lng] = key.split(',').map(Number);
      const count = data.count;
      
      if (count >= 5) {
        demandZones.push({
          area: `Zone ${lat.toFixed(2)}, ${lng.toFixed(2)}`,
          lat,
          lng,
          demandScore: Math.min(100, count * 2),
          serviceType: 'RIDE',
          trend: this.calculateTrend(data.timestamps, days),
          peakHours: this.findPeakHours(data.timestamps),
          estimatedDailyOrders: Math.round(count / days),
        });
      }
    }

    const foodGrid = this.aggregateToGrid(
      foodOrders.map(o => ({ lat: o.deliveryLat?.toNumber() || 0, lng: o.deliveryLng?.toNumber() || 0, time: o.createdAt })),
      gridSize
    );

    for (const [key, data] of Object.entries(foodGrid)) {
      const [lat, lng] = key.split(',').map(Number);
      const count = data.count;
      
      if (count >= 3) {
        demandZones.push({
          area: `Zone ${lat.toFixed(2)}, ${lng.toFixed(2)}`,
          lat,
          lng,
          demandScore: Math.min(100, count * 3),
          serviceType: 'FOOD',
          trend: this.calculateTrend(data.timestamps, days),
          peakHours: this.findPeakHours(data.timestamps),
          estimatedDailyOrders: Math.round(count / days),
        });
      }
    }

    return demandZones.sort((a, b) => b.demandScore - a.demandScore).slice(0, 20);
  },

  /**
   * Detect supply gaps (driver/restaurant shortages)
   */
  async detectSupplyGaps(countryCode?: string): Promise<SupplyGap[]> {
    const gaps: SupplyGap[] = [];
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      totalDrivers,
      onlineDrivers,
      completedRides,
      cancelledDueToNoDriver,
    ] = await Promise.all([
      prisma.driverProfile.count({
        where: countryCode ? { user: { countryCode } } : {},
      }),
      prisma.driverProfile.count({
        where: {
          isOnline: true,
          ...(countryCode ? { user: { countryCode } } : {}),
        },
      }),
      prisma.ride.count({
        where: {
          createdAt: { gte: last24h },
          status: 'completed',
        },
      }),
      prisma.ride.count({
        where: {
          createdAt: { gte: last24h },
          status: 'cancelled_no_driver',
        },
      }),
    ]);

    const driverUtilization = totalDrivers > 0 ? (completedRides / (onlineDrivers || 1)) : 0;
    const cancellationRate = (completedRides + cancelledDueToNoDriver) > 0 
      ? cancelledDueToNoDriver / (completedRides + cancelledDueToNoDriver) 
      : 0;

    if (cancellationRate > 0.1 || onlineDrivers < totalDrivers * 0.2) {
      gaps.push({
        area: countryCode || 'All Regions',
        serviceType: 'RIDE',
        currentSupply: onlineDrivers,
        requiredSupply: Math.ceil(onlineDrivers * 1.5),
        gapPercentage: Math.round(cancellationRate * 100),
        priority: cancellationRate > 0.2 ? 'CRITICAL' : cancellationRate > 0.1 ? 'HIGH' : 'MEDIUM',
        recommendation: `Need ${Math.ceil(onlineDrivers * 0.5)} more active drivers to meet demand`,
      });
    }

    const [
      totalRestaurants,
      activeRestaurants,
      avgOrdersPerRestaurant,
    ] = await Promise.all([
      prisma.restaurantProfile.count({
        where: countryCode ? { user: { countryCode } } : {},
      }),
      prisma.restaurantProfile.count({
        where: {
          isOpen: true,
          ...(countryCode ? { user: { countryCode } } : {}),
        },
      }),
      prisma.foodOrder.count({
        where: { createdAt: { gte: last24h }, status: 'delivered' },
      }).then(count => activeRestaurants > 0 ? count / activeRestaurants : 0),
    ]);

    if (activeRestaurants < totalRestaurants * 0.5) {
      gaps.push({
        area: countryCode || 'All Regions',
        serviceType: 'FOOD',
        currentSupply: activeRestaurants,
        requiredSupply: totalRestaurants,
        gapPercentage: Math.round((1 - activeRestaurants / totalRestaurants) * 100),
        priority: 'MEDIUM',
        recommendation: `${totalRestaurants - activeRestaurants} restaurants are currently offline`,
      });
    }

    return gaps;
  },

  /**
   * Recommend partner onboarding areas
   */
  async recommendOnboardingAreas(countryCode?: string): Promise<OnboardingRecommendation[]> {
    const recommendations: OnboardingRecommendation[] = [];
    
    const gaps = await this.detectSupplyGaps(countryCode);
    const demandZones = await this.detectDemandZones(countryCode, 14);

    for (const gap of gaps) {
      if (gap.priority === 'CRITICAL' || gap.priority === 'HIGH') {
        if (gap.serviceType === 'RIDE') {
          recommendations.push({
            partnerType: 'DRIVER',
            area: gap.area,
            priority: gap.priority === 'CRITICAL' ? 100 : 80,
            estimatedRevenue: gap.requiredSupply * 50 * 30,
            suggestedIncentive: gap.priority === 'CRITICAL' 
              ? 'Offer $100 signup bonus + first week guaranteed earnings'
              : 'Offer $50 signup bonus',
            marketingMessage: `Earn up to $200/day driving with SafeGo in ${gap.area}. Join now and get a signup bonus!`,
            targetCount: gap.requiredSupply - gap.currentSupply,
          });
        } else if (gap.serviceType === 'FOOD') {
          recommendations.push({
            partnerType: 'RESTAURANT',
            area: gap.area,
            priority: gap.priority === 'CRITICAL' ? 90 : 70,
            estimatedRevenue: gap.requiredSupply * 200 * 30,
            suggestedIncentive: '0% commission for first month',
            marketingMessage: `Grow your restaurant business with SafeGo! Free delivery for the first month.`,
            targetCount: gap.requiredSupply - gap.currentSupply,
          });
        }
      }
    }

    for (const zone of demandZones.slice(0, 5)) {
      if (zone.demandScore > 70) {
        const partnerType = zone.serviceType === 'RIDE' ? 'DRIVER' : 
                           zone.serviceType === 'FOOD' ? 'RESTAURANT' : 'COURIER';
        
        if (!recommendations.some(r => r.area === zone.area && r.partnerType === partnerType)) {
          recommendations.push({
            partnerType,
            area: zone.area,
            priority: zone.demandScore,
            estimatedRevenue: zone.estimatedDailyOrders * 15 * 30,
            suggestedIncentive: 'Standard signup incentives',
            marketingMessage: `High demand area! Join SafeGo as a ${partnerType.toLowerCase()} in ${zone.area}.`,
            targetCount: Math.ceil(zone.estimatedDailyOrders / 5),
          });
        }
      }
    }

    return recommendations.sort((a, b) => b.priority - a.priority);
  },

  /**
   * Predict demand for next 7/30 days
   */
  async forecastGrowth(period: '7_DAYS' | '30_DAYS', countryCode?: string): Promise<GrowthForecast> {
    const historicalDays = period === '7_DAYS' ? 14 : 60;
    const demandZones = await this.detectDemandZones(countryCode, historicalDays);

    const zones = demandZones.slice(0, 10).map(zone => {
      let predictedGrowth = 0;
      const factors: string[] = [];

      if (zone.trend === 'RISING') {
        predictedGrowth = 15 + Math.random() * 10;
        factors.push('Upward demand trend');
      } else if (zone.trend === 'STABLE') {
        predictedGrowth = 5 + Math.random() * 5;
        factors.push('Consistent demand');
      } else {
        predictedGrowth = -5 + Math.random() * 10;
        factors.push('Declining trend - needs attention');
      }

      if (zone.demandScore > 80) {
        predictedGrowth += 5;
        factors.push('High demand area');
      }

      if (zone.peakHours.length > 4) {
        predictedGrowth += 3;
        factors.push('Extended peak hours');
      }

      return {
        area: zone.area,
        predictedGrowth: Math.round(predictedGrowth * 10) / 10,
        confidence: Math.min(95, 70 + zone.demandScore / 5),
        factors,
      };
    });

    return { period, zones };
  },

  /**
   * Recommend surge pricing adjustments
   */
  async recommendSurgePricing(countryCode?: string): Promise<SurgePricingRecommendation[]> {
    const recommendations: SurgePricingRecommendation[] = [];
    const now = new Date();
    const currentHour = now.getHours();

    const demandZones = await this.detectDemandZones(countryCode, 1);
    const gaps = await this.detectSupplyGaps(countryCode);

    for (const zone of demandZones) {
      if (zone.demandScore > 80 && zone.peakHours.includes(currentHour.toString())) {
        const gap = gaps.find(g => g.serviceType === zone.serviceType);
        const demandSupplyRatio = gap ? gap.requiredSupply / (gap.currentSupply || 1) : 1;
        
        const recommendedMultiplier = Math.min(2.5, 1 + (demandSupplyRatio - 1) * 0.5 + (zone.demandScore - 80) / 50);

        if (recommendedMultiplier > 1.1) {
          recommendations.push({
            area: zone.area,
            currentMultiplier: 1.0,
            recommendedMultiplier: Math.round(recommendedMultiplier * 10) / 10,
            reason: `High demand (${zone.demandScore}/100) with ${gap?.gapPercentage || 0}% supply gap`,
            estimatedRevenueImpact: zone.estimatedDailyOrders * 5 * (recommendedMultiplier - 1),
            timeWindow: `${currentHour}:00 - ${(currentHour + 2) % 24}:00`,
          });
        }
      }
    }

    return recommendations.sort((a, b) => b.recommendedMultiplier - a.recommendedMultiplier);
  },

  /**
   * Get dashboard data for Vision 2030 module endpoint
   */
  async getDashboard(countryCode?: string): Promise<{
    demandForecast: Array<{ area: string; demandLevel: 'HIGH' | 'MEDIUM' | 'LOW'; demandScore: number }>;
    supplyGaps: Array<{ area: string; priority: string }>;
    onboardingPipeline: Array<{ area: string; partnerType: string }>;
    surgeRecommendations: Array<{ area: string; recommendedMultiplier: number }>;
  }> {
    const [demandZones, gaps, onboarding, surge] = await Promise.all([
      this.detectDemandZones(countryCode),
      this.detectSupplyGaps(countryCode),
      this.recommendOnboardingAreas(countryCode),
      this.recommendSurgePricing(countryCode),
    ]);

    return {
      demandForecast: demandZones.map(z => ({
        area: z.area,
        demandLevel: z.demandScore > 70 ? 'HIGH' as const : z.demandScore > 40 ? 'MEDIUM' as const : 'LOW' as const,
        demandScore: z.demandScore,
      })),
      supplyGaps: gaps.map(g => ({ area: g.area, priority: g.priority })),
      onboardingPipeline: onboarding.map(o => ({ area: o.area, partnerType: o.partnerType })),
      surgeRecommendations: surge.map(s => ({ area: s.area, recommendedMultiplier: s.recommendedMultiplier })),
    };
  },

  /**
   * Get growth summary for dashboard
   */
  async getGrowthSummary(countryCode?: string): Promise<{
    totalDemandZones: number;
    highDemandZones: number;
    supplyGaps: number;
    criticalGaps: number;
    onboardingOpportunities: number;
    surgeRecommendations: number;
    forecastTrend: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  }> {
    const [demandZones, gaps, onboarding, surge, forecast] = await Promise.all([
      this.detectDemandZones(countryCode),
      this.detectSupplyGaps(countryCode),
      this.recommendOnboardingAreas(countryCode),
      this.recommendSurgePricing(countryCode),
      this.forecastGrowth('7_DAYS', countryCode),
    ]);

    const avgGrowth = forecast.zones.length > 0 
      ? forecast.zones.reduce((sum, z) => sum + z.predictedGrowth, 0) / forecast.zones.length 
      : 0;

    return {
      totalDemandZones: demandZones.length,
      highDemandZones: demandZones.filter(z => z.demandScore > 70).length,
      supplyGaps: gaps.length,
      criticalGaps: gaps.filter(g => g.priority === 'CRITICAL').length,
      onboardingOpportunities: onboarding.length,
      surgeRecommendations: surge.length,
      forecastTrend: avgGrowth > 10 ? 'POSITIVE' : avgGrowth > 0 ? 'NEUTRAL' : 'NEGATIVE',
    };
  },

  aggregateToGrid(
    points: Array<{ lat: number; lng: number; time: Date }>,
    gridSize: number
  ): Record<string, { count: number; timestamps: Date[] }> {
    const grid: Record<string, { count: number; timestamps: Date[] }> = {};

    for (const point of points) {
      if (point.lat === 0 && point.lng === 0) continue;
      
      const gridLat = Math.floor(point.lat / gridSize) * gridSize;
      const gridLng = Math.floor(point.lng / gridSize) * gridSize;
      const key = `${gridLat},${gridLng}`;

      if (!grid[key]) {
        grid[key] = { count: 0, timestamps: [] };
      }
      grid[key].count++;
      grid[key].timestamps.push(point.time);
    }

    return grid;
  },

  calculateTrend(timestamps: Date[], totalDays: number): 'RISING' | 'STABLE' | 'DECLINING' {
    if (timestamps.length < 5) return 'STABLE';

    const midpoint = new Date(Date.now() - (totalDays / 2) * 24 * 60 * 60 * 1000);
    const firstHalf = timestamps.filter(t => t < midpoint).length;
    const secondHalf = timestamps.filter(t => t >= midpoint).length;

    const growthRate = firstHalf > 0 ? (secondHalf - firstHalf) / firstHalf : 0;

    if (growthRate > 0.2) return 'RISING';
    if (growthRate < -0.2) return 'DECLINING';
    return 'STABLE';
  },

  findPeakHours(timestamps: Date[]): string[] {
    const hourCounts: Record<number, number> = {};
    
    for (const ts of timestamps) {
      const hour = ts.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }

    const sorted = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return sorted.map(([hour]) => hour);
  },
};
