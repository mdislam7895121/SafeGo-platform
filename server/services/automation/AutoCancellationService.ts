/**
 * SafeGo Auto Cancellation Control Service
 * Driver cooldown, customer penalty windows, restaurant/shop delay compensation
 */

import { prisma } from '../../db';
import { Prisma } from '@prisma/client';

export interface CancellationRequest {
  entityType: 'ride' | 'food_order' | 'delivery' | 'shop_order' | 'rental' | 'ticket';
  entityId: string;
  cancelledBy: 'customer' | 'driver' | 'restaurant' | 'shop' | 'operator' | 'system';
  cancellerId: string;
  reason: string;
  timestamp?: Date;
}

export interface CancellationResult {
  allowed: boolean;
  penaltyApplied: boolean;
  penaltyAmount: number;
  penaltyType: 'fee' | 'cooldown' | 'warning' | 'none';
  cooldownUntil?: Date;
  compensationPaid: boolean;
  compensationAmount: number;
  compensationRecipient?: string;
  message: string;
}

export interface CooldownStatus {
  isInCooldown: boolean;
  cooldownUntil?: Date;
  remainingMinutes: number;
  reason?: string;
  recentCancellations: number;
}

interface CancellationConfig {
  driverCooldownMinutes: number;
  driverMaxCancellationsPerDay: number;
  customerFreeWindowMinutes: number;
  customerPenaltyPercentage: number;
  restaurantDelayCompensationMinutes: number;
  restaurantCompensationPercentage: number;
  shopDelayCompensationMinutes: number;
  shopCompensationPercentage: number;
  warningThreshold: number;
  suspensionThreshold: number;
}

const DEFAULT_CONFIG: CancellationConfig = {
  driverCooldownMinutes: 15,
  driverMaxCancellationsPerDay: 5,
  customerFreeWindowMinutes: 5,
  customerPenaltyPercentage: 10,
  restaurantDelayCompensationMinutes: 30,
  restaurantCompensationPercentage: 50,
  shopDelayCompensationMinutes: 30,
  shopCompensationPercentage: 50,
  warningThreshold: 3,
  suspensionThreshold: 10,
};

export class AutoCancellationService {
  private static instance: AutoCancellationService;
  private config: CancellationConfig;
  private cooldowns: Map<string, Date>;

  private constructor() {
    this.config = DEFAULT_CONFIG;
    this.cooldowns = new Map();
  }

  public static getInstance(): AutoCancellationService {
    if (!AutoCancellationService.instance) {
      AutoCancellationService.instance = new AutoCancellationService();
    }
    return AutoCancellationService.instance;
  }

  async processCancellation(request: CancellationRequest): Promise<CancellationResult> {
    const timestamp = request.timestamp || new Date();

    const cooldownCheck = await this.checkCooldown(request.cancelledBy, request.cancellerId);
    if (cooldownCheck.isInCooldown) {
      return {
        allowed: false,
        penaltyApplied: false,
        penaltyAmount: 0,
        penaltyType: 'cooldown',
        cooldownUntil: cooldownCheck.cooldownUntil,
        compensationPaid: false,
        compensationAmount: 0,
        message: `Cancellation blocked - cooldown until ${cooldownCheck.cooldownUntil?.toISOString()}`,
      };
    }

    let result: CancellationResult;

    switch (request.cancelledBy) {
      case 'driver':
        result = await this.processDriverCancellation(request, timestamp);
        break;
      case 'customer':
        result = await this.processCustomerCancellation(request, timestamp);
        break;
      case 'restaurant':
        result = await this.processRestaurantCancellation(request, timestamp);
        break;
      case 'shop':
        result = await this.processShopCancellation(request, timestamp);
        break;
      default:
        result = {
          allowed: true,
          penaltyApplied: false,
          penaltyAmount: 0,
          penaltyType: 'none',
          compensationPaid: false,
          compensationAmount: 0,
          message: 'System cancellation processed',
        };
    }

    await this.logCancellation(request, result);

    return result;
  }

  private async processDriverCancellation(
    request: CancellationRequest,
    timestamp: Date
  ): Promise<CancellationResult> {
    const todayCancellations = await this.getRecentCancellations(
      request.cancellerId,
      'driver',
      24
    );

    if (todayCancellations >= this.config.driverMaxCancellationsPerDay) {
      const cooldownUntil = new Date(timestamp.getTime() + this.config.driverCooldownMinutes * 60 * 1000);
      this.setCooldown(request.cancellerId, 'driver', cooldownUntil);

      return {
        allowed: true,
        penaltyApplied: true,
        penaltyAmount: 0,
        penaltyType: 'cooldown',
        cooldownUntil,
        compensationPaid: false,
        compensationAmount: 0,
        message: `Cooldown applied until ${cooldownUntil.toISOString()} - exceeded daily cancellation limit`,
      };
    }

    if (todayCancellations >= this.config.warningThreshold) {
      return {
        allowed: true,
        penaltyApplied: true,
        penaltyAmount: 0,
        penaltyType: 'warning',
        compensationPaid: false,
        compensationAmount: 0,
        message: `Warning: ${todayCancellations + 1} cancellations today. ${this.config.driverMaxCancellationsPerDay - todayCancellations - 1} remaining before cooldown.`,
      };
    }

    return {
      allowed: true,
      penaltyApplied: false,
      penaltyAmount: 0,
      penaltyType: 'none',
      compensationPaid: false,
      compensationAmount: 0,
      message: 'Driver cancellation processed',
    };
  }

  private async processCustomerCancellation(
    request: CancellationRequest,
    timestamp: Date
  ): Promise<CancellationResult> {
    const entity = await this.getEntityDetails(request.entityType, request.entityId);
    if (!entity) {
      return {
        allowed: false,
        penaltyApplied: false,
        penaltyAmount: 0,
        penaltyType: 'none',
        compensationPaid: false,
        compensationAmount: 0,
        message: 'Entity not found',
      };
    }

    const minutesSinceCreation = (timestamp.getTime() - new Date(entity.createdAt).getTime()) / 60000;

    if (minutesSinceCreation <= this.config.customerFreeWindowMinutes) {
      return {
        allowed: true,
        penaltyApplied: false,
        penaltyAmount: 0,
        penaltyType: 'none',
        compensationPaid: false,
        compensationAmount: 0,
        message: 'Cancelled within free window - no penalty',
      };
    }

    const hasDriverAccepted = entity.driverId || entity.driverAssignmentStatus === 'driver_assigned';
    
    if (hasDriverAccepted) {
      const penaltyAmount = Number(entity.serviceFare) * (this.config.customerPenaltyPercentage / 100);
      
      return {
        allowed: true,
        penaltyApplied: true,
        penaltyAmount: Math.round(penaltyAmount * 100) / 100,
        penaltyType: 'fee',
        compensationPaid: true,
        compensationAmount: penaltyAmount * 0.8,
        compensationRecipient: entity.driverId,
        message: `Cancellation fee of ${penaltyAmount.toFixed(2)} applied`,
      };
    }

    return {
      allowed: true,
      penaltyApplied: false,
      penaltyAmount: 0,
      penaltyType: 'none',
      compensationPaid: false,
      compensationAmount: 0,
      message: 'Cancellation processed - no driver assigned yet',
    };
  }

  private async processRestaurantCancellation(
    request: CancellationRequest,
    timestamp: Date
  ): Promise<CancellationResult> {
    const order = await prisma.foodOrder.findUnique({
      where: { id: request.entityId },
    });

    if (!order) {
      return {
        allowed: false,
        penaltyApplied: false,
        penaltyAmount: 0,
        penaltyType: 'none',
        compensationPaid: false,
        compensationAmount: 0,
        message: 'Order not found',
      };
    }

    const minutesSinceOrder = (timestamp.getTime() - new Date(order.createdAt).getTime()) / 60000;

    if (minutesSinceOrder > this.config.restaurantDelayCompensationMinutes) {
      const compensationAmount = Number(order.serviceFare) * (this.config.restaurantCompensationPercentage / 100);

      return {
        allowed: true,
        penaltyApplied: true,
        penaltyAmount: compensationAmount,
        penaltyType: 'fee',
        compensationPaid: true,
        compensationAmount,
        compensationRecipient: order.customerId,
        message: `Restaurant cancelled after ${this.config.restaurantDelayCompensationMinutes}min - compensation provided`,
      };
    }

    return {
      allowed: true,
      penaltyApplied: false,
      penaltyAmount: 0,
      penaltyType: 'none',
      compensationPaid: false,
      compensationAmount: 0,
      message: 'Restaurant cancellation processed',
    };
  }

  private async processShopCancellation(
    request: CancellationRequest,
    timestamp: Date
  ): Promise<CancellationResult> {
    const order = await prisma.productOrder.findUnique({
      where: { id: request.entityId },
    });

    if (!order) {
      return {
        allowed: false,
        penaltyApplied: false,
        penaltyAmount: 0,
        penaltyType: 'none',
        compensationPaid: false,
        compensationAmount: 0,
        message: 'Order not found',
      };
    }

    const minutesSinceOrder = (timestamp.getTime() - new Date(order.createdAt).getTime()) / 60000;

    if (minutesSinceOrder > this.config.shopDelayCompensationMinutes) {
      const compensationAmount = Number(order.totalAmount) * (this.config.shopCompensationPercentage / 100);

      return {
        allowed: true,
        penaltyApplied: true,
        penaltyAmount: compensationAmount,
        penaltyType: 'fee',
        compensationPaid: true,
        compensationAmount,
        compensationRecipient: order.customerId,
        message: `Shop cancelled after ${this.config.shopDelayCompensationMinutes}min - compensation provided`,
      };
    }

    return {
      allowed: true,
      penaltyApplied: false,
      penaltyAmount: 0,
      penaltyType: 'none',
      compensationPaid: false,
      compensationAmount: 0,
      message: 'Shop cancellation processed',
    };
  }

  private async getEntityDetails(entityType: string, entityId: string): Promise<any> {
    switch (entityType) {
      case 'ride':
        return prisma.ride.findUnique({ where: { id: entityId } });
      case 'food_order':
        return prisma.foodOrder.findUnique({ where: { id: entityId } });
      case 'delivery':
        return prisma.delivery.findUnique({ where: { id: entityId } });
      case 'shop_order':
        return prisma.productOrder.findUnique({ where: { id: entityId } });
      default:
        return null;
    }
  }

  async checkCooldown(
    actorType: string,
    actorId: string
  ): Promise<CooldownStatus> {
    const key = `${actorType}:${actorId}`;
    const cooldownUntil = this.cooldowns.get(key);

    if (cooldownUntil && cooldownUntil > new Date()) {
      const remainingMs = cooldownUntil.getTime() - Date.now();
      return {
        isInCooldown: true,
        cooldownUntil,
        remainingMinutes: Math.ceil(remainingMs / 60000),
        reason: 'Exceeded cancellation limit',
        recentCancellations: await this.getRecentCancellations(actorId, actorType, 24),
      };
    }

    this.cooldowns.delete(key);
    return {
      isInCooldown: false,
      remainingMinutes: 0,
      recentCancellations: await this.getRecentCancellations(actorId, actorType, 24),
    };
  }

  private setCooldown(actorId: string, actorType: string, until: Date): void {
    const key = `${actorType}:${actorId}`;
    this.cooldowns.set(key, until);
  }

  private async getRecentCancellations(
    actorId: string,
    actorType: string,
    hours: number
  ): Promise<number> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const count = await prisma.automationLog.count({
      where: {
        automationType: 'cancellation',
        entityId: actorId,
        metadata: {
          path: ['cancelledBy'],
          equals: actorType,
        },
        createdAt: { gte: since },
      },
    });

    return count;
  }

  private async logCancellation(
    request: CancellationRequest,
    result: CancellationResult
  ): Promise<void> {
    try {
      await prisma.automationLog.create({
        data: {
          automationType: 'cancellation',
          entityType: request.entityType,
          entityId: request.entityId,
          status: result.allowed ? 'processed' : 'blocked',
          partnerId: request.cancellerId,
          partnerType: request.cancelledBy,
          score: result.penaltyAmount,
          metadata: {
            cancelledBy: request.cancelledBy,
            reason: request.reason,
            penaltyType: result.penaltyType,
            penaltyAmount: result.penaltyAmount,
            compensationPaid: result.compensationPaid,
            compensationAmount: result.compensationAmount,
            message: result.message,
          },
        },
      });
    } catch (error) {
      console.error('[AutoCancellationService] Failed to log cancellation:', error);
    }
  }

  async getCancellationStats(
    actorId: string,
    actorType: string,
    days: number = 30
  ): Promise<any> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const logs = await prisma.automationLog.findMany({
      where: {
        automationType: 'cancellation',
        partnerId: actorId,
        createdAt: { gte: since },
      },
    });

    const totalCancellations = logs.length;
    const penaltiesApplied = logs.filter(l => (l.metadata as any)?.penaltyAmount > 0).length;
    const totalPenalties = logs.reduce((sum, l) => sum + ((l.metadata as any)?.penaltyAmount || 0), 0);

    return {
      actorId,
      actorType,
      period: `${days} days`,
      totalCancellations,
      penaltiesApplied,
      totalPenalties,
      averagePenalty: penaltiesApplied > 0 ? totalPenalties / penaltiesApplied : 0,
    };
  }

  async adminClearCooldown(actorId: string, actorType: string, adminId: string): Promise<void> {
    const key = `${actorType}:${actorId}`;
    this.cooldowns.delete(key);

    await prisma.automationLog.create({
      data: {
        automationType: 'cancellation',
        entityType: 'admin_action',
        entityId: actorId,
        status: 'cooldown_cleared',
        metadata: { adminId, actorType },
      },
    });
  }

  updateConfig(newConfig: Partial<CancellationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): CancellationConfig {
    return { ...this.config };
  }
}

export const autoCancellationService = AutoCancellationService.getInstance();
