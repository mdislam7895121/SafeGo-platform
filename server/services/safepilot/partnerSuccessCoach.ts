import { prisma } from '../../db';

interface TrainingStep {
  id: string;
  title: string;
  description: string;
  duration: string;
  type: 'VIDEO' | 'QUIZ' | 'PRACTICE' | 'DOCUMENT';
  priority: number;
}

interface DriverTrainingPlan {
  driverId: string;
  driverName: string;
  currentRating: number;
  issueAreas: string[];
  trainingSteps: TrainingStep[];
  estimatedImprovement: string;
  deadline: Date;
}

interface RestaurantImprovementPlan {
  restaurantId: string;
  restaurantName: string;
  currentRating: number;
  issueAreas: string[];
  improvements: Array<{
    area: string;
    currentValue: string;
    targetValue: string;
    actionSteps: string[];
    priority: number;
  }>;
  estimatedRevenueIncrease: number;
}

interface LowPerformer {
  entityType: 'DRIVER' | 'RESTAURANT' | 'COURIER';
  entityId: string;
  entityName: string;
  performanceScore: number;
  metrics: Record<string, number>;
  issues: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendation: string;
}

interface PersonalizedAction {
  id: string;
  entityType: 'DRIVER' | 'RESTAURANT' | 'COURIER';
  entityId: string;
  actionType: 'TRAINING' | 'INCENTIVE' | 'WARNING' | 'SUPPORT' | 'RECOGNITION';
  title: string;
  description: string;
  expectedOutcome: string;
  priority: number;
  deadline?: Date;
}

export const partnerSuccessCoach = {
  /**
   * Generate driver training plan
   */
  async generateDriverTrainingPlan(driverId: string): Promise<DriverTrainingPlan | null> {
    const driver = await prisma.driverProfile.findUnique({
      where: { userId: driverId },
      include: {
        user: true,
      },
    });

    if (!driver) return null;

    const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [recentRides, ratings, complaints] = await Promise.all([
      prisma.ride.findMany({
        where: {
          driverId,
          createdAt: { gte: last30d },
          status: 'completed',
        },
      }),
      prisma.rideRating.findMany({
        where: {
          ride: { driverId },
          createdAt: { gte: last30d },
        },
      }),
      prisma.supportTicket.count({
        where: {
          relatedUserId: driverId,
          createdAt: { gte: last30d },
          category: 'complaint',
        },
      }),
    ]);

    const avgRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : driver.rating?.toNumber() || 4.5;

    const issueAreas: string[] = [];
    const trainingSteps: TrainingStep[] = [];

    if (avgRating < 4.0) {
      issueAreas.push('Customer satisfaction');
      trainingSteps.push({
        id: 'customer-service-basics',
        title: 'Customer Service Excellence',
        description: 'Learn how to provide 5-star customer experiences',
        duration: '15 min',
        type: 'VIDEO',
        priority: 100,
      });
    }

    const cancelledRides = recentRides.filter(r => 
      r.status.includes('cancelled_by_driver')
    ).length;
    const cancellationRate = recentRides.length > 0 
      ? cancelledRides / recentRides.length 
      : 0;

    if (cancellationRate > 0.1) {
      issueAreas.push('High cancellation rate');
      trainingSteps.push({
        id: 'ride-acceptance',
        title: 'Ride Acceptance Best Practices',
        description: 'Understanding when and how to accept rides effectively',
        duration: '10 min',
        type: 'VIDEO',
        priority: 90,
      });
    }

    if (complaints > 2) {
      issueAreas.push('Customer complaints');
      trainingSteps.push({
        id: 'complaint-prevention',
        title: 'Preventing Common Complaints',
        description: 'Learn to identify and avoid common complaint triggers',
        duration: '20 min',
        type: 'DOCUMENT',
        priority: 95,
      });
    }

    const lowRatingCount = ratings.filter(r => r.rating <= 3).length;
    if (lowRatingCount > 3) {
      issueAreas.push('Repeated low ratings');
      trainingSteps.push({
        id: 'rating-improvement',
        title: 'Improving Your Ratings',
        description: 'Strategies for consistently earning 5-star ratings',
        duration: '25 min',
        type: 'VIDEO',
        priority: 85,
      });
      trainingSteps.push({
        id: 'rating-quiz',
        title: 'Customer Experience Quiz',
        description: 'Test your knowledge on customer service',
        duration: '10 min',
        type: 'QUIZ',
        priority: 80,
      });
    }

    trainingSteps.push({
      id: 'navigation-basics',
      title: 'Navigation & Route Optimization',
      description: 'Using SafeGo navigation for faster pickups',
      duration: '10 min',
      type: 'VIDEO',
      priority: 70,
    });

    trainingSteps.push({
      id: 'safety-refresher',
      title: 'Safety Protocols Refresher',
      description: 'Review safety procedures and emergency protocols',
      duration: '15 min',
      type: 'DOCUMENT',
      priority: 65,
    });

    return {
      driverId,
      driverName: driver.user?.fullName || 'Driver',
      currentRating: avgRating,
      issueAreas,
      trainingSteps: trainingSteps.sort((a, b) => b.priority - a.priority),
      estimatedImprovement: issueAreas.length > 2 
        ? '+0.5 rating improvement in 30 days' 
        : '+0.3 rating improvement in 30 days',
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    };
  },

  /**
   * Generate restaurant improvement plan
   */
  async generateRestaurantImprovementPlan(restaurantId: string): Promise<RestaurantImprovementPlan | null> {
    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { userId: restaurantId },
      include: {
        user: true,
      },
    });

    if (!restaurant) return null;

    const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [orders, ratings] = await Promise.all([
      prisma.foodOrder.findMany({
        where: {
          restaurantId,
          createdAt: { gte: last30d },
        },
      }),
      prisma.restaurantRating.findMany({
        where: {
          restaurantId,
          createdAt: { gte: last30d },
        },
      }),
    ]);

    const avgRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : restaurant.rating?.toNumber() || 4.0;

    const issueAreas: string[] = [];
    const improvements: RestaurantImprovementPlan['improvements'] = [];

    const deliveredOrders = orders.filter(o => o.status === 'delivered');
    const cancelledOrders = orders.filter(o => o.status.includes('cancelled'));
    const cancellationRate = orders.length > 0 
      ? cancelledOrders.length / orders.length 
      : 0;

    if (cancellationRate > 0.1) {
      issueAreas.push('High order cancellation');
      improvements.push({
        area: 'Order Acceptance',
        currentValue: `${Math.round(cancellationRate * 100)}% cancellation rate`,
        targetValue: '<5% cancellation rate',
        actionSteps: [
          'Review and update menu availability in real-time',
          'Set realistic preparation times',
          'Enable order throttling during peak hours',
        ],
        priority: 100,
      });
    }

    const ordersWithPrepTime = deliveredOrders.filter(o => o.pickedUpAt && o.acceptedAt);
    if (ordersWithPrepTime.length > 0) {
      const avgPrepTime = ordersWithPrepTime.reduce((sum, o) => {
        const prep = (o.pickedUpAt!.getTime() - o.acceptedAt!.getTime()) / 1000 / 60;
        return sum + prep;
      }, 0) / ordersWithPrepTime.length;

      if (avgPrepTime > 25) {
        issueAreas.push('Slow preparation time');
        improvements.push({
          area: 'Preparation Speed',
          currentValue: `${Math.round(avgPrepTime)} min avg`,
          targetValue: '<20 min avg',
          actionSteps: [
            'Pre-prep common ingredients during slow hours',
            'Optimize kitchen workflow',
            'Consider adding staff during peak times',
          ],
          priority: 90,
        });
      }
    }

    if (avgRating < 4.2) {
      issueAreas.push('Customer satisfaction');
      improvements.push({
        area: 'Food Quality & Presentation',
        currentValue: `${avgRating.toFixed(1)} average rating`,
        targetValue: '4.5+ average rating',
        actionSteps: [
          'Use better packaging for delivery',
          'Include utensils and napkins',
          'Add a thank you note to orders',
          'Review portion sizes',
        ],
        priority: 95,
      });
    }

    const avgOrderValue = deliveredOrders.length > 0
      ? deliveredOrders.reduce((sum, o) => sum + (o.total?.toNumber() || 0), 0) / deliveredOrders.length
      : 0;

    improvements.push({
      area: 'Revenue Optimization',
      currentValue: `$${avgOrderValue.toFixed(2)} avg order`,
      targetValue: `$${(avgOrderValue * 1.2).toFixed(2)} avg order`,
      actionSteps: [
        'Create combo meals and bundles',
        'Add premium/upsell options',
        'Offer limited-time specials',
        'Update menu photos for better appeal',
      ],
      priority: 75,
    });

    return {
      restaurantId,
      restaurantName: restaurant.restaurantName || restaurant.user?.fullName || 'Restaurant',
      currentRating: avgRating,
      issueAreas,
      improvements: improvements.sort((a, b) => b.priority - a.priority),
      estimatedRevenueIncrease: deliveredOrders.length * avgOrderValue * 0.15,
    };
  },

  /**
   * Detect low-performing partners
   */
  async detectLowPerformers(countryCode?: string): Promise<LowPerformer[]> {
    const lowPerformers: LowPerformer[] = [];
    const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const drivers = await prisma.driverProfile.findMany({
      where: {
        driverStats: { rating: { lt: 4.0 } },
        ...(countryCode ? { user: { countryCode } } : {}),
      },
      include: {
        user: true,
        driverStats: true,
      },
    });

    for (const driver of drivers) {
      const [rideCount, cancelCount, complaintCount] = await Promise.all([
        prisma.ride.count({
          where: { driverId: driver.id, createdAt: { gte: last30d }, status: 'completed' },
        }),
        prisma.ride.count({
          where: { driverId: driver.id, createdAt: { gte: last30d }, status: { contains: 'cancelled_by_driver' } },
        }),
        prisma.supportTicket.count({
          where: { relatedUserId: driver.userId, createdAt: { gte: last30d }, category: 'complaint' },
        }),
      ]);

      const rating = driver.driverStats?.rating?.toNumber() || 0;
      const cancellationRate = rideCount > 0 ? cancelCount / (rideCount + cancelCount) : 0;

      const issues: string[] = [];
      let performanceScore = 100;

      if (rating < 4.0) {
        issues.push(`Low rating: ${rating.toFixed(1)}`);
        performanceScore -= (4.0 - rating) * 20;
      }

      if (cancellationRate > 0.1) {
        issues.push(`High cancellation: ${Math.round(cancellationRate * 100)}%`);
        performanceScore -= cancellationRate * 50;
      }

      if (complaintCount > 2) {
        issues.push(`${complaintCount} complaints`);
        performanceScore -= complaintCount * 5;
      }

      if (performanceScore < 70) {
        lowPerformers.push({
          entityType: 'DRIVER',
          entityId: driver.userId,
          entityName: driver.user?.fullName || 'Unknown Driver',
          performanceScore: Math.max(0, Math.round(performanceScore)),
          metrics: {
            rating,
            rideCount,
            cancellationRate: Math.round(cancellationRate * 100),
            complaintCount,
          },
          issues,
          riskLevel: performanceScore < 30 ? 'CRITICAL' : performanceScore < 50 ? 'HIGH' : 'MEDIUM',
          recommendation: performanceScore < 30
            ? 'Consider account suspension and mandatory training'
            : performanceScore < 50
              ? 'Assign to performance improvement program'
              : 'Schedule coaching session',
        });
      }
    }

    const restaurants = await prisma.restaurantProfile.findMany({
      where: {
        averageRating: { lt: 3.8 },
        ...(countryCode ? { user: { countryCode } } : {}),
      },
      include: {
        user: true,
      },
    });

    for (const restaurant of restaurants) {
      const [orderCount, cancelCount] = await Promise.all([
        prisma.foodOrder.count({
          where: { restaurantId: restaurant.userId, createdAt: { gte: last30d }, status: 'delivered' },
        }),
        prisma.foodOrder.count({
          where: { restaurantId: restaurant.userId, createdAt: { gte: last30d }, status: { contains: 'cancelled' } },
        }),
      ]);

      const rating = (restaurant.averageRating as number) || 0;
      const cancellationRate = orderCount > 0 ? cancelCount / (orderCount + cancelCount) : 0;

      const issues: string[] = [];
      let performanceScore = 100;

      if (rating < 3.8) {
        issues.push(`Low rating: ${rating.toFixed(1)}`);
        performanceScore -= (3.8 - rating) * 25;
      }

      if (cancellationRate > 0.15) {
        issues.push(`High cancellation: ${Math.round(cancellationRate * 100)}%`);
        performanceScore -= cancellationRate * 40;
      }

      if (performanceScore < 70) {
        lowPerformers.push({
          entityType: 'RESTAURANT',
          entityId: restaurant.userId,
          entityName: restaurant.restaurantName || restaurant.user?.fullName || 'Unknown Restaurant',
          performanceScore: Math.max(0, Math.round(performanceScore)),
          metrics: {
            rating,
            orderCount,
            cancellationRate: Math.round(cancellationRate * 100),
          },
          issues,
          riskLevel: performanceScore < 30 ? 'CRITICAL' : performanceScore < 50 ? 'HIGH' : 'MEDIUM',
          recommendation: performanceScore < 30
            ? 'Consider temporary delisting until improvements made'
            : performanceScore < 50
              ? 'Schedule quality improvement meeting'
              : 'Provide improvement resources',
        });
      }
    }

    return lowPerformers.sort((a, b) => a.performanceScore - b.performanceScore);
  },

  /**
   * Generate personalized improvement actions
   */
  async generatePersonalizedActions(countryCode?: string): Promise<PersonalizedAction[]> {
    const actions: PersonalizedAction[] = [];
    const lowPerformers = await this.detectLowPerformers(countryCode);

    for (const performer of lowPerformers) {
      if (performer.riskLevel === 'CRITICAL') {
        actions.push({
          id: `action-${performer.entityType.toLowerCase()}-${performer.entityId}-suspension`,
          entityType: performer.entityType,
          entityId: performer.entityId,
          actionType: 'WARNING',
          title: 'Immediate Intervention Required',
          description: `${performer.entityName} requires immediate attention due to critical performance issues`,
          expectedOutcome: 'Prevent further customer impact',
          priority: 100,
          deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
      }

      if (performer.issues.some(i => i.includes('Low rating'))) {
        actions.push({
          id: `action-${performer.entityType.toLowerCase()}-${performer.entityId}-training`,
          entityType: performer.entityType,
          entityId: performer.entityId,
          actionType: 'TRAINING',
          title: performer.entityType === 'DRIVER' 
            ? 'Customer Service Training' 
            : 'Quality Improvement Training',
          description: `Assign mandatory training to improve ratings`,
          expectedOutcome: '+0.3 rating improvement within 30 days',
          priority: 85,
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
      }

      if (performer.riskLevel === 'MEDIUM') {
        actions.push({
          id: `action-${performer.entityType.toLowerCase()}-${performer.entityId}-support`,
          entityType: performer.entityType,
          entityId: performer.entityId,
          actionType: 'SUPPORT',
          title: 'Proactive Support Outreach',
          description: 'Schedule a support call to understand challenges and provide assistance',
          expectedOutcome: 'Identify and address root causes',
          priority: 70,
          deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        });
      }
    }

    const topDrivers = await prisma.driverProfile.findMany({
      where: {
        rating: { gte: 4.8 },
        ...(countryCode ? { user: { countryCode } } : {}),
      },
      include: { user: true },
      take: 10,
    });

    for (const driver of topDrivers) {
      actions.push({
        id: `action-driver-${driver.userId}-recognition`,
        entityType: 'DRIVER',
        entityId: driver.userId,
        actionType: 'RECOGNITION',
        title: 'Top Performer Recognition',
        description: `Recognize ${driver.user?.fullName} for excellent performance`,
        expectedOutcome: 'Maintain high performance and boost morale',
        priority: 50,
      });
    }

    return actions.sort((a, b) => b.priority - a.priority);
  },

  /**
   * Get partner success summary
   */
  async getPartnerSuccessSummary(countryCode?: string): Promise<{
    lowPerformerCount: number;
    criticalCount: number;
    trainingNeeded: number;
    topPerformerCount: number;
    pendingActions: number;
    averageDriverRating: number;
    averageRestaurantRating: number;
  }> {
    const [lowPerformers, actions, driverAvg, restaurantAvg, topDrivers] = await Promise.all([
      this.detectLowPerformers(countryCode),
      this.generatePersonalizedActions(countryCode),
      prisma.driverProfile.aggregate({
        where: countryCode ? { user: { countryCode } } : {},
        _avg: { rating: true },
      }),
      prisma.restaurantProfile.aggregate({
        where: countryCode ? { user: { countryCode } } : {},
        _avg: { averageRating: true },
      }),
      prisma.driverProfile.count({
        where: {
          rating: { gte: 4.8 },
          ...(countryCode ? { user: { countryCode } } : {}),
        },
      }),
    ]);

    return {
      lowPerformerCount: lowPerformers.length,
      criticalCount: lowPerformers.filter(p => p.riskLevel === 'CRITICAL').length,
      trainingNeeded: actions.filter(a => a.actionType === 'TRAINING').length,
      topPerformerCount: topDrivers,
      pendingActions: actions.length,
      averageDriverRating: driverAvg._avg.rating?.toNumber() || 0,
      averageRestaurantRating: (restaurantAvg._avg.averageRating as number) || 0,
    };
  },
};
