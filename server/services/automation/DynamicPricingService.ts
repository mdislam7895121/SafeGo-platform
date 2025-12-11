/**
 * SafeGo Dynamic Price Optimization Service
 * Time-based, demand-based, festival/weekend-based price adjustments
 */

import { prisma } from '../../db';

export interface PricingModifier {
  type: 'time' | 'demand' | 'festival' | 'weekend' | 'weather' | 'event';
  name: string;
  multiplier: number;
  additive: number;
  priority: number;
  isActive: boolean;
  startTime?: Date;
  endTime?: Date;
}

export interface PricingContext {
  serviceType: 'ride' | 'food' | 'delivery' | 'shop' | 'rental' | 'ticket';
  countryCode: string;
  cityCode?: string;
  basePrice: number;
  distanceKm?: number;
  timestamp?: Date;
}

export interface OptimizedPrice {
  basePrice: number;
  finalPrice: number;
  appliedModifiers: AppliedModifier[];
  savings?: number;
  totalMultiplier: number;
  calculatedAt: Date;
}

export interface AppliedModifier {
  type: string;
  name: string;
  effect: number;
  reason: string;
}

interface TimeSlot {
  name: string;
  startHour: number;
  endHour: number;
  multiplier: number;
}

interface FestivalConfig {
  name: string;
  startDate: Date;
  endDate: Date;
  multiplier: number;
  serviceTypes: string[];
}

export class DynamicPricingService {
  private static instance: DynamicPricingService;
  private timeSlots: TimeSlot[];
  private festivals: FestivalConfig[];
  private weekendMultiplier: number;
  private lateNightMultiplier: number;

  private constructor() {
    this.timeSlots = [
      { name: 'Early Morning', startHour: 5, endHour: 7, multiplier: 0.9 },
      { name: 'Morning Rush', startHour: 7, endHour: 9, multiplier: 1.3 },
      { name: 'Late Morning', startHour: 9, endHour: 11, multiplier: 1.0 },
      { name: 'Lunch Rush', startHour: 11, endHour: 14, multiplier: 1.2 },
      { name: 'Afternoon', startHour: 14, endHour: 17, multiplier: 1.0 },
      { name: 'Evening Rush', startHour: 17, endHour: 20, multiplier: 1.4 },
      { name: 'Evening', startHour: 20, endHour: 23, multiplier: 1.1 },
      { name: 'Late Night', startHour: 23, endHour: 5, multiplier: 1.5 },
    ];

    this.festivals = [];
    this.weekendMultiplier = 1.15;
    this.lateNightMultiplier = 1.5;
  }

  public static getInstance(): DynamicPricingService {
    if (!DynamicPricingService.instance) {
      DynamicPricingService.instance = new DynamicPricingService();
    }
    return DynamicPricingService.instance;
  }

  async calculateOptimizedPrice(context: PricingContext): Promise<OptimizedPrice> {
    const timestamp = context.timestamp || new Date();
    const appliedModifiers: AppliedModifier[] = [];
    let totalMultiplier = 1.0;

    const timeModifier = this.getTimeModifier(timestamp);
    if (timeModifier.multiplier !== 1.0) {
      totalMultiplier *= timeModifier.multiplier;
      appliedModifiers.push({
        type: 'time',
        name: timeModifier.name,
        effect: timeModifier.multiplier,
        reason: `${timeModifier.name} pricing`,
      });
    }

    const weekendModifier = this.getWeekendModifier(timestamp);
    if (weekendModifier > 1.0) {
      totalMultiplier *= weekendModifier;
      appliedModifiers.push({
        type: 'weekend',
        name: 'Weekend',
        effect: weekendModifier,
        reason: 'Weekend surge pricing',
      });
    }

    const festivalModifier = this.getFestivalModifier(timestamp, context.serviceType);
    if (festivalModifier.multiplier > 1.0) {
      totalMultiplier *= festivalModifier.multiplier;
      appliedModifiers.push({
        type: 'festival',
        name: festivalModifier.name,
        effect: festivalModifier.multiplier,
        reason: `${festivalModifier.name} special pricing`,
      });
    }

    const demandModifier = await this.getDemandModifier(context);
    if (demandModifier !== 1.0) {
      totalMultiplier *= demandModifier;
      appliedModifiers.push({
        type: 'demand',
        name: 'Demand Adjustment',
        effect: demandModifier,
        reason: demandModifier > 1.0 ? 'High demand in your area' : 'Low demand discount',
      });
    }

    totalMultiplier = Math.min(totalMultiplier, 3.0);
    totalMultiplier = Math.max(totalMultiplier, 0.7);

    const finalPrice = Math.round(context.basePrice * totalMultiplier * 100) / 100;

    const result: OptimizedPrice = {
      basePrice: context.basePrice,
      finalPrice,
      appliedModifiers,
      totalMultiplier: Math.round(totalMultiplier * 100) / 100,
      calculatedAt: new Date(),
    };

    if (finalPrice < context.basePrice) {
      result.savings = Math.round((context.basePrice - finalPrice) * 100) / 100;
    }

    await this.logPriceCalculation(context, result);

    return result;
  }

  private getTimeModifier(timestamp: Date): { name: string; multiplier: number } {
    const hour = timestamp.getHours();

    for (const slot of this.timeSlots) {
      if (slot.startHour < slot.endHour) {
        if (hour >= slot.startHour && hour < slot.endHour) {
          return { name: slot.name, multiplier: slot.multiplier };
        }
      } else {
        if (hour >= slot.startHour || hour < slot.endHour) {
          return { name: slot.name, multiplier: slot.multiplier };
        }
      }
    }

    return { name: 'Standard', multiplier: 1.0 };
  }

  private getWeekendModifier(timestamp: Date): number {
    const day = timestamp.getDay();
    if (day === 0 || day === 6) {
      return this.weekendMultiplier;
    }
    return 1.0;
  }

  private getFestivalModifier(
    timestamp: Date,
    serviceType: string
  ): { name: string; multiplier: number } {
    for (const festival of this.festivals) {
      if (
        timestamp >= festival.startDate &&
        timestamp <= festival.endDate &&
        festival.serviceTypes.includes(serviceType)
      ) {
        return { name: festival.name, multiplier: festival.multiplier };
      }
    }
    return { name: '', multiplier: 1.0 };
  }

  private async getDemandModifier(context: PricingContext): Promise<number> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      let recentRequests = 0;
      let availableSupply = 0;

      if (context.serviceType === 'ride' || context.serviceType === 'delivery') {
        [recentRequests, availableSupply] = await Promise.all([
          prisma.ride.count({
            where: {
              countryCode: context.countryCode,
              createdAt: { gte: oneHourAgo },
            },
          }),
          prisma.driverRealtimeState.count({
            where: {
              countryCode: context.countryCode,
              isOnline: true,
              isBusy: false,
            },
          }),
        ]);
      } else if (context.serviceType === 'food') {
        recentRequests = await prisma.foodOrder.count({
          where: {
            createdAt: { gte: oneHourAgo },
          },
        });
        availableSupply = await prisma.restaurantProfile.count({
          where: {
            isActive: true,
            isVerified: true,
            isBusy: false,
          },
        });
      }

      if (availableSupply === 0) return 1.5;
      
      const ratio = recentRequests / availableSupply;
      
      if (ratio > 3) return 1.5;
      if (ratio > 2) return 1.3;
      if (ratio > 1.5) return 1.2;
      if (ratio > 1) return 1.1;
      if (ratio < 0.3) return 0.9;
      if (ratio < 0.5) return 0.95;
      
      return 1.0;
    } catch (error) {
      console.error('[DynamicPricingService] Demand calculation error:', error);
      return 1.0;
    }
  }

  private async logPriceCalculation(
    context: PricingContext,
    result: OptimizedPrice
  ): Promise<void> {
    try {
      await prisma.automationLog.create({
        data: {
          automationType: 'dynamic_pricing',
          entityType: context.serviceType,
          entityId: `${context.countryCode}-${context.cityCode || 'all'}`,
          status: 'calculated',
          score: result.totalMultiplier,
          metadata: {
            basePrice: result.basePrice,
            finalPrice: result.finalPrice,
            modifiers: result.appliedModifiers,
          },
        },
      });
    } catch (error) {
      console.error('[DynamicPricingService] Failed to log calculation:', error);
    }
  }

  async addFestival(config: FestivalConfig): Promise<void> {
    this.festivals.push(config);
    console.log('[DynamicPricingService] Added festival:', config.name);
  }

  async removeFestival(name: string): Promise<void> {
    this.festivals = this.festivals.filter(f => f.name !== name);
  }

  getFestivals(): FestivalConfig[] {
    return [...this.festivals];
  }

  updateTimeSlots(slots: TimeSlot[]): void {
    this.timeSlots = slots;
  }

  getTimeSlots(): TimeSlot[] {
    return [...this.timeSlots];
  }

  setWeekendMultiplier(multiplier: number): void {
    this.weekendMultiplier = multiplier;
  }

  async getPricingAnalytics(
    countryCode: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const logs = await prisma.automationLog.findMany({
      where: {
        automationType: 'dynamic_pricing',
        createdAt: { gte: startDate, lte: endDate },
        entityId: { startsWith: countryCode },
      },
    });

    const avgMultiplier = logs.length > 0
      ? logs.reduce((sum, l) => sum + (l.score || 1), 0) / logs.length
      : 1.0;

    return {
      totalCalculations: logs.length,
      averageMultiplier: avgMultiplier,
      period: { startDate, endDate },
    };
  }
}

export const dynamicPricingService = DynamicPricingService.getInstance();
