import { prisma } from '../../db';

interface RefundAbuse {
  customerId: string;
  customerName: string;
  refundCount: number;
  totalRefundAmount: number;
  refundRate: number;
  riskScore: number;
  pattern: string;
  recommendation: string;
}

interface DiscountAbuse {
  entityType: 'CUSTOMER' | 'DRIVER' | 'RESTAURANT';
  entityId: string;
  entityName: string;
  discountCount: number;
  totalDiscountValue: number;
  suspicionLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  pattern: string;
  recommendation: string;
}

interface IncentiveOverspend {
  category: string;
  budgeted: number;
  actual: number;
  overspendAmount: number;
  overspendPercentage: number;
  affectedPartners: number;
  recommendation: string;
}

interface PayoutLeakage {
  type: 'DUPLICATE' | 'EXCESS' | 'FRAUDULENT' | 'TIMING';
  driverId: string;
  driverName: string;
  amount: number;
  reason: string;
  evidence: string[];
  recommendation: string;
}

interface CostPrediction {
  category: string;
  currentMonthSpend: number;
  projectedSpend: number;
  projectedLoss: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  preventiveActions: string[];
}

interface CostSavingAction {
  id: string;
  category: 'REFUND' | 'DISCOUNT' | 'INCENTIVE' | 'PAYOUT' | 'OPERATIONAL';
  title: string;
  description: string;
  estimatedSavings: number;
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
  priority: number;
  actionSteps: string[];
}

export const costReductionEngine = {
  /**
   * Detect unnecessary or abusive refunds
   */
  async detectRefundAbuse(countryCode?: string, days: number = 30): Promise<RefundAbuse[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const abusers: RefundAbuse[] = [];

    const refunds = await prisma.refundRequest.findMany({
      where: {
        createdAt: { gte: since },
        status: 'approved',
        ...(countryCode ? { customer: { user: { countryCode } } } : {}),
      },
      include: {
        customer: {
          include: { user: true },
        },
      },
      take: 500, // Limit for memory optimization
    });

    const customerRefunds = new Map<string, { 
      count: number; 
      total: number; 
      name: string;
      reasons: string[];
    }>();

    for (const refund of refunds) {
      const customerId = refund.customerId;
      const existing = customerRefunds.get(customerId) || { 
        count: 0, 
        total: 0, 
        name: refund.customer?.user?.fullName || 'Unknown',
        reasons: [],
      };
      
      existing.count++;
      existing.total += refund.amount?.toNumber() || 0;
      if (refund.reason) existing.reasons.push(refund.reason);
      
      customerRefunds.set(customerId, existing);
    }

    const customerIds = Array.from(customerRefunds.keys());
    
    const [foodOrders, rides] = await Promise.all([
      prisma.foodOrder.groupBy({
        by: ['customerId'],
        where: { 
          customerId: { in: customerIds },
          createdAt: { gte: since },
          ...(countryCode ? { customer: { user: { countryCode } } } : {}),
        },
        _count: { id: true },
      }),
      prisma.ride.groupBy({
        by: ['customerId'],
        where: { 
          customerId: { in: customerIds },
          createdAt: { gte: since },
          ...(countryCode ? { customer: { user: { countryCode } } } : {}),
        },
        _count: { id: true },
      }),
    ]);

    const orderCounts = new Map<string, number>();
    for (const o of foodOrders) {
      orderCounts.set(o.customerId, (orderCounts.get(o.customerId) || 0) + o._count.id);
    }
    for (const r of rides) {
      orderCounts.set(r.customerId, (orderCounts.get(r.customerId) || 0) + r._count.id);
    }

    for (const [customerId, data] of customerRefunds) {
      const customerOrders = orderCounts.get(customerId) || 0;
      const refundRate = customerOrders > 0 ? data.count / customerOrders : 0;

      if (data.count >= 3 || refundRate > 0.2 || data.total > 100) {
        const riskScore = Math.min(100, 
          (data.count * 10) + 
          (refundRate * 100) + 
          (data.total / 10)
        );

        const patterns: string[] = [];
        if (data.count >= 5) patterns.push('Frequent refunder');
        if (refundRate > 0.3) patterns.push('High refund rate');
        if (data.total > 200) patterns.push('High refund value');
        
        const uniqueReasons = [...new Set(data.reasons)];
        if (uniqueReasons.length === 1 && data.count > 3) {
          patterns.push('Same reason pattern');
        }

        abusers.push({
          customerId,
          customerName: data.name,
          refundCount: data.count,
          totalRefundAmount: data.total,
          refundRate: Math.round(refundRate * 100),
          riskScore: Math.round(riskScore),
          pattern: patterns.join(', ') || 'Multiple refunds',
          recommendation: riskScore > 70 
            ? 'Consider account review or temporary block'
            : riskScore > 50 
              ? 'Flag for manual review on next refund'
              : 'Monitor closely',
        });
      }
    }

    return abusers.sort((a, b) => b.riskScore - a.riskScore);
  },

  /**
   * Detect discount abuse patterns
   */
  async detectDiscountAbuse(countryCode?: string, days: number = 30): Promise<DiscountAbuse[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const abuses: DiscountAbuse[] = [];

    const couponUsages = await prisma.couponUsage.findMany({
      where: {
        usedAt: { gte: since },
        ...(countryCode ? { customer: { user: { countryCode } } } : {}),
      },
      include: {
        customer: {
          include: { user: true },
        },
        coupon: true,
      },
      take: 500, // Limit for memory optimization
    });

    const customerCoupons = new Map<string, {
      count: number;
      total: number;
      name: string;
      codes: string[];
    }>();

    for (const usage of couponUsages) {
      const customerId = usage.customerId;
      const existing = customerCoupons.get(customerId) || {
        count: 0,
        total: 0,
        name: usage.customer?.user?.fullName || 'Unknown',
        codes: [],
      };

      existing.count++;
      existing.total += usage.coupon?.discountAmount?.toNumber() || 0;
      if (usage.coupon?.code) existing.codes.push(usage.coupon.code);

      customerCoupons.set(customerId, existing);
    }

    for (const [customerId, data] of customerCoupons) {
      if (data.count >= 5 || data.total > 50) {
        const uniqueCodes = [...new Set(data.codes)];
        const suspicionLevel = 
          data.count >= 10 || data.total > 100 ? 'CRITICAL' :
          data.count >= 7 || data.total > 75 ? 'HIGH' :
          data.count >= 5 ? 'MEDIUM' : 'LOW';

        abuses.push({
          entityType: 'CUSTOMER',
          entityId: customerId,
          entityName: data.name,
          discountCount: data.count,
          totalDiscountValue: data.total,
          suspicionLevel,
          pattern: uniqueCodes.length < data.count / 2 
            ? 'Reusing similar codes' 
            : 'Multiple unique codes',
          recommendation: suspicionLevel === 'CRITICAL'
            ? 'Block from future promotions'
            : suspicionLevel === 'HIGH'
              ? 'Limit to 1 coupon per week'
              : 'Standard monitoring',
        });
      }
    }

    return abuses.sort((a, b) => {
      const order = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      return order[b.suspicionLevel] - order[a.suspicionLevel];
    });
  },

  /**
   * Detect incentive overspend
   */
  async detectIncentiveOverspend(countryCode?: string): Promise<IncentiveOverspend[]> {
    const overspends: IncentiveOverspend[] = [];
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const driverIncentives = await prisma.driverIncentive.findMany({
      where: {
        createdAt: { gte: thisMonth },
        status: 'completed',
        ...(countryCode ? { driver: { user: { countryCode } } } : {}),
      },
    });

    const totalDriverIncentives = driverIncentives.reduce(
      (sum, i) => sum + (i.amount?.toNumber() || 0), 
      0
    );

    const monthlyBudget = 10000;
    const dayOfMonth = new Date().getDate();
    const expectedSpend = (monthlyBudget / 30) * dayOfMonth;

    if (totalDriverIncentives > expectedSpend * 1.2) {
      overspends.push({
        category: 'Driver Incentives',
        budgeted: monthlyBudget,
        actual: totalDriverIncentives,
        overspendAmount: totalDriverIncentives - expectedSpend,
        overspendPercentage: Math.round(((totalDriverIncentives - expectedSpend) / expectedSpend) * 100),
        affectedPartners: driverIncentives.length,
        recommendation: 'Review incentive criteria - consider tightening qualification requirements',
      });
    }

    const referralBonuses = await prisma.referralBonus.findMany({
      where: {
        createdAt: { gte: thisMonth },
        status: 'paid',
        ...(countryCode ? { referrer: { countryCode } } : {}),
      },
    });

    const totalReferralBonuses = referralBonuses.reduce(
      (sum, r) => sum + (r.amount?.toNumber() || 0),
      0
    );

    const referralBudget = 5000;
    const expectedReferralSpend = (referralBudget / 30) * dayOfMonth;

    if (totalReferralBonuses > expectedReferralSpend * 1.3) {
      overspends.push({
        category: 'Referral Bonuses',
        budgeted: referralBudget,
        actual: totalReferralBonuses,
        overspendAmount: totalReferralBonuses - expectedReferralSpend,
        overspendPercentage: Math.round(((totalReferralBonuses - expectedReferralSpend) / expectedReferralSpend) * 100),
        affectedPartners: referralBonuses.length,
        recommendation: 'Temporarily reduce referral bonus or add stricter ride requirements',
      });
    }

    return overspends;
  },

  /**
   * Detect payout leakage
   */
  async detectPayoutLeakage(countryCode?: string, days: number = 30): Promise<PayoutLeakage[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const leakages: PayoutLeakage[] = [];

    const payouts = await prisma.payout.findMany({
      where: {
        createdAt: { gte: since },
        status: 'completed',
        ...(countryCode ? { driver: { user: { countryCode } } } : {}),
      },
      include: {
        driver: {
          include: { user: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500, // Limit for memory optimization
    });

    const driverPayouts = new Map<string, typeof payouts>();
    for (const payout of payouts) {
      const driverId = payout.driverId;
      const existing = driverPayouts.get(driverId) || [];
      existing.push(payout);
      driverPayouts.set(driverId, existing);
    }

    for (const [driverId, driverPayoutList] of driverPayouts) {
      for (let i = 0; i < driverPayoutList.length - 1; i++) {
        const current = driverPayoutList[i];
        const next = driverPayoutList[i + 1];

        const timeDiff = current.createdAt.getTime() - next.createdAt.getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);

        if (hoursDiff < 24 && 
            current.amount?.equals(next.amount || 0) &&
            current.paymentMethod === next.paymentMethod) {
          leakages.push({
            type: 'DUPLICATE',
            driverId,
            driverName: current.driver?.user?.fullName || 'Unknown',
            amount: current.amount?.toNumber() || 0,
            reason: 'Potential duplicate payout detected',
            evidence: [
              `Two payouts of $${current.amount?.toNumber()} within ${Math.round(hoursDiff)} hours`,
              `Same payment method: ${current.paymentMethod}`,
            ],
            recommendation: 'Review and potentially reverse duplicate payout',
          });
        }
      }

      const wallet = await prisma.driverWallet.findUnique({
        where: { driverId },
      });

      const totalPaid = driverPayoutList.reduce(
        (sum, p) => sum + (p.amount?.toNumber() || 0), 
        0
      );
      const walletBalance = wallet?.balance?.toNumber() || 0;

      if (totalPaid > walletBalance * 1.5 && walletBalance > 0) {
        leakages.push({
          type: 'EXCESS',
          driverId,
          driverName: driverPayoutList[0]?.driver?.user?.fullName || 'Unknown',
          amount: totalPaid - walletBalance,
          reason: 'Total payouts exceed expected earnings',
          evidence: [
            `Total paid: $${totalPaid}`,
            `Expected max: $${walletBalance * 1.5}`,
          ],
          recommendation: 'Audit driver earnings and payout history',
        });
      }
    }

    return leakages;
  },

  /**
   * Predict potential company losses
   */
  async predictLosses(countryCode?: string): Promise<CostPrediction[]> {
    const predictions: CostPrediction[] = [];
    const thisMonth = new Date();
    thisMonth.setDate(1);

    const [refundAbuse, discountAbuse, incentiveOverspend, payoutLeakage] = await Promise.all([
      this.detectRefundAbuse(countryCode, 30),
      this.detectDiscountAbuse(countryCode, 30),
      this.detectIncentiveOverspend(countryCode),
      this.detectPayoutLeakage(countryCode, 30),
    ]);

    const refundTotal = refundAbuse.reduce((sum, r) => sum + r.totalRefundAmount, 0);
    if (refundTotal > 500) {
      predictions.push({
        category: 'Refund Abuse',
        currentMonthSpend: refundTotal,
        projectedSpend: refundTotal * 1.2,
        projectedLoss: refundTotal * 0.3,
        riskLevel: refundTotal > 2000 ? 'HIGH' : 'MEDIUM',
        preventiveActions: [
          'Implement stricter refund approval criteria',
          'Require photo evidence for delivery issues',
          'Add cooldown period between refunds',
        ],
      });
    }

    const discountTotal = discountAbuse.reduce((sum, d) => sum + d.totalDiscountValue, 0);
    if (discountTotal > 200) {
      predictions.push({
        category: 'Discount Abuse',
        currentMonthSpend: discountTotal,
        projectedSpend: discountTotal * 1.3,
        projectedLoss: discountTotal * 0.5,
        riskLevel: discountTotal > 1000 ? 'HIGH' : 'MEDIUM',
        preventiveActions: [
          'Limit coupons to verified accounts only',
          'Implement device fingerprinting',
          'Reduce maximum discount per customer per month',
        ],
      });
    }

    for (const overspend of incentiveOverspend) {
      predictions.push({
        category: overspend.category,
        currentMonthSpend: overspend.actual,
        projectedSpend: overspend.actual * 1.1,
        projectedLoss: overspend.overspendAmount,
        riskLevel: overspend.overspendPercentage > 50 ? 'CRITICAL' : 'HIGH',
        preventiveActions: [
          overspend.recommendation,
          'Set hard spending caps per category',
          'Review qualification criteria weekly',
        ],
      });
    }

    const leakageTotal = payoutLeakage.reduce((sum, l) => sum + l.amount, 0);
    if (leakageTotal > 100) {
      predictions.push({
        category: 'Payout Leakage',
        currentMonthSpend: leakageTotal,
        projectedSpend: leakageTotal,
        projectedLoss: leakageTotal,
        riskLevel: leakageTotal > 500 ? 'CRITICAL' : 'HIGH',
        preventiveActions: [
          'Implement duplicate payout detection',
          'Require manager approval for large payouts',
          'Automated reconciliation checks',
        ],
      });
    }

    return predictions.sort((a, b) => {
      const order = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      return order[b.riskLevel] - order[a.riskLevel];
    });
  },

  /**
   * Generate cost saving actions
   */
  async generateCostSavingActions(countryCode?: string): Promise<CostSavingAction[]> {
    const actions: CostSavingAction[] = [];
    const predictions = await this.predictLosses(countryCode);

    for (const prediction of predictions) {
      const actionId = `cost-${prediction.category.toLowerCase().replace(/\s+/g, '-')}`;
      
      actions.push({
        id: actionId,
        category: prediction.category.includes('Refund') ? 'REFUND' :
                 prediction.category.includes('Discount') ? 'DISCOUNT' :
                 prediction.category.includes('Incentive') ? 'INCENTIVE' :
                 prediction.category.includes('Payout') ? 'PAYOUT' : 'OPERATIONAL',
        title: `Reduce ${prediction.category} Loss`,
        description: `Projected loss of $${prediction.projectedLoss.toFixed(2)} this month`,
        estimatedSavings: prediction.projectedLoss * 0.7,
        effort: prediction.riskLevel === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
        priority: prediction.riskLevel === 'CRITICAL' ? 100 : 
                 prediction.riskLevel === 'HIGH' ? 80 : 60,
        actionSteps: prediction.preventiveActions,
      });
    }

    return actions.sort((a, b) => b.priority - a.priority);
  },

  /**
   * Get dashboard data for Vision 2030 module endpoint
   */
  async getDashboard(countryCode?: string): Promise<{
    totalPotentialSavings: number;
    refundAbusers: Array<{ customerId: string; estimatedLoss: number }>;
    discountAbusers: Array<{ entityId: string; suspicionLevel: string }>;
    incentiveOverspend: Array<{ category: string; overspendAmount: number }>;
    payoutLeakage: Array<{ driverId: string; amount: number }>;
  }> {
    const [refunds, discounts, incentives, payouts, actions] = await Promise.all([
      this.detectRefundAbuse(countryCode),
      this.detectDiscountAbuse(countryCode),
      this.detectIncentiveOverspend(countryCode),
      this.detectPayoutLeakage(countryCode),
      this.generateCostSavingActions(countryCode),
    ]);

    const totalSavings = actions.reduce((sum, a) => sum + a.estimatedSavings, 0);

    return {
      totalPotentialSavings: Math.round(totalSavings),
      refundAbusers: refunds.map(r => ({ customerId: r.customerId, estimatedLoss: r.totalRefundAmount })),
      discountAbusers: discounts.map(d => ({ entityId: d.entityId, suspicionLevel: d.suspicionLevel })),
      incentiveOverspend: incentives.map(i => ({ category: i.category, overspendAmount: i.overspendAmount })),
      payoutLeakage: payouts.map(p => ({ driverId: p.driverId, amount: p.amount })),
    };
  },

  /**
   * Get cost reduction summary
   */
  async getCostSummary(countryCode?: string): Promise<{
    totalPotentialSavings: number;
    refundAbuserCount: number;
    discountAbuserCount: number;
    incentiveOverspendCount: number;
    payoutLeakageCount: number;
    criticalIssues: number;
    topActions: CostSavingAction[];
  }> {
    const [refunds, discounts, incentives, payouts, actions] = await Promise.all([
      this.detectRefundAbuse(countryCode),
      this.detectDiscountAbuse(countryCode),
      this.detectIncentiveOverspend(countryCode),
      this.detectPayoutLeakage(countryCode),
      this.generateCostSavingActions(countryCode),
    ]);

    const totalSavings = actions.reduce((sum, a) => sum + a.estimatedSavings, 0);
    const criticalIssues = 
      refunds.filter(r => r.riskScore > 80).length +
      discounts.filter(d => d.suspicionLevel === 'CRITICAL').length +
      incentives.filter(i => i.overspendPercentage > 50).length +
      payouts.filter(p => p.type === 'FRAUDULENT' || p.amount > 500).length;

    return {
      totalPotentialSavings: Math.round(totalSavings),
      refundAbuserCount: refunds.length,
      discountAbuserCount: discounts.length,
      incentiveOverspendCount: incentives.length,
      payoutLeakageCount: payouts.length,
      criticalIssues,
      topActions: actions.slice(0, 5),
    };
  },
};
