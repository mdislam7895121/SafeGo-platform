import { prisma } from '../../db';

interface UnhappyCustomer {
  customerId: string;
  customerName: string;
  email: string;
  unhappinessScore: number;
  indicators: string[];
  lastOrderDate: Date | null;
  lifetimeValue: number;
  churnRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendedActions: string[];
}

interface ApologyMessage {
  customerId: string;
  customerName: string;
  issueType: string;
  messageTemplate: string;
  offerType: 'DISCOUNT' | 'FREE_DELIVERY' | 'REFUND' | 'POINTS' | 'NONE';
  offerValue: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface WinBackStrategy {
  customerId: string;
  customerName: string;
  daysSinceLastOrder: number;
  lifetimeValue: number;
  strategy: 'DISCOUNT' | 'FREE_ITEM' | 'LOYALTY_BONUS' | 'PERSONALIZED_OFFER' | 'RE_ENGAGEMENT';
  message: string;
  offerDetails: string;
  expectedConversionRate: number;
  priority: number;
}

interface ChurnPrediction {
  customerId: string;
  customerName: string;
  churnProbability: number;
  daysToChurn: number;
  riskFactors: string[];
  retentionValue: number;
  recommendedIntervention: string;
}

export const customerRetentionAI = {
  /**
   * Detect unhappy customers using bulk queries
   */
  async detectUnhappyCustomers(countryCode?: string, days: number = 30): Promise<UnhappyCustomer[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const unhappyCustomers: UnhappyCustomer[] = [];

    const customers = await prisma.customerProfile.findMany({
      where: countryCode ? { user: { countryCode } } : {},
      include: { user: true },
      take: 500,
    });

    if (customers.length === 0) return [];

    const customerIds = customers.map(c => c.userId);

    const [
      refundCounts,
      complaintCounts,
      lowRatingCounts,
      recentFoodOrders,
      recentRides,
      lifetimeFoodOrders,
      lifetimeRides,
    ] = await Promise.all([
      prisma.refundRequest.groupBy({
        by: ['customerId'],
        where: { customerId: { in: customerIds }, createdAt: { gte: since } },
        _count: { id: true },
      }),
      prisma.supportTicket.groupBy({
        by: ['userId'],
        where: { userId: { in: customerIds }, createdAt: { gte: since }, category: 'complaint' },
        _count: { id: true },
      }),
      prisma.rideRating.groupBy({
        by: ['rideId'],
        where: {
          ride: { customerId: { in: customerIds } },
          createdAt: { gte: since },
          rating: { lte: 2 },
        },
        _count: { id: true },
      }),
      prisma.foodOrder.findMany({
        where: { customerId: { in: customerIds }, createdAt: { gte: since } },
        select: { customerId: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.ride.findMany({
        where: { customerId: { in: customerIds }, createdAt: { gte: since } },
        select: { customerId: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.foodOrder.groupBy({
        by: ['customerId'],
        where: { customerId: { in: customerIds }, status: 'delivered' },
        _count: { id: true },
      }),
      prisma.ride.groupBy({
        by: ['customerId'],
        where: { customerId: { in: customerIds }, status: 'completed' },
        _count: { id: true },
      }),
    ]);

    const refundMap = new Map(refundCounts.map(r => [r.customerId, r._count.id]));
    const complaintMap = new Map(complaintCounts.map(c => [c.userId, c._count.id]));
    
    const lowRatingsPerCustomer = new Map<string, number>();
    const ridesWithLowRatings = await prisma.ride.findMany({
      where: { id: { in: lowRatingCounts.map(l => l.rideId) } },
      select: { id: true, customerId: true },
    });
    for (const ride of ridesWithLowRatings) {
      const count = lowRatingsPerCustomer.get(ride.customerId) || 0;
      lowRatingsPerCustomer.set(ride.customerId, count + 1);
    }

    const recentOrdersByCustomer = new Map<string, typeof recentFoodOrders>();
    const recentRidesByCustomer = new Map<string, typeof recentRides>();
    for (const order of recentFoodOrders) {
      const orders = recentOrdersByCustomer.get(order.customerId) || [];
      orders.push(order);
      recentOrdersByCustomer.set(order.customerId, orders);
    }
    for (const ride of recentRides) {
      const rides = recentRidesByCustomer.get(ride.customerId) || [];
      rides.push(ride);
      recentRidesByCustomer.set(ride.customerId, rides);
    }

    const lifetimeFoodMap = new Map(lifetimeFoodOrders.map(f => [f.customerId, f._count.id]));
    const lifetimeRideMap = new Map(lifetimeRides.map(r => [r.customerId, r._count.id]));

    for (const customer of customers) {
      const customerId = customer.userId;
      const refundRequests = refundMap.get(customerId) || 0;
      const complaints = complaintMap.get(customerId) || 0;
      const lowRatings = lowRatingsPerCustomer.get(customerId) || 0;
      const customerOrders = recentOrdersByCustomer.get(customerId) || [];
      const customerRides = recentRidesByCustomer.get(customerId) || [];

      const indicators: string[] = [];
      let unhappinessScore = 0;

      if (refundRequests >= 2) {
        indicators.push(`${refundRequests} refund requests`);
        unhappinessScore += refundRequests * 15;
      }

      if (complaints >= 1) {
        indicators.push(`${complaints} complaints filed`);
        unhappinessScore += complaints * 20;
      }

      if (lowRatings >= 2) {
        indicators.push(`${lowRatings} low ratings given`);
        unhappinessScore += lowRatings * 10;
      }

      const cancelledOrders = customerOrders.filter(o => o.status.includes('cancelled_by_customer'));
      if (cancelledOrders.length >= 3) {
        indicators.push(`${cancelledOrders.length} cancelled orders`);
        unhappinessScore += cancelledOrders.length * 5;
      }

      const allOrders = [...customerOrders, ...customerRides];
      if (allOrders.length > 5) {
        const firstHalf = allOrders.slice(allOrders.length / 2);
        const secondHalf = allOrders.slice(0, allOrders.length / 2);
        if (secondHalf.length < firstHalf.length * 0.5) {
          indicators.push('Declining order frequency');
          unhappinessScore += 20;
        }
      }

      const lifetimeOrderCount = (lifetimeFoodMap.get(customerId) || 0) + (lifetimeRideMap.get(customerId) || 0);
      const lifetimeValue = lifetimeOrderCount * 25;

      if (unhappinessScore >= 20) {
        const lastOrder = customerOrders[0]?.createdAt || customerRides[0]?.createdAt || null;

        unhappyCustomers.push({
          customerId,
          customerName: customer.user?.fullName || 'Customer',
          email: customer.user?.email || '',
          unhappinessScore: Math.min(100, unhappinessScore),
          indicators,
          lastOrderDate: lastOrder,
          lifetimeValue,
          churnRisk: unhappinessScore >= 70 ? 'CRITICAL' : 
                    unhappinessScore >= 50 ? 'HIGH' : 
                    unhappinessScore >= 30 ? 'MEDIUM' : 'LOW',
          recommendedActions: this.generateRecommendedActions(unhappinessScore, indicators),
        });
      }
    }

    return unhappyCustomers.sort((a, b) => b.unhappinessScore - a.unhappinessScore);
  },

  generateRecommendedActions(score: number, indicators: string[]): string[] {
    const actions: string[] = [];

    if (score >= 70) {
      actions.push('Immediate personal outreach from support manager');
      actions.push('Offer significant compensation (30% off next 3 orders)');
    }

    if (indicators.some(i => i.includes('refund'))) {
      actions.push('Review refund history and identify root cause');
      actions.push('Offer dedicated support line');
    }

    if (indicators.some(i => i.includes('complaint'))) {
      actions.push('Personal apology from team lead');
      actions.push('Follow up on complaint resolution');
    }

    if (indicators.some(i => i.includes('low ratings'))) {
      actions.push('Provide free delivery on next order');
      actions.push('Match with higher-rated drivers');
    }

    if (indicators.some(i => i.includes('Declining'))) {
      actions.push('Send personalized re-engagement offer');
      actions.push('Highlight new features or restaurants');
    }

    if (actions.length === 0) {
      actions.push('Monitor closely for next 7 days');
      actions.push('Send satisfaction survey');
    }

    return actions;
  },

  /**
   * Generate apology messages
   */
  async generateApologyMessages(countryCode?: string): Promise<ApologyMessage[]> {
    const messages: ApologyMessage[] = [];
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const recentComplaints = await prisma.supportTicket.findMany({
      where: {
        createdAt: { gte: last7d },
        category: 'complaint',
        status: { in: ['resolved', 'closed'] },
        ...(countryCode ? { user: { countryCode } } : {}),
      },
      include: {
        user: true,
      },
      take: 100,
    });

    for (const complaint of recentComplaints) {
      const issueType = complaint.subject?.toLowerCase() || 'service issue';
      let messageTemplate = '';
      let offerType: ApologyMessage['offerType'] = 'NONE';
      let offerValue = '';
      let urgency: ApologyMessage['urgency'] = 'LOW';

      if (issueType.includes('late') || issueType.includes('delay')) {
        messageTemplate = `Hi ${complaint.user?.fullName?.split(' ')[0] || 'there'},\n\nWe sincerely apologize for the delay with your recent order. We understand your time is valuable, and we're working hard to prevent this from happening again.\n\nAs a token of our appreciation for your patience, we'd like to offer you free delivery on your next order.\n\nThank you for being a valued SafeGo customer!\n\nThe SafeGo Team`;
        offerType = 'FREE_DELIVERY';
        offerValue = 'Free delivery on next order';
        urgency = 'MEDIUM';
      } else if (issueType.includes('wrong') || issueType.includes('missing')) {
        messageTemplate = `Hi ${complaint.user?.fullName?.split(' ')[0] || 'there'},\n\nWe're truly sorry about the issue with your order. This isn't the experience we want for you.\n\nWe've credited 500 SafeGo points to your account as an apology. We're also reviewing this with our partner to ensure it doesn't happen again.\n\nThank you for your understanding.\n\nThe SafeGo Team`;
        offerType = 'POINTS';
        offerValue = '500 SafeGo Points';
        urgency = 'HIGH';
      } else if (issueType.includes('driver') || issueType.includes('behavior')) {
        messageTemplate = `Hi ${complaint.user?.fullName?.split(' ')[0] || 'there'},\n\nWe deeply apologize for your experience. This behavior is unacceptable and doesn't reflect our standards.\n\nWe've taken appropriate action with the driver involved. As an apology, please enjoy 20% off your next 3 orders with code WEBACK20.\n\nYour safety and satisfaction are our top priorities.\n\nThe SafeGo Team`;
        offerType = 'DISCOUNT';
        offerValue = '20% off next 3 orders (WEBACK20)';
        urgency = 'HIGH';
      } else {
        messageTemplate = `Hi ${complaint.user?.fullName?.split(' ')[0] || 'there'},\n\nWe're sorry to hear about your recent experience. Your feedback helps us improve.\n\nWe've addressed the issue and would love to make it up to you. Please enjoy 10% off your next order with code THANKYOU10.\n\nThank you for being part of SafeGo!\n\nThe SafeGo Team`;
        offerType = 'DISCOUNT';
        offerValue = '10% off (THANKYOU10)';
        urgency = 'MEDIUM';
      }

      messages.push({
        customerId: complaint.userId,
        customerName: complaint.user?.fullName || 'Customer',
        issueType,
        messageTemplate,
        offerType,
        offerValue,
        urgency,
      });
    }

    return messages.sort((a, b) => {
      const order = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return order[b.urgency] - order[a.urgency];
    });
  },

  /**
   * Generate win-back strategies using bulk queries
   */
  async generateWinBackStrategies(countryCode?: string): Promise<WinBackStrategy[]> {
    const strategies: WinBackStrategy[] = [];
    const inactiveThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const customers = await prisma.customerProfile.findMany({
      where: countryCode ? { user: { countryCode } } : {},
      include: { user: true },
      take: 500,
    });

    if (customers.length === 0) return [];

    const customerIds = customers.map(c => c.userId);

    const [
      lastFoodOrders,
      lastRides,
      orderCounts,
      orderTotals,
    ] = await Promise.all([
      prisma.foodOrder.findMany({
        where: { customerId: { in: customerIds } },
        orderBy: { createdAt: 'desc' },
        distinct: ['customerId'],
        select: { customerId: true, createdAt: true },
      }),
      prisma.ride.findMany({
        where: { customerId: { in: customerIds } },
        orderBy: { createdAt: 'desc' },
        distinct: ['customerId'],
        select: { customerId: true, createdAt: true },
      }),
      prisma.foodOrder.groupBy({
        by: ['customerId'],
        where: { customerId: { in: customerIds }, status: 'delivered' },
        _count: { id: true },
      }),
      prisma.foodOrder.groupBy({
        by: ['customerId'],
        where: { customerId: { in: customerIds }, status: 'delivered' },
        _sum: { serviceFare: true },
      }),
    ]);

    const lastFoodOrderMap = new Map(lastFoodOrders.map(o => [o.customerId, o.createdAt]));
    const lastRideMap = new Map(lastRides.map(r => [r.customerId, r.createdAt]));
    const orderCountMap = new Map(orderCounts.map(o => [o.customerId, o._count.id]));
    const orderTotalMap = new Map(orderTotals.map(o => [o.customerId, o._sum.serviceFare?.toNumber() || 0]));

    for (const customer of customers) {
      const customerId = customer.userId;
      const lastFoodOrder = lastFoodOrderMap.get(customerId);
      const lastRide = lastRideMap.get(customerId);
      
      const lastActivity = lastFoodOrder && lastRide 
        ? (lastFoodOrder > lastRide ? lastFoodOrder : lastRide)
        : lastFoodOrder || lastRide;

      if (!lastActivity || lastActivity > inactiveThreshold) continue;

      const daysSinceLastOrder = Math.floor(
        (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceLastOrder < 30) continue;

      const orderCount = orderCountMap.get(customerId) || 0;
      const totalSpent = orderTotalMap.get(customerId) || 0;
      const lifetimeValue = totalSpent + (orderCount * 15);

      let strategy: WinBackStrategy['strategy'];
      let message: string;
      let offerDetails: string;
      let expectedConversionRate: number;
      let priority: number;

      if (lifetimeValue > 500 && daysSinceLastOrder < 60) {
        strategy = 'PERSONALIZED_OFFER';
        message = `We miss you, ${customer.user?.fullName?.split(' ')[0] || 'friend'}! Your favorite restaurants have new dishes waiting for you.`;
        offerDetails = 'Personalized 25% off on previously ordered cuisines';
        expectedConversionRate = 35;
        priority = 100;
      } else if (lifetimeValue > 200 && daysSinceLastOrder < 90) {
        strategy = 'DISCOUNT';
        message = `It's been a while! Come back and enjoy 30% off your next order.`;
        offerDetails = '30% off with code COMEBACK30';
        expectedConversionRate = 25;
        priority = 85;
      } else if (orderCount >= 10) {
        strategy = 'LOYALTY_BONUS';
        message = `As a loyal customer, we've added bonus points to your account!`;
        offerDetails = '1000 bonus SafeGo points + double points on next 3 orders';
        expectedConversionRate = 30;
        priority = 80;
      } else if (daysSinceLastOrder > 90) {
        strategy = 'FREE_ITEM';
        message = `We'd love to welcome you back! Enjoy a free item on us.`;
        offerDetails = 'Free item up to $10 on orders over $20';
        expectedConversionRate = 20;
        priority = 70;
      } else {
        strategy = 'RE_ENGAGEMENT';
        message = `See what's new on SafeGo! New restaurants and features await.`;
        offerDetails = '15% off + free delivery on next order';
        expectedConversionRate = 15;
        priority = 60;
      }

      strategies.push({
        customerId,
        customerName: customer.user?.fullName || 'Customer',
        daysSinceLastOrder,
        lifetimeValue,
        strategy,
        message,
        offerDetails,
        expectedConversionRate,
        priority,
      });
    }

    return strategies.sort((a, b) => b.priority - a.priority);
  },

  /**
   * Predict customers likely to churn using bulk queries
   */
  async predictChurn(countryCode?: string): Promise<ChurnPrediction[]> {
    const predictions: ChurnPrediction[] = [];
    const last60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const customers = await prisma.customerProfile.findMany({
      where: countryCode ? { user: { countryCode } } : {},
      include: { user: true },
      take: 500,
    });

    if (customers.length === 0) return [];

    const customerIds = customers.map(c => c.userId);

    const [
      last60dOrderCounts,
      last30dOrderCounts,
      refundCounts,
      complaintCounts,
      lowRatingsWithRides,
    ] = await Promise.all([
      prisma.foodOrder.groupBy({
        by: ['customerId'],
        where: { customerId: { in: customerIds }, createdAt: { gte: last60d } },
        _count: { id: true },
      }),
      prisma.foodOrder.groupBy({
        by: ['customerId'],
        where: { customerId: { in: customerIds }, createdAt: { gte: last30d } },
        _count: { id: true },
      }),
      prisma.refundRequest.groupBy({
        by: ['customerId'],
        where: { customerId: { in: customerIds }, createdAt: { gte: last60d } },
        _count: { id: true },
      }),
      prisma.supportTicket.groupBy({
        by: ['userId'],
        where: { userId: { in: customerIds }, createdAt: { gte: last60d }, category: 'complaint' },
        _count: { id: true },
      }),
      prisma.rideRating.findMany({
        where: {
          ride: { customerId: { in: customerIds } },
          createdAt: { gte: last60d },
          rating: { lte: 2 },
        },
        include: { ride: { select: { customerId: true } } },
      }),
    ]);

    const last60dMap = new Map(last60dOrderCounts.map(o => [o.customerId, o._count.id]));
    const last30dMap = new Map(last30dOrderCounts.map(o => [o.customerId, o._count.id]));
    const refundMap = new Map(refundCounts.map(r => [r.customerId, r._count.id]));
    const complaintMap = new Map(complaintCounts.map(c => [c.userId, c._count.id]));
    
    const lowRatingsMap = new Map<string, number>();
    for (const rating of lowRatingsWithRides) {
      const customerId = rating.ride.customerId;
      lowRatingsMap.set(customerId, (lowRatingsMap.get(customerId) || 0) + 1);
    }

    for (const customer of customers) {
      const customerId = customer.userId;
      const last60dOrders = last60dMap.get(customerId) || 0;
      const last30dOrders = last30dMap.get(customerId) || 0;
      const refunds = refundMap.get(customerId) || 0;
      const complaints = complaintMap.get(customerId) || 0;
      const lowRatings = lowRatingsMap.get(customerId) || 0;

      if (last60dOrders < 2) continue;

      let churnProbability = 0;
      const riskFactors: string[] = [];

      const orderDecline = last60dOrders > 0 
        ? 1 - (last30dOrders * 2 / last60dOrders) 
        : 0;
      if (orderDecline > 0.5) {
        churnProbability += 30;
        riskFactors.push(`Order frequency dropped ${Math.round(orderDecline * 100)}%`);
      }

      if (refunds >= 2) {
        churnProbability += 20;
        riskFactors.push(`${refunds} refund requests in 60 days`);
      }

      if (complaints >= 1) {
        churnProbability += 25;
        riskFactors.push(`${complaints} complaints filed`);
      }

      if (lowRatings >= 2) {
        churnProbability += 15;
        riskFactors.push(`Given ${lowRatings} low ratings`);
      }

      if (churnProbability >= 40) {
        const retentionValue = last60dOrders * 25 * 6;

        predictions.push({
          customerId,
          customerName: customer.user?.fullName || 'Customer',
          churnProbability: Math.min(95, churnProbability),
          daysToChurn: Math.max(7, Math.round((100 - churnProbability) / 2)),
          riskFactors,
          retentionValue,
          recommendedIntervention: churnProbability >= 70
            ? 'Immediate personal outreach + significant offer'
            : churnProbability >= 50
              ? 'Win-back campaign + discount'
              : 'Engagement campaign + satisfaction survey',
        });
      }
    }

    return predictions.sort((a, b) => b.churnProbability - a.churnProbability);
  },

  /**
   * Get retention summary
   */
  async getDashboard(countryCode?: string): Promise<{
    unhappyCustomers: UnhappyCustomer[];
    winBackStrategies: WinBackStrategy[];
    churnPredictions: ChurnPrediction[];
    totalRetentionValue: number;
  }> {
    const [unhappy, winBack, churn] = await Promise.all([
      this.detectUnhappyCustomers(countryCode),
      this.generateWinBackStrategies(countryCode),
      this.predictChurn(countryCode),
    ]);

    return {
      unhappyCustomers: unhappy,
      winBackStrategies: winBack,
      churnPredictions: churn,
      totalRetentionValue: churn.reduce((sum, c) => sum + c.retentionValue, 0),
    };
  },

  async getRetentionSummary(countryCode?: string): Promise<{
    unhappyCustomerCount: number;
    criticalChurnRisk: number;
    pendingApologies: number;
    winBackCandidates: number;
    totalRetentionValue: number;
    avgChurnProbability: number;
  }> {
    const [unhappy, apologies, winBack, churn] = await Promise.all([
      this.detectUnhappyCustomers(countryCode),
      this.generateApologyMessages(countryCode),
      this.generateWinBackStrategies(countryCode),
      this.predictChurn(countryCode),
    ]);

    const avgChurn = churn.length > 0
      ? churn.reduce((sum, c) => sum + c.churnProbability, 0) / churn.length
      : 0;

    return {
      unhappyCustomerCount: unhappy.length,
      criticalChurnRisk: churn.filter(c => c.churnProbability >= 70).length,
      pendingApologies: apologies.length,
      winBackCandidates: winBack.length,
      totalRetentionValue: churn.reduce((sum, c) => sum + c.retentionValue, 0),
      avgChurnProbability: Math.round(avgChurn),
    };
  },
};
