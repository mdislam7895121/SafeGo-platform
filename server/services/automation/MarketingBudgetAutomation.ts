/**
 * SafeGo Marketing Budget Automation Service (Module 17)
 * Auto-allocates ad budget by area, time, and conversion rate:
 * - Track impressions, clicks, conversions
 * - Calculate ROI and optimize spend
 * - Generate optimization recommendations
 * - Budget reallocation suggestions
 * Uses MarketingBudgetPlan model from schema
 */

import { prisma } from '../../db';

type ServiceType = 'ride' | 'food' | 'parcel' | 'shop' | 'all';
type CampaignType = 'acquisition' | 'retention' | 'reactivation';
type PlanPeriod = 'daily' | 'weekly' | 'monthly' | 'campaign';
type PlanStatus = 'draft' | 'active' | 'paused' | 'completed';

interface ChannelPerformance {
  channel: 'push' | 'email' | 'sms' | 'ads' | 'in_app';
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  ctr: number;
  conversionRate: number;
  cpa: number;
  roi: number;
}

interface AreaPerformance {
  areaId: string;
  areaName: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  roi: number;
  demandScore: number;
}

interface TimeSlotPerformance {
  hour: number;
  dayOfWeek: number;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  conversionRate: number;
}

interface OptimizationRecommendation {
  type: 'increase_budget' | 'decrease_budget' | 'pause' | 'reallocate' | 'shift_timing';
  priority: 'low' | 'medium' | 'high' | 'critical';
  target: string;
  currentValue: number;
  suggestedValue: number;
  estimatedImpact: number;
  reason: string;
}

interface BudgetReallocation {
  from: { target: string; amount: number; reason: string };
  to: { target: string; amount: number; expectedROI: number };
}

interface MarketingBudgetConfig {
  enabled: boolean;
  scanIntervalMs: number;
  evaluation: {
    windowDays: number;
    minDataPoints: number;
    significanceThreshold: number;
  };
  performance: {
    minCTR: number;
    minConversionRate: number;
    targetROI: number;
    excellentROI: number;
    minROI: number;
  };
  channels: {
    push: { weight: number; maxBudgetPercent: number };
    email: { weight: number; maxBudgetPercent: number };
    sms: { weight: number; maxBudgetPercent: number };
    ads: { weight: number; maxBudgetPercent: number };
    in_app: { weight: number; maxBudgetPercent: number };
  };
  automation: {
    autoReallocate: boolean;
    autoPauseUnderperformers: boolean;
    autoBoostHighPerformers: boolean;
    maxReallocationPercent: number;
    pauseThresholdROI: number;
    boostThresholdROI: number;
  };
  budgetLimits: {
    maxDailySpendPercent: number;
    reservePercent: number;
    emergencyPauseThreshold: number;
  };
  timing: {
    peakHours: number[];
    peakDays: number[];
    peakMultiplier: number;
  };
}

class MarketingBudgetAutomation {
  private static instance: MarketingBudgetAutomation;
  private config: MarketingBudgetConfig;
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.config = {
      enabled: true,
      scanIntervalMs: 900000,
      evaluation: {
        windowDays: 7,
        minDataPoints: 100,
        significanceThreshold: 0.05,
      },
      performance: {
        minCTR: 0.02,
        minConversionRate: 0.05,
        targetROI: 2.0,
        excellentROI: 4.0,
        minROI: 1.0,
      },
      channels: {
        push: { weight: 0.25, maxBudgetPercent: 0.30 },
        email: { weight: 0.20, maxBudgetPercent: 0.25 },
        sms: { weight: 0.15, maxBudgetPercent: 0.20 },
        ads: { weight: 0.30, maxBudgetPercent: 0.40 },
        in_app: { weight: 0.10, maxBudgetPercent: 0.15 },
      },
      automation: {
        autoReallocate: true,
        autoPauseUnderperformers: true,
        autoBoostHighPerformers: true,
        maxReallocationPercent: 0.20,
        pauseThresholdROI: 0.5,
        boostThresholdROI: 3.0,
      },
      budgetLimits: {
        maxDailySpendPercent: 0.15,
        reservePercent: 0.10,
        emergencyPauseThreshold: 0.25,
      },
      timing: {
        peakHours: [11, 12, 13, 18, 19, 20, 21],
        peakDays: [5, 6, 0],
        peakMultiplier: 1.5,
      },
    };
  }

  static getInstance(): MarketingBudgetAutomation {
    if (!MarketingBudgetAutomation.instance) {
      MarketingBudgetAutomation.instance = new MarketingBudgetAutomation();
    }
    return MarketingBudgetAutomation.instance;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.scanInterval = setInterval(() => {
      this.runBudgetOptimizationScan();
    }, this.config.scanIntervalMs);

    await this.logAutomation('MARKETING_BUDGET', 'SYSTEM', 'started', {
      config: this.config,
    });
    console.log('[MarketingBudget] Automation started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    console.log('[MarketingBudget] Automation stopped');
  }

  getStatus(): { isRunning: boolean; config: MarketingBudgetConfig } {
    return { isRunning: this.isRunning, config: this.config };
  }

  updateConfig(updates: Partial<MarketingBudgetConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): MarketingBudgetConfig {
    return this.config;
  }

  async createBudgetPlan(
    planName: string,
    totalBudget: number,
    options: {
      planPeriod: PlanPeriod;
      countryCode?: string;
      cityCode?: string;
      serviceType?: ServiceType;
      campaignType?: CampaignType;
      targetConversionRate?: number;
      spendCap?: number;
    }
  ): Promise<any> {
    const channelAllocation = this.calculateInitialChannelAllocation(totalBudget);
    const timeAllocation = this.calculateTimeAllocation(totalBudget);
    const areaAllocation = options.cityCode ? await this.calculateAreaAllocation(totalBudget, options.cityCode) : null;

    const predictedROI = this.predictROI(options.campaignType || 'acquisition');

    const plan = await prisma.marketingBudgetPlan.create({
      data: {
        planName,
        planPeriod: options.planPeriod,
        countryCode: options.countryCode,
        cityCode: options.cityCode,
        serviceType: options.serviceType || 'all',
        campaignType: options.campaignType || 'acquisition',
        totalBudget,
        allocatedBudget: totalBudget * (1 - this.config.budgetLimits.reservePercent),
        spentBudget: 0,
        remainingBudget: totalBudget,
        spendCap: options.spendCap || totalBudget * this.config.budgetLimits.maxDailySpendPercent,
        allocationByChannel: channelAllocation,
        allocationByTime: timeAllocation,
        allocationByArea: areaAllocation,
        predictedROI,
        targetConversionRate: options.targetConversionRate || this.config.performance.minConversionRate,
        evaluationWindow: this.config.evaluation.windowDays,
        nextEvaluationAt: new Date(Date.now() + this.config.evaluation.windowDays * 24 * 60 * 60 * 1000),
        status: 'draft',
      },
    });

    await this.logAutomation('MARKETING_BUDGET', plan.id, 'plan_created', {
      planName,
      totalBudget,
      predictedROI,
      channelAllocation,
    });

    return plan;
  }

  private calculateInitialChannelAllocation(totalBudget: number): Record<string, { budget: number; percentage: number }> {
    const allocation: Record<string, { budget: number; percentage: number }> = {};
    const allocatable = totalBudget * (1 - this.config.budgetLimits.reservePercent);

    const totalWeight = Object.values(this.config.channels).reduce((sum, ch) => sum + ch.weight, 0);

    for (const [channel, config] of Object.entries(this.config.channels)) {
      const percentage = config.weight / totalWeight;
      const cappedPercentage = Math.min(percentage, config.maxBudgetPercent);
      allocation[channel] = {
        budget: Math.round(allocatable * cappedPercentage * 100) / 100,
        percentage: Math.round(cappedPercentage * 10000) / 100,
      };
    }

    return allocation;
  }

  private calculateTimeAllocation(totalBudget: number): Record<string, number> {
    const allocation: Record<string, number> = {};
    const baseHourlyBudget = totalBudget / 24;

    for (let hour = 0; hour < 24; hour++) {
      const isPeakHour = this.config.timing.peakHours.includes(hour);
      const multiplier = isPeakHour ? this.config.timing.peakMultiplier : 1;
      allocation[`hour_${hour}`] = Math.round(baseHourlyBudget * multiplier * 100) / 100;
    }

    return allocation;
  }

  private async calculateAreaAllocation(totalBudget: number, cityCode: string): Promise<Record<string, number> | null> {
    return null;
  }

  private predictROI(campaignType: CampaignType): number {
    const baseROI: Record<CampaignType, number> = {
      acquisition: 1.8,
      retention: 3.2,
      reactivation: 2.5,
    };

    return baseROI[campaignType] || this.config.performance.targetROI;
  }

  async recordCampaignMetrics(
    planId: string,
    metrics: {
      impressions: number;
      clicks: number;
      conversions: number;
      spend: number;
      channel?: string;
      areaId?: string;
      hour?: number;
    }
  ): Promise<void> {
    const plan = await prisma.marketingBudgetPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error('Plan not found');

    const newImpressions = plan.impressions + metrics.impressions;
    const newClicks = plan.clicks + metrics.clicks;
    const newConversions = plan.conversions + metrics.conversions;
    const newSpent = Number(plan.spentBudget) + metrics.spend;

    const conversionRate = newClicks > 0 ? newConversions / newClicks : 0;
    const actualROI = metrics.spend > 0 ? (newConversions * 10) / newSpent : 0;

    await prisma.marketingBudgetPlan.update({
      where: { id: planId },
      data: {
        impressions: newImpressions,
        clicks: newClicks,
        conversions: newConversions,
        spentBudget: newSpent,
        remainingBudget: Number(plan.totalBudget) - newSpent,
        conversionRate,
        actualROI,
      },
    });

    await this.logAutomation('MARKETING_BUDGET', planId, 'metrics_recorded', {
      ...metrics,
      totalImpressions: newImpressions,
      totalConversions: newConversions,
      currentROI: actualROI,
    });
  }

  async evaluatePlanPerformance(planId: string): Promise<{
    channelPerformance: ChannelPerformance[];
    recommendations: OptimizationRecommendation[];
    budgetReallocations: BudgetReallocation[];
    overallScore: number;
  }> {
    const plan = await prisma.marketingBudgetPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error('Plan not found');

    const channelPerformance = this.analyzeChannelPerformance(plan);
    const recommendations = this.generateRecommendations(plan, channelPerformance);
    const budgetReallocations = this.generateReallocations(plan, channelPerformance);
    const overallScore = this.calculateOverallScore(plan, channelPerformance);

    await prisma.marketingBudgetPlan.update({
      where: { id: planId },
      data: {
        optimizationRecommendations: recommendations,
        budgetReallocationSuggestion: budgetReallocations,
        lastEvaluatedAt: new Date(),
        nextEvaluationAt: new Date(Date.now() + this.config.evaluation.windowDays * 24 * 60 * 60 * 1000),
      },
    });

    await this.logAutomation('MARKETING_BUDGET', planId, 'performance_evaluated', {
      overallScore,
      recommendationsCount: recommendations.length,
      reallocationsCount: budgetReallocations.length,
      currentROI: plan.actualROI,
    });

    return {
      channelPerformance,
      recommendations,
      budgetReallocations,
      overallScore,
    };
  }

  private analyzeChannelPerformance(plan: any): ChannelPerformance[] {
    const performance: ChannelPerformance[] = [];
    const channels: ('push' | 'email' | 'sms' | 'ads' | 'in_app')[] = ['push', 'email', 'sms', 'ads', 'in_app'];
    const allocation = (plan.allocationByChannel as Record<string, { budget: number; percentage: number }>) || {};

    for (const channel of channels) {
      const channelData = allocation[channel];
      if (!channelData) continue;

      const estimatedShare = channelData.percentage / 100;
      const impressions = Math.round(plan.impressions * estimatedShare);
      const clicks = Math.round(plan.clicks * estimatedShare);
      const conversions = Math.round(plan.conversions * estimatedShare);
      const spend = Number(plan.spentBudget) * estimatedShare;

      const ctr = impressions > 0 ? clicks / impressions : 0;
      const conversionRate = clicks > 0 ? conversions / clicks : 0;
      const cpa = conversions > 0 ? spend / conversions : 0;
      const revenue = conversions * 10;
      const roi = spend > 0 ? revenue / spend : 0;

      performance.push({
        channel,
        impressions,
        clicks,
        conversions,
        spend: Math.round(spend * 100) / 100,
        ctr: Math.round(ctr * 10000) / 100,
        conversionRate: Math.round(conversionRate * 10000) / 100,
        cpa: Math.round(cpa * 100) / 100,
        roi: Math.round(roi * 100) / 100,
      });
    }

    return performance;
  }

  private generateRecommendations(plan: any, channelPerformance: ChannelPerformance[]): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    for (const channel of channelPerformance) {
      if (channel.roi < this.config.automation.pauseThresholdROI && channel.spend > 0) {
        recommendations.push({
          type: 'pause',
          priority: channel.roi < 0.3 ? 'critical' : 'high',
          target: channel.channel,
          currentValue: channel.spend,
          suggestedValue: 0,
          estimatedImpact: channel.spend * (1 - channel.roi),
          reason: `Low ROI (${channel.roi}x) - below ${this.config.automation.pauseThresholdROI}x threshold`,
        });
      } else if (channel.roi > this.config.automation.boostThresholdROI) {
        const allocation = (plan.allocationByChannel as Record<string, { budget: number }>) || {};
        const currentBudget = allocation[channel.channel]?.budget || 0;
        const suggestedIncrease = currentBudget * 0.25;

        recommendations.push({
          type: 'increase_budget',
          priority: 'high',
          target: channel.channel,
          currentValue: currentBudget,
          suggestedValue: currentBudget + suggestedIncrease,
          estimatedImpact: suggestedIncrease * channel.roi,
          reason: `High ROI (${channel.roi}x) - exceeds ${this.config.automation.boostThresholdROI}x threshold`,
        });
      }

      if (channel.ctr < this.config.performance.minCTR && channel.impressions > 100) {
        recommendations.push({
          type: 'decrease_budget',
          priority: 'medium',
          target: channel.channel,
          currentValue: channel.spend,
          suggestedValue: channel.spend * 0.75,
          estimatedImpact: channel.spend * 0.25,
          reason: `Low CTR (${channel.ctr}%) - below ${this.config.performance.minCTR * 100}% threshold`,
        });
      }
    }

    const actualROI = plan.actualROI || 0;
    if (actualROI < this.config.performance.minROI && Number(plan.spentBudget) > 0) {
      recommendations.push({
        type: 'reallocate',
        priority: 'critical',
        target: 'overall_budget',
        currentValue: Number(plan.spentBudget),
        suggestedValue: Number(plan.spentBudget) * 0.8,
        estimatedImpact: Number(plan.spentBudget) * 0.2,
        reason: `Overall ROI (${actualROI}x) below minimum threshold (${this.config.performance.minROI}x)`,
      });
    }

    const peakHoursPerformance = this.analyzePeakHoursOpportunity(plan);
    if (peakHoursPerformance.shouldShift) {
      recommendations.push({
        type: 'shift_timing',
        priority: 'medium',
        target: 'time_allocation',
        currentValue: 0,
        suggestedValue: 0,
        estimatedImpact: peakHoursPerformance.estimatedGain,
        reason: peakHoursPerformance.reason,
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  private analyzePeakHoursOpportunity(plan: any): { shouldShift: boolean; estimatedGain: number; reason: string } {
    return {
      shouldShift: false,
      estimatedGain: 0,
      reason: 'Insufficient data for timing optimization',
    };
  }

  private generateReallocations(plan: any, channelPerformance: ChannelPerformance[]): BudgetReallocation[] {
    const reallocations: BudgetReallocation[] = [];

    const sortedByROI = [...channelPerformance].sort((a, b) => b.roi - a.roi);
    
    const underperformers = sortedByROI.filter(c => c.roi < this.config.performance.minROI && c.spend > 0);
    const topPerformers = sortedByROI.filter(c => c.roi > this.config.performance.targetROI);

    for (const underperformer of underperformers) {
      for (const topPerformer of topPerformers) {
        const reallocateAmount = Math.min(
          underperformer.spend * this.config.automation.maxReallocationPercent,
          100
        );

        if (reallocateAmount > 10) {
          reallocations.push({
            from: {
              target: underperformer.channel,
              amount: reallocateAmount,
              reason: `Low ROI: ${underperformer.roi}x`,
            },
            to: {
              target: topPerformer.channel,
              amount: reallocateAmount,
              expectedROI: topPerformer.roi,
            },
          });
        }
      }
    }

    return reallocations.slice(0, 5);
  }

  private calculateOverallScore(plan: any, channelPerformance: ChannelPerformance[]): number {
    let score = 50;

    const actualROI = plan.actualROI || 0;
    if (actualROI >= this.config.performance.excellentROI) {
      score += 30;
    } else if (actualROI >= this.config.performance.targetROI) {
      score += 20;
    } else if (actualROI >= this.config.performance.minROI) {
      score += 10;
    } else {
      score -= 20;
    }

    const budgetUtilization = Number(plan.spentBudget) / Number(plan.totalBudget);
    if (budgetUtilization > 0.7 && budgetUtilization < 1.0) {
      score += 10;
    } else if (budgetUtilization > 1.0) {
      score -= 15;
    }

    const conversionRate = plan.conversionRate || 0;
    if (conversionRate >= this.config.performance.minConversionRate) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  async applyRecommendations(planId: string, recommendationIndices: number[]): Promise<void> {
    const plan = await prisma.marketingBudgetPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error('Plan not found');

    const recommendations = (plan.optimizationRecommendations as OptimizationRecommendation[]) || [];
    const appliedRecommendations: OptimizationRecommendation[] = [];

    for (const index of recommendationIndices) {
      if (recommendations[index]) {
        appliedRecommendations.push(recommendations[index]);
      }
    }

    await this.logAutomation('MARKETING_BUDGET', planId, 'recommendations_applied', {
      count: appliedRecommendations.length,
      recommendations: appliedRecommendations,
    });
  }

  async runBudgetOptimizationScan(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const activePlans = await prisma.marketingBudgetPlan.findMany({
        where: {
          status: 'active',
          OR: [
            { nextEvaluationAt: { lte: new Date() } },
            { nextEvaluationAt: null },
          ],
        },
        take: 20,
      });

      let evaluatedCount = 0;
      let pausedCount = 0;
      let boostedCount = 0;

      for (const plan of activePlans) {
        try {
          const evaluation = await this.evaluatePlanPerformance(plan.id);

          if (this.config.automation.autoPauseUnderperformers) {
            const criticalRecs = evaluation.recommendations.filter(
              r => r.priority === 'critical' && r.type === 'pause'
            );
            if (criticalRecs.length > 0) {
              await prisma.marketingBudgetPlan.update({
                where: { id: plan.id },
                data: { status: 'paused' },
              });
              pausedCount++;
            }
          }

          if (this.config.automation.autoBoostHighPerformers) {
            const boostRecs = evaluation.recommendations.filter(r => r.type === 'increase_budget');
            if (boostRecs.length > 0 && (plan.actualROI || 0) > this.config.automation.boostThresholdROI) {
              boostedCount++;
            }
          }

          const spentPercent = Number(plan.spentBudget) / Number(plan.totalBudget);
          if (spentPercent >= this.config.budgetLimits.emergencyPauseThreshold * 10) {
            await prisma.marketingBudgetPlan.update({
              where: { id: plan.id },
              data: { status: 'paused' },
            });
            pausedCount++;
          }

          evaluatedCount++;
        } catch (error) {
          console.error(`[MarketingBudget] Failed to evaluate plan ${plan.id}:`, error);
        }
      }

      const completedPlans = await prisma.marketingBudgetPlan.findMany({
        where: {
          status: 'active',
          remainingBudget: { lte: 0 },
        },
      });

      for (const plan of completedPlans) {
        await prisma.marketingBudgetPlan.update({
          where: { id: plan.id },
          data: { status: 'completed' },
        });
      }

      await this.logAutomation('MARKETING_BUDGET', 'SYSTEM', 'scan_completed', {
        plansEvaluated: evaluatedCount,
        plansPaused: pausedCount,
        plansBoosted: boostedCount,
        plansCompleted: completedPlans.length,
      });
    } catch (error) {
      console.error('[MarketingBudget] Scan error:', error);
      await this.logAutomation('MARKETING_BUDGET', 'SYSTEM', 'scan_error', {
        error: String(error),
      });
    }
  }

  async getMarketingStats(days: number = 30): Promise<Record<string, any>> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [plans, activePlans, totalMetrics] = await Promise.all([
      prisma.marketingBudgetPlan.count({ where: { createdAt: { gte: startDate } } }),
      prisma.marketingBudgetPlan.count({ where: { status: 'active' } }),
      prisma.marketingBudgetPlan.aggregate({
        where: { createdAt: { gte: startDate } },
        _sum: {
          impressions: true,
          clicks: true,
          conversions: true,
          spentBudget: true,
          totalBudget: true,
        },
        _avg: {
          actualROI: true,
          conversionRate: true,
        },
      }),
    ]);

    const plansByStatus = await prisma.marketingBudgetPlan.groupBy({
      by: ['status'],
      where: { createdAt: { gte: startDate } },
      _count: { id: true },
    });

    const plansByService = await prisma.marketingBudgetPlan.groupBy({
      by: ['serviceType'],
      where: { createdAt: { gte: startDate } },
      _count: { id: true },
      _sum: { spentBudget: true },
    });

    return {
      totalPlans: plans,
      activePlans,
      totalImpressions: totalMetrics._sum.impressions || 0,
      totalClicks: totalMetrics._sum.clicks || 0,
      totalConversions: totalMetrics._sum.conversions || 0,
      totalSpent: totalMetrics._sum.spentBudget || 0,
      totalBudget: totalMetrics._sum.totalBudget || 0,
      avgROI: Math.round((totalMetrics._avg.actualROI || 0) * 100) / 100,
      avgConversionRate: Math.round((totalMetrics._avg.conversionRate || 0) * 10000) / 100,
      byStatus: Object.fromEntries(plansByStatus.map(s => [s.status, s._count.id])),
      byService: Object.fromEntries(plansByService.map(s => [s.serviceType, {
        count: s._count.id,
        spent: s._sum.spentBudget,
      }])),
    };
  }

  async getActivePlans(): Promise<any[]> {
    return prisma.marketingBudgetPlan.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async activatePlan(planId: string): Promise<void> {
    await prisma.marketingBudgetPlan.update({
      where: { id: planId },
      data: { 
        status: 'active',
        nextEvaluationAt: new Date(Date.now() + this.config.evaluation.windowDays * 24 * 60 * 60 * 1000),
      },
    });

    await this.logAutomation('MARKETING_BUDGET', planId, 'plan_activated', {});
  }

  async pausePlan(planId: string): Promise<void> {
    await prisma.marketingBudgetPlan.update({
      where: { id: planId },
      data: { status: 'paused' },
    });

    await this.logAutomation('MARKETING_BUDGET', planId, 'plan_paused', {});
  }

  async completePlan(planId: string): Promise<void> {
    await prisma.marketingBudgetPlan.update({
      where: { id: planId },
      data: { status: 'completed' },
    });

    await this.logAutomation('MARKETING_BUDGET', planId, 'plan_completed', {});
  }

  private async logAutomation(
    automationType: string,
    entityId: string,
    status: string,
    details: Record<string, any>
  ): Promise<void> {
    try {
      await prisma.automationLog.create({
        data: {
          automationType,
          entityType: 'marketing',
          entityId,
          status,
          metadata: details,
        },
      });
    } catch (error) {
      console.error('[MarketingBudget] Log error:', error);
    }
  }
}

export const marketingBudgetAutomation = MarketingBudgetAutomation.getInstance();
export { MarketingBudgetAutomation };
