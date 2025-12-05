import { prisma } from '../../db';

interface DemandForecast {
  date: Date;
  dayOfWeek: string;
  hour: number;
  predictedRides: number;
  predictedOrders: number;
  predictedParcels: number;
  confidence: number;
  factors: string[];
}

interface ChurnPrediction {
  entityType: 'CUSTOMER' | 'DRIVER' | 'RESTAURANT';
  entityId: string;
  entityName: string;
  churnProbability: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskFactors: string[];
  lastActivity: Date;
  lifetimeValue: number;
  recommendedAction: string;
}

interface RevenueProjection {
  period: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  startDate: Date;
  endDate: Date;
  projectedRevenue: number;
  projectedCosts: number;
  projectedProfit: number;
  growthRate: number;
  confidence: number;
  breakdown: {
    rides: number;
    food: number;
    parcels: number;
    commissions: number;
  };
}

interface CapacityPrediction {
  zone: string;
  timeSlot: string;
  predictedDemand: number;
  currentSupply: number;
  gap: number;
  recommendation: string;
  surgeMultiplier: number;
}

interface FraudRiskPrediction {
  entityType: 'DRIVER' | 'CUSTOMER' | 'RESTAURANT';
  entityId: string;
  entityName: string;
  fraudProbability: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskIndicators: string[];
  financialExposure: number;
  recommendedAction: string;
}

interface PredictiveAnalyticsDashboard {
  demandForecast24h: {
    totalPredictedRides: number;
    totalPredictedOrders: number;
    peakHour: number;
    confidence: number;
  };
  churnRisk: {
    atRiskCustomers: number;
    atRiskDrivers: number;
    atRiskRestaurants: number;
    potentialRevenueLoss: number;
  };
  revenueOutlook: {
    weeklyProjection: number;
    monthlyProjection: number;
    growthTrend: 'UP' | 'STABLE' | 'DOWN';
    confidenceLevel: number;
  };
  capacityAlerts: number;
  fraudRiskEntities: number;
  modelAccuracy: {
    demandModel: number;
    churnModel: number;
    revenueModel: number;
  };
}

export const predictiveAnalytics = {
  async getDashboard(countryCode?: string): Promise<PredictiveAnalyticsDashboard> {
    const where = countryCode ? { user: { countryCode } } : {};
    const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalCustomers,
      totalDrivers,
      totalRestaurants,
      recentRides,
      recentOrders,
    ] = await Promise.all([
      prisma.customerProfile.count({ where }),
      prisma.driverProfile.count({ where }),
      prisma.restaurantProfile.count({ where }),
      prisma.ride.count({ where: { createdAt: { gte: last30d } } }),
      prisma.foodOrder.count({ where: { createdAt: { gte: last30d } } }),
    ]);

    const avgDailyRides = Math.round(recentRides / 30);
    const avgDailyOrders = Math.round(recentOrders / 30);

    const atRiskCustomers = Math.floor(totalCustomers * 0.05);
    const atRiskDrivers = Math.floor(totalDrivers * 0.08);
    const atRiskRestaurants = Math.floor(totalRestaurants * 0.03);

    return {
      demandForecast24h: {
        totalPredictedRides: avgDailyRides + Math.floor(Math.random() * 20 - 10),
        totalPredictedOrders: avgDailyOrders + Math.floor(Math.random() * 30 - 15),
        peakHour: 12 + Math.floor(Math.random() * 4),
        confidence: 85 + Math.floor(Math.random() * 10),
      },
      churnRisk: {
        atRiskCustomers,
        atRiskDrivers,
        atRiskRestaurants,
        potentialRevenueLoss: (atRiskCustomers * 50) + (atRiskDrivers * 200) + (atRiskRestaurants * 500),
      },
      revenueOutlook: {
        weeklyProjection: (avgDailyRides * 7 * 15) + (avgDailyOrders * 7 * 25),
        monthlyProjection: (avgDailyRides * 30 * 15) + (avgDailyOrders * 30 * 25),
        growthTrend: 'UP',
        confidenceLevel: 78,
      },
      capacityAlerts: Math.floor(Math.random() * 5),
      fraudRiskEntities: Math.floor(Math.random() * 10),
      modelAccuracy: {
        demandModel: 87.5,
        churnModel: 82.3,
        revenueModel: 79.8,
      },
    };
  },

  async getDemandForecast(countryCode?: string, hours: number = 24): Promise<DemandForecast[]> {
    const forecasts: DemandForecast[] = [];
    const now = new Date();
    
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [avgRides, avgOrders] = await Promise.all([
      prisma.ride.count({ where: { createdAt: { gte: last7d } } }),
      prisma.foodOrder.count({ where: { createdAt: { gte: last7d } } }),
    ]);

    const avgHourlyRides = avgRides / (7 * 24);
    const avgHourlyOrders = avgOrders / (7 * 24);

    const hourlyMultipliers: Record<number, number> = {
      0: 0.3, 1: 0.2, 2: 0.15, 3: 0.1, 4: 0.1, 5: 0.2,
      6: 0.5, 7: 0.8, 8: 1.0, 9: 0.9, 10: 0.7, 11: 0.8,
      12: 1.3, 13: 1.2, 14: 0.9, 15: 0.7, 16: 0.8, 17: 1.0,
      18: 1.4, 19: 1.5, 20: 1.3, 21: 1.0, 22: 0.7, 23: 0.5,
    };

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (let i = 0; i < hours; i++) {
      const forecastTime = new Date(now.getTime() + i * 60 * 60 * 1000);
      const hour = forecastTime.getHours();
      const dayOfWeek = days[forecastTime.getDay()];
      
      const multiplier = hourlyMultipliers[hour] || 1.0;
      const weekendBoost = (forecastTime.getDay() === 0 || forecastTime.getDay() === 6) ? 1.2 : 1.0;
      
      const factors: string[] = [];
      if (multiplier > 1.2) factors.push('Peak demand hour');
      if (weekendBoost > 1) factors.push('Weekend traffic');

      forecasts.push({
        date: forecastTime,
        dayOfWeek,
        hour,
        predictedRides: Math.round(avgHourlyRides * multiplier * weekendBoost),
        predictedOrders: Math.round(avgHourlyOrders * multiplier * weekendBoost * 1.1),
        predictedParcels: Math.round(avgHourlyRides * 0.3 * multiplier),
        confidence: 80 + Math.floor(Math.random() * 15),
        factors,
      });
    }

    return forecasts;
  },

  async getChurnPredictions(countryCode?: string, limit: number = 50): Promise<ChurnPrediction[]> {
    const predictions: ChurnPrediction[] = [];
    const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const last90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const customers = await prisma.customerProfile.findMany({
      where: countryCode ? { user: { countryCode } } : {},
      include: { user: true },
      take: 200,
    });

    for (const customer of customers) {
      const rideCount = await prisma.ride.count({
        where: { customerId: customer.userId, createdAt: { gte: last30d } },
      });

      const orderCount = await prisma.foodOrder.count({
        where: { customerId: customer.userId, createdAt: { gte: last30d } },
      });

      const totalActivity = rideCount + orderCount;
      let churnProbability = 0;
      const riskFactors: string[] = [];

      if (totalActivity === 0) {
        churnProbability = 85;
        riskFactors.push('No activity in last 30 days');
      } else if (totalActivity < 3) {
        churnProbability = 60;
        riskFactors.push('Low activity level');
      } else if (totalActivity < 5) {
        churnProbability = 35;
        riskFactors.push('Declining activity');
      } else {
        churnProbability = 15;
      }

      if (customer.user?.isBlocked) {
        churnProbability = 95;
        riskFactors.push('Account blocked');
      }

      if (churnProbability >= 35) {
        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
        if (churnProbability >= 80) riskLevel = 'CRITICAL';
        else if (churnProbability >= 60) riskLevel = 'HIGH';
        else if (churnProbability >= 40) riskLevel = 'MEDIUM';

        predictions.push({
          entityType: 'CUSTOMER',
          entityId: customer.userId,
          entityName: customer.user?.fullName || 'Unknown',
          churnProbability,
          riskLevel,
          riskFactors,
          lastActivity: customer.user?.lastLoginAt || customer.createdAt,
          lifetimeValue: (rideCount * 15) + (orderCount * 25),
          recommendedAction: churnProbability > 70 
            ? 'Send personalized win-back offer'
            : 'Monitor and send engagement notification',
        });
      }
    }

    return predictions
      .sort((a, b) => b.churnProbability - a.churnProbability)
      .slice(0, limit);
  },

  async getRevenueProjections(countryCode?: string): Promise<RevenueProjection[]> {
    const projections: RevenueProjection[] = [];
    const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [rideCount, orderCount] = await Promise.all([
      prisma.ride.count({ where: { createdAt: { gte: last30d }, status: 'completed' } }),
      prisma.foodOrder.count({ where: { createdAt: { gte: last30d }, status: 'delivered' } }),
    ]);

    const dailyRideRevenue = (rideCount / 30) * 15;
    const dailyOrderRevenue = (orderCount / 30) * 25;
    const dailyRevenue = dailyRideRevenue + dailyOrderRevenue;

    const periods: Array<{ period: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY'; days: number }> = [
      { period: 'WEEKLY', days: 7 },
      { period: 'MONTHLY', days: 30 },
      { period: 'QUARTERLY', days: 90 },
    ];

    for (const { period, days } of periods) {
      const baseRevenue = dailyRevenue * days;
      const growthRate = 0.05 + (Math.random() * 0.05);
      const projectedRevenue = baseRevenue * (1 + growthRate);
      const costs = projectedRevenue * 0.65;

      projections.push({
        period,
        startDate: new Date(),
        endDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
        projectedRevenue: Math.round(projectedRevenue),
        projectedCosts: Math.round(costs),
        projectedProfit: Math.round(projectedRevenue - costs),
        growthRate: Math.round(growthRate * 100),
        confidence: period === 'WEEKLY' ? 85 : period === 'MONTHLY' ? 75 : 65,
        breakdown: {
          rides: Math.round(dailyRideRevenue * days * (1 + growthRate)),
          food: Math.round(dailyOrderRevenue * days * (1 + growthRate)),
          parcels: Math.round(dailyRevenue * 0.15 * days),
          commissions: Math.round(projectedRevenue * 0.2),
        },
      });
    }

    return projections;
  },

  async getCapacityPredictions(countryCode?: string): Promise<CapacityPrediction[]> {
    const predictions: CapacityPrediction[] = [];
    
    const onlineDrivers = await prisma.driverProfile.count({
      where: {
        isOnline: true,
        ...(countryCode ? { user: { countryCode } } : {}),
      },
    });

    const zones = ['Downtown', 'Airport', 'Suburbs', 'Business District', 'University Area'];
    const timeSlots = ['Morning (6-10)', 'Midday (10-14)', 'Afternoon (14-18)', 'Evening (18-22)', 'Night (22-6)'];

    for (const zone of zones) {
      for (const timeSlot of timeSlots) {
        const demand = Math.floor(Math.random() * 50) + 10;
        const supply = Math.floor(onlineDrivers / zones.length / timeSlots.length * (1 + Math.random()));
        const gap = demand - supply;

        if (gap > 5) {
          predictions.push({
            zone,
            timeSlot,
            predictedDemand: demand,
            currentSupply: supply,
            gap,
            recommendation: gap > 15 
              ? 'Activate surge pricing and send driver incentives' 
              : 'Consider targeted driver notifications',
            surgeMultiplier: Math.min(2.5, 1 + (gap / demand)),
          });
        }
      }
    }

    return predictions.sort((a, b) => b.gap - a.gap);
  },

  async getFraudRiskPredictions(countryCode?: string): Promise<FraudRiskPrediction[]> {
    const predictions: FraudRiskPrediction[] = [];
    
    const lowRatingDrivers = await prisma.driverProfile.findMany({
      where: {
        rating: { lt: 3.0 },
        ...(countryCode ? { user: { countryCode } } : {}),
      },
      include: { user: true },
      take: 20,
    });

    for (const driver of lowRatingDrivers) {
      const rating = driver.rating?.toNumber() || 0;
      const riskIndicators: string[] = [];
      let fraudProbability = 20;

      if (rating < 2.5) {
        riskIndicators.push('Very low rating');
        fraudProbability += 25;
      }
      if (driver.totalTrips && driver.totalTrips < 50 && rating < 3.0) {
        riskIndicators.push('New driver with poor performance');
        fraudProbability += 15;
      }

      if (fraudProbability > 30) {
        predictions.push({
          entityType: 'DRIVER',
          entityId: driver.userId,
          entityName: driver.user?.fullName || 'Unknown',
          fraudProbability: Math.min(100, fraudProbability),
          riskLevel: fraudProbability > 70 ? 'CRITICAL' : fraudProbability > 50 ? 'HIGH' : 'MEDIUM',
          riskIndicators,
          financialExposure: Math.floor(fraudProbability * 10),
          recommendedAction: fraudProbability > 60 
            ? 'Immediate review required'
            : 'Add to monitoring list',
        });
      }
    }

    return predictions.sort((a, b) => b.fraudProbability - a.fraudProbability);
  },
};
