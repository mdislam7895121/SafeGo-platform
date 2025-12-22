import { prisma } from '../../db';

interface EarningsPrediction {
  period: 'WEEKLY' | 'MONTHLY';
  predicted: number;
  lower: number;
  upper: number;
  confidence: number;
  factors: string[];
  trend: 'UP' | 'STABLE' | 'DOWN';
}

interface NegativeBalanceRisk {
  driverId: string;
  driverName: string;
  currentBalance: number;
  projectedBalance: number;
  daysToNegative: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  pendingCommissions: number;
  recommendation: string;
}

interface SettlementRisk {
  restaurantId: string;
  restaurantName: string;
  pendingAmount: number;
  daysPending: number;
  payoutMethod: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reason: string;
  recommendation: string;
}

interface PayoutOptimization {
  suggestion: string;
  currentCost: number;
  optimizedCost: number;
  savings: number;
  implementation: string[];
  affectedEntities: number;
}

interface RevenueInsight {
  category: string;
  currentRevenue: number;
  projectedRevenue: number;
  growth: number;
  topPerformers: Array<{ name: string; revenue: number }>;
  opportunities: string[];
}

export const financialIntelligence = {
  /**
   * Predict weekly/monthly earnings
   */
  async predictEarnings(period: 'WEEKLY' | 'MONTHLY', countryCode?: string): Promise<EarningsPrediction> {
    const days = period === 'WEEKLY' ? 7 : 30;
    const historicalDays = days * 4;
    const since = new Date(Date.now() - historicalDays * 24 * 60 * 60 * 1000);

    const [rideEarnings, foodEarnings, parcelEarnings] = await Promise.all([
      prisma.ride.aggregate({
        where: {
          createdAt: { gte: since },
          status: 'completed',
          ...(countryCode ? { customer: { user: { countryCode } } } : {}),
        },
        _sum: { fare: true },
        _count: true,
      }),
      prisma.foodOrder.aggregate({
        where: {
          createdAt: { gte: since },
          status: 'delivered',
          ...(countryCode ? { customer: { user: { countryCode } } } : {}),
        },
        _sum: { total: true },
        _count: true,
      }),
      prisma.parcelDelivery.aggregate({
        where: {
          createdAt: { gte: since },
          status: 'delivered',
          ...(countryCode ? { sender: { user: { countryCode } } } : {}),
        },
        _sum: { price: true },
        _count: true,
      }),
    ]);

    const totalHistorical = 
      (rideEarnings._sum.fare?.toNumber() || 0) +
      (foodEarnings._sum.total?.toNumber() || 0) +
      (parcelEarnings._sum.price?.toNumber() || 0);

    const dailyAvg = totalHistorical / historicalDays;
    const predicted = dailyAvg * days;

    const factors: string[] = [];
    let trend: 'UP' | 'STABLE' | 'DOWN' = 'STABLE';

    const recentDays = period === 'WEEKLY' ? 7 : 14;
    const recentSince = new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000);

    const recentTotal = await Promise.all([
      prisma.ride.aggregate({
        where: { createdAt: { gte: recentSince }, status: 'completed' },
        _sum: { fare: true },
      }),
      prisma.foodOrder.aggregate({
        where: { createdAt: { gte: recentSince }, status: 'delivered' },
        _sum: { total: true },
      }),
    ]).then(([r, f]) => 
      (r._sum.fare?.toNumber() || 0) + (f._sum.total?.toNumber() || 0)
    );

    const recentDailyAvg = recentTotal / recentDays;
    const growthRate = dailyAvg > 0 ? (recentDailyAvg - dailyAvg) / dailyAvg : 0;

    if (growthRate > 0.1) {
      trend = 'UP';
      factors.push(`Recent growth of ${Math.round(growthRate * 100)}%`);
    } else if (growthRate < -0.1) {
      trend = 'DOWN';
      factors.push(`Recent decline of ${Math.round(Math.abs(growthRate) * 100)}%`);
    }

    if (rideEarnings._count > foodEarnings._count) {
      factors.push('Ride-hailing is primary revenue driver');
    } else {
      factors.push('Food delivery is primary revenue driver');
    }

    const confidence = Math.min(95, 70 + (historicalDays / 30) * 5);
    const variance = predicted * (1 - confidence / 100) * 0.5;

    return {
      period,
      predicted: Math.round(predicted),
      lower: Math.round(predicted - variance),
      upper: Math.round(predicted + variance),
      confidence: Math.round(confidence),
      factors,
      trend,
    };
  },

  /**
   * Detect negative balance risks
   */
  async detectNegativeBalanceRisks(countryCode?: string): Promise<NegativeBalanceRisk[]> {
    const risks: NegativeBalanceRisk[] = [];

    const wallets = await prisma.driverWallet.findMany({
      where: {
        OR: [
          { balance: { lt: 50 } },
          { pendingBalance: { gt: 0 } },
        ],
        ...(countryCode ? { driver: { user: { countryCode } } } : {}),
      },
      include: {
        driver: {
          include: { user: true },
        },
      },
    });

    for (const wallet of wallets) {
      const balance = wallet.balance?.toNumber() || 0;
      const pending = wallet.pendingBalance?.toNumber() || 0;

      const last7dRides = await prisma.ride.count({
        where: {
          driverId: wallet.driverId,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          status: 'completed',
        },
      });

      const avgDailyEarnings = last7dRides * 15 / 7;
      const avgDailyCommission = avgDailyEarnings * 0.2;

      const projectedBalance = balance - (avgDailyCommission * 7) + pending;
      const daysToNegative = avgDailyCommission > 0 
        ? Math.max(0, Math.floor(balance / avgDailyCommission))
        : 999;

      let riskLevel: NegativeBalanceRisk['riskLevel'] = 'LOW';
      let recommendation = 'Monitor balance';

      if (balance < 0) {
        riskLevel = 'CRITICAL';
        recommendation = 'Immediate commission collection required';
      } else if (daysToNegative < 3) {
        riskLevel = 'HIGH';
        recommendation = 'Schedule payout adjustment or commission collection';
      } else if (daysToNegative < 7) {
        riskLevel = 'MEDIUM';
        recommendation = 'Send balance alert to driver';
      }

      if (riskLevel !== 'LOW') {
        risks.push({
          driverId: wallet.driverId,
          driverName: wallet.driver?.user?.fullName || 'Unknown',
          currentBalance: balance,
          projectedBalance: Math.round(projectedBalance),
          daysToNegative,
          riskLevel,
          pendingCommissions: Math.round(avgDailyCommission * 7),
          recommendation,
        });
      }
    }

    return risks.sort((a, b) => a.daysToNegative - b.daysToNegative);
  },

  /**
   * Detect unpaid settlement risks
   */
  async detectSettlementRisks(countryCode?: string): Promise<SettlementRisk[]> {
    const risks: SettlementRisk[] = [];

    const pendingPayouts = await prisma.payout.findMany({
      where: {
        status: 'pending',
        createdAt: { lt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      },
      include: {
        driver: {
          include: { user: true },
        },
        restaurant: {
          include: { user: true },
        },
      },
    });

    for (const payout of pendingPayouts) {
      const daysPending = Math.floor(
        (Date.now() - payout.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      let riskLevel: SettlementRisk['riskLevel'] = 'LOW';
      let reason = 'Standard processing';
      let recommendation = 'Monitor';

      if (daysPending > 7) {
        riskLevel = 'CRITICAL';
        reason = 'Payout severely delayed';
        recommendation = 'Immediate investigation and manual processing';
      } else if (daysPending > 5) {
        riskLevel = 'HIGH';
        reason = 'Payout delayed beyond normal SLA';
        recommendation = 'Priority processing required';
      } else if (daysPending > 3) {
        riskLevel = 'MEDIUM';
        reason = 'Payout approaching SLA limit';
        recommendation = 'Expedite processing';
      }

      if (riskLevel !== 'LOW') {
        const entityName = payout.restaurant?.restaurantName || 
                          payout.restaurant?.user?.fullName ||
                          payout.driver?.user?.fullName || 
                          'Unknown';

        risks.push({
          restaurantId: payout.restaurantId || payout.driverId || '',
          restaurantName: entityName,
          pendingAmount: payout.amount?.toNumber() || 0,
          daysPending,
          payoutMethod: payout.paymentMethod || 'Unknown',
          riskLevel,
          reason,
          recommendation,
        });
      }
    }

    return risks.sort((a, b) => b.daysPending - a.daysPending);
  },

  /**
   * Suggest payout schedule optimizations
   */
  async suggestPayoutOptimizations(countryCode?: string): Promise<PayoutOptimization[]> {
    const optimizations: PayoutOptimization[] = [];

    const dailyPayouts = await prisma.payout.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        status: 'completed',
      },
    });

    const avgPayoutPerDay = dailyPayouts / 30;
    const estimatedTransactionFee = 0.5;
    const currentMonthlyCost = dailyPayouts * estimatedTransactionFee;

    if (avgPayoutPerDay > 50) {
      optimizations.push({
        suggestion: 'Batch Daily Payouts to Weekly',
        currentCost: currentMonthlyCost,
        optimizedCost: (dailyPayouts / 7) * estimatedTransactionFee,
        savings: currentMonthlyCost - (dailyPayouts / 7) * estimatedTransactionFee,
        implementation: [
          'Change default payout frequency to weekly',
          'Notify partners 30 days in advance',
          'Offer instant payout option for premium fee',
        ],
        affectedEntities: await prisma.driverProfile.count(),
      });
    }

    const smallPayouts = await prisma.payout.count({
      where: {
        amount: { lt: 10 },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        status: 'completed',
      },
    });

    if (smallPayouts > 100) {
      optimizations.push({
        suggestion: 'Set Minimum Payout Threshold',
        currentCost: smallPayouts * estimatedTransactionFee,
        optimizedCost: (smallPayouts / 4) * estimatedTransactionFee,
        savings: (smallPayouts * 0.75) * estimatedTransactionFee,
        implementation: [
          'Set $10 minimum payout threshold',
          'Accumulate smaller amounts until threshold met',
          'Communicate change to partners',
        ],
        affectedEntities: smallPayouts,
      });
    }

    const multiplePayoutsPerDriver = await prisma.$queryRaw<Array<{ driverId: string; count: bigint }>>`
      SELECT "driverId", COUNT(*) as count 
      FROM "Payout" 
      WHERE "createdAt" > NOW() - INTERVAL '30 days' AND status = 'completed'
      GROUP BY "driverId" 
      HAVING COUNT(*) > 8
    `;

    if (multiplePayoutsPerDriver.length > 50) {
      optimizations.push({
        suggestion: 'Consolidate Multiple Driver Payouts',
        currentCost: multiplePayoutsPerDriver.length * 8 * estimatedTransactionFee,
        optimizedCost: multiplePayoutsPerDriver.length * 4 * estimatedTransactionFee,
        savings: multiplePayoutsPerDriver.length * 4 * estimatedTransactionFee,
        implementation: [
          'Identify drivers requesting multiple payouts',
          'Offer bi-weekly consolidated payout option',
          'Provide earnings dashboard for transparency',
        ],
        affectedEntities: multiplePayoutsPerDriver.length,
      });
    }

    return optimizations.sort((a, b) => b.savings - a.savings);
  },

  /**
   * Get revenue insights by category
   */
  async getRevenueInsights(countryCode?: string): Promise<RevenueInsight[]> {
    const insights: RevenueInsight[] = [];
    const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const last60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const [rideRevenue, prevRideRevenue, topDrivers] = await Promise.all([
      prisma.ride.aggregate({
        where: { createdAt: { gte: last30d }, status: 'completed' },
        _sum: { serviceFare: true },
      }),
      prisma.ride.aggregate({
        where: { createdAt: { gte: last60d, lt: last30d }, status: 'completed' },
        _sum: { serviceFare: true },
      }),
      prisma.ride.groupBy({
        by: ['driverId'],
        where: { createdAt: { gte: last30d }, status: 'completed' },
        _sum: { serviceFare: true },
        orderBy: { _sum: { serviceFare: 'desc' } },
        take: 5,
      }),
    ]);

    const currentRide = rideRevenue._sum.serviceFare?.toNumber() || 0;
    const prevRide = prevRideRevenue._sum.serviceFare?.toNumber() || 1;
    const rideGrowth = ((currentRide - prevRide) / prevRide) * 100;

    const topDriverNames = await Promise.all(
      topDrivers.map(async d => {
        const driver = await prisma.driverProfile.findUnique({
          where: { userId: d.driverId! },
          include: { user: true },
        });
        return {
          name: driver?.user?.fullName || 'Unknown',
          revenue: d._sum.serviceFare?.toNumber() || 0,
        };
      })
    );

    insights.push({
      category: 'Ride-Hailing',
      currentRevenue: Math.round(currentRide),
      projectedRevenue: Math.round(currentRide * (1 + rideGrowth / 100 / 2)),
      growth: Math.round(rideGrowth),
      topPerformers: topDriverNames,
      opportunities: rideGrowth < 0 
        ? ['Increase driver incentives', 'Launch promotional campaigns']
        : ['Expand to new areas', 'Optimize surge pricing'],
    });

    const [foodRevenue, prevFoodRevenue, topRestaurants] = await Promise.all([
      prisma.foodOrder.aggregate({
        where: { createdAt: { gte: last30d }, status: 'delivered' },
        _sum: { total: true },
      }),
      prisma.foodOrder.aggregate({
        where: { createdAt: { gte: last60d, lt: last30d }, status: 'delivered' },
        _sum: { total: true },
      }),
      prisma.foodOrder.groupBy({
        by: ['restaurantId'],
        where: { createdAt: { gte: last30d }, status: 'delivered' },
        _sum: { total: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      }),
    ]);

    const currentFood = foodRevenue._sum.total?.toNumber() || 0;
    const prevFood = prevFoodRevenue._sum.total?.toNumber() || 1;
    const foodGrowth = ((currentFood - prevFood) / prevFood) * 100;

    const topRestaurantNames = await Promise.all(
      topRestaurants.map(async r => {
        const restaurant = await prisma.restaurantProfile.findUnique({
          where: { userId: r.restaurantId },
          include: { user: true },
        });
        return {
          name: restaurant?.restaurantName || restaurant?.user?.fullName || 'Unknown',
          revenue: r._sum.total?.toNumber() || 0,
        };
      })
    );

    insights.push({
      category: 'Food Delivery',
      currentRevenue: Math.round(currentFood),
      projectedRevenue: Math.round(currentFood * (1 + foodGrowth / 100 / 2)),
      growth: Math.round(foodGrowth),
      topPerformers: topRestaurantNames,
      opportunities: foodGrowth < 0
        ? ['Onboard popular restaurants', 'Improve delivery times']
        : ['Launch subscription service', 'Expand menu options'],
    });

    return insights;
  },

  /**
   * Get dashboard data for Vision 2030 module endpoint
   */
  async getDashboard(countryCode?: string): Promise<{
    earnings: { weekly: number; monthly: number; trend: 'UP' | 'STABLE' | 'DOWN' };
    negativeBalanceRisks: NegativeBalanceRisk[];
    settlementRisks: SettlementRisk[];
    payoutOptimizations: PayoutOptimization[];
    revenueInsights: RevenueInsight[];
  }> {
    const [weekly, monthly, negRisks, settleRisks, optimizations, insights] = await Promise.all([
      this.predictEarnings('WEEKLY', countryCode),
      this.predictEarnings('MONTHLY', countryCode),
      this.detectNegativeBalanceRisks(countryCode),
      this.detectSettlementRisks(countryCode),
      this.suggestPayoutOptimizations(countryCode),
      this.getRevenueInsights(countryCode),
    ]);

    return {
      earnings: { weekly: weekly.predicted, monthly: monthly.predicted, trend: weekly.trend },
      negativeBalanceRisks: negRisks,
      settlementRisks: settleRisks,
      payoutOptimizations: optimizations,
      revenueInsights: insights,
    };
  },

  /**
   * Get financial summary
   */
  async getFinancialSummary(countryCode?: string): Promise<{
    weeklyPrediction: number;
    monthlyPrediction: number;
    negativeBalanceRisks: number;
    settlementRisks: number;
    potentialSavings: number;
    revenueGrowth: number;
  }> {
    const [weekly, monthly, negRisks, settleRisks, optimizations, insights] = await Promise.all([
      this.predictEarnings('WEEKLY', countryCode),
      this.predictEarnings('MONTHLY', countryCode),
      this.detectNegativeBalanceRisks(countryCode),
      this.detectSettlementRisks(countryCode),
      this.suggestPayoutOptimizations(countryCode),
      this.getRevenueInsights(countryCode),
    ]);

    const totalSavings = optimizations.reduce((sum, o) => sum + o.savings, 0);
    const avgGrowth = insights.length > 0
      ? insights.reduce((sum, i) => sum + i.growth, 0) / insights.length
      : 0;

    return {
      weeklyPrediction: weekly.predicted,
      monthlyPrediction: monthly.predicted,
      negativeBalanceRisks: negRisks.filter(r => r.riskLevel !== 'LOW').length,
      settlementRisks: settleRisks.filter(r => r.riskLevel !== 'LOW').length,
      potentialSavings: Math.round(totalSavings),
      revenueGrowth: Math.round(avgGrowth),
    };
  },
};
