/**
 * SafeGo Commission & Wallet Auto-Settlement Service
 * Weekly automatic commission settlement for drivers, restaurants, shops, ticket operators, rental partners
 * Cash → negative balance → auto recovery → auto freeze/unfreeze
 */

import { prisma } from '../../db';
import { Prisma } from '@prisma/client';
import { WalletService } from '../walletService';

export interface SettlementTarget {
  ownerId: string;
  ownerType: 'driver' | 'restaurant' | 'shop' | 'ticket_operator' | 'rental_operator';
  walletId: string;
  countryCode: string;
  negativeBalance: number;
  availableBalance: number;
  pendingCommissions: number;
  cashCollected: number;
}

export interface SettlementResult {
  ownerId: string;
  ownerType: string;
  previousNegativeBalance: number;
  settlementAmount: number;
  newNegativeBalance: number;
  action: 'settled' | 'partial_settled' | 'frozen' | 'unfrozen' | 'no_action';
  reason: string;
}

export interface SettlementBatchResult {
  batchId: string;
  startedAt: Date;
  completedAt: Date;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  totalSettled: number;
  frozenCount: number;
  unfrozenCount: number;
  results: SettlementResult[];
}

export interface SettlementConfig {
  settlementDayOfWeek: number;
  freezeThresholdDays: number;
  freezeThresholdAmount: number;
  autoRecoveryEnabled: boolean;
  maxNegativeBalanceForPayout: number;
  minSettlementAmount: number;
}

const DEFAULT_CONFIG: SettlementConfig = {
  settlementDayOfWeek: 1,
  freezeThresholdDays: 14,
  freezeThresholdAmount: 500,
  autoRecoveryEnabled: true,
  maxNegativeBalanceForPayout: 100,
  minSettlementAmount: 10,
};

export class AutoSettlementService {
  private static instance: AutoSettlementService;
  private config: SettlementConfig;
  private walletService: WalletService;
  private isRunning: boolean;
  private scheduledJob: NodeJS.Timeout | null;

  private constructor() {
    this.config = DEFAULT_CONFIG;
    this.walletService = new WalletService();
    this.isRunning = false;
    this.scheduledJob = null;
  }

  public static getInstance(): AutoSettlementService {
    if (!AutoSettlementService.instance) {
      AutoSettlementService.instance = new AutoSettlementService();
    }
    return AutoSettlementService.instance;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.scheduleNextSettlement();
    console.log('[AutoSettlementService] Started - scheduled for day:', this.config.settlementDayOfWeek);
  }

  stop(): void {
    if (this.scheduledJob) {
      clearTimeout(this.scheduledJob);
      this.scheduledJob = null;
    }
    this.isRunning = false;
    console.log('[AutoSettlementService] Stopped');
  }

  private scheduleNextSettlement(): void {
    const now = new Date();
    const daysUntilSettlement = (this.config.settlementDayOfWeek - now.getDay() + 7) % 7;
    const nextSettlement = new Date(now);
    nextSettlement.setDate(now.getDate() + (daysUntilSettlement || 7));
    nextSettlement.setHours(2, 0, 0, 0);

    const msUntilSettlement = nextSettlement.getTime() - now.getTime();

    this.scheduledJob = setTimeout(async () => {
      await this.runWeeklySettlement();
      this.scheduleNextSettlement();
    }, msUntilSettlement);

    console.log('[AutoSettlementService] Next settlement scheduled for:', nextSettlement);
  }

  async runWeeklySettlement(): Promise<SettlementBatchResult> {
    const batchId = `SETTLE-${Date.now()}`;
    const startedAt = new Date();
    const results: SettlementResult[] = [];

    console.log('[AutoSettlementService] Starting weekly settlement:', batchId);

    try {
      const driverResults = await this.settleOwnerType('driver');
      results.push(...driverResults);

      const restaurantResults = await this.settleOwnerType('restaurant');
      results.push(...restaurantResults);

      const shopResults = await this.settleOwnerType('shop');
      results.push(...shopResults);

      const ticketResults = await this.settleOwnerType('ticket_operator');
      results.push(...ticketResults);

      const rentalResults = await this.settleOwnerType('rental_operator');
      results.push(...rentalResults);

    } catch (error) {
      console.error('[AutoSettlementService] Settlement error:', error);
    }

    const completedAt = new Date();

    const batchResult: SettlementBatchResult = {
      batchId,
      startedAt,
      completedAt,
      totalProcessed: results.length,
      successCount: results.filter(r => r.action !== 'no_action').length,
      failureCount: 0,
      totalSettled: results.reduce((sum, r) => sum + r.settlementAmount, 0),
      frozenCount: results.filter(r => r.action === 'frozen').length,
      unfrozenCount: results.filter(r => r.action === 'unfrozen').length,
      results,
    };

    await this.logSettlementBatch(batchResult);

    console.log('[AutoSettlementService] Settlement completed:', {
      batchId,
      processed: batchResult.totalProcessed,
      settled: batchResult.totalSettled,
      frozen: batchResult.frozenCount,
    });

    return batchResult;
  }

  private async settleOwnerType(
    ownerType: 'driver' | 'restaurant' | 'shop' | 'ticket_operator' | 'rental_operator'
  ): Promise<SettlementResult[]> {
    const walletOwnerType = this.mapToWalletOwnerType(ownerType);
    
    const wallets = await prisma.wallet.findMany({
      where: {
        ownerType: walletOwnerType,
        OR: [
          { negativeBalance: { gt: 0 } },
          { availableBalance: { gt: this.config.minSettlementAmount } },
        ],
      },
    });

    const results: SettlementResult[] = [];

    for (const wallet of wallets) {
      const result = await this.processWalletSettlement(wallet, ownerType);
      results.push(result);
    }

    return results;
  }

  private mapToWalletOwnerType(ownerType: string): any {
    const mapping: Record<string, string> = {
      driver: 'driver',
      restaurant: 'restaurant',
      shop: 'shop_partner',
      ticket_operator: 'ticket_operator',
      rental_operator: 'ticket_operator',
    };
    return mapping[ownerType] || ownerType;
  }

  private async processWalletSettlement(
    wallet: any,
    ownerType: string
  ): Promise<SettlementResult> {
    const negativeBalance = Number(wallet.negativeBalance);
    const availableBalance = Number(wallet.availableBalance);

    if (negativeBalance > 0 && availableBalance > 0 && this.config.autoRecoveryEnabled) {
      return await this.performAutoRecovery(wallet, ownerType);
    }

    if (negativeBalance > this.config.freezeThresholdAmount) {
      const daysSinceNegative = await this.getDaysSinceNegativeBalance(wallet.id);
      
      if (daysSinceNegative >= this.config.freezeThresholdDays) {
        return await this.freezeWallet(wallet, ownerType);
      }
    }

    if (wallet.isFrozen && negativeBalance <= 0) {
      return await this.unfreezeWallet(wallet, ownerType);
    }

    return {
      ownerId: wallet.ownerId,
      ownerType,
      previousNegativeBalance: negativeBalance,
      settlementAmount: 0,
      newNegativeBalance: negativeBalance,
      action: 'no_action',
      reason: 'No settlement required',
    };
  }

  private async performAutoRecovery(
    wallet: any,
    ownerType: string
  ): Promise<SettlementResult> {
    const negativeBalance = Number(wallet.negativeBalance);
    const availableBalance = Number(wallet.availableBalance);
    const settlementAmount = Math.min(negativeBalance, availableBalance);

    await prisma.$transaction(async (tx) => {
      const newNegative = new Prisma.Decimal(negativeBalance - settlementAmount);
      const newAvailable = new Prisma.Decimal(availableBalance - settlementAmount);

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          negativeBalance: newNegative,
          availableBalance: newAvailable,
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          ownerType: wallet.ownerType,
          countryCode: wallet.countryCode,
          serviceType: 'commission_settlement',
          direction: 'debit',
          amount: new Prisma.Decimal(settlementAmount),
          balanceSnapshot: newAvailable,
          negativeBalanceSnapshot: newNegative,
          referenceType: 'settlement',
          referenceId: `AUTO-${Date.now()}`,
          description: `Auto-settlement of ${settlementAmount} from available balance`,
        },
      });
    });

    return {
      ownerId: wallet.ownerId,
      ownerType,
      previousNegativeBalance: negativeBalance,
      settlementAmount,
      newNegativeBalance: negativeBalance - settlementAmount,
      action: settlementAmount >= negativeBalance ? 'settled' : 'partial_settled',
      reason: `Auto-recovered ${settlementAmount} from available balance`,
    };
  }

  private async freezeWallet(wallet: any, ownerType: string): Promise<SettlementResult> {
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { isFrozen: true },
    });

    await this.logWalletAction(wallet.id, 'freeze', 'Exceeded negative balance threshold');

    return {
      ownerId: wallet.ownerId,
      ownerType,
      previousNegativeBalance: Number(wallet.negativeBalance),
      settlementAmount: 0,
      newNegativeBalance: Number(wallet.negativeBalance),
      action: 'frozen',
      reason: `Wallet frozen - negative balance exceeded ${this.config.freezeThresholdAmount} for ${this.config.freezeThresholdDays} days`,
    };
  }

  private async unfreezeWallet(wallet: any, ownerType: string): Promise<SettlementResult> {
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { isFrozen: false },
    });

    await this.logWalletAction(wallet.id, 'unfreeze', 'Negative balance cleared');

    return {
      ownerId: wallet.ownerId,
      ownerType,
      previousNegativeBalance: 0,
      settlementAmount: 0,
      newNegativeBalance: 0,
      action: 'unfrozen',
      reason: 'Wallet unfrozen - negative balance cleared',
    };
  }

  private async getDaysSinceNegativeBalance(walletId: string): Promise<number> {
    const firstNegativeTx = await prisma.walletTransaction.findFirst({
      where: {
        walletId,
        negativeBalanceSnapshot: { gt: 0 },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!firstNegativeTx) return 0;

    const daysDiff = (Date.now() - firstNegativeTx.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    return Math.floor(daysDiff);
  }

  private async logWalletAction(
    walletId: string,
    action: string,
    reason: string
  ): Promise<void> {
    try {
      await prisma.automationLog.create({
        data: {
          automationType: 'auto_settlement',
          entityType: 'wallet',
          entityId: walletId,
          status: action,
          metadata: { reason },
        },
      });
    } catch (error) {
      console.error('[AutoSettlementService] Failed to log action:', error);
    }
  }

  private async logSettlementBatch(batch: SettlementBatchResult): Promise<void> {
    try {
      await prisma.automationLog.create({
        data: {
          automationType: 'auto_settlement',
          entityType: 'batch',
          entityId: batch.batchId,
          status: 'completed',
          metadata: {
            totalProcessed: batch.totalProcessed,
            successCount: batch.successCount,
            totalSettled: batch.totalSettled,
            frozenCount: batch.frozenCount,
            unfrozenCount: batch.unfrozenCount,
          },
        },
      });
    } catch (error) {
      console.error('[AutoSettlementService] Failed to log batch:', error);
    }
  }

  async manualSettle(
    walletId: string,
    adminId: string,
    amount?: number
  ): Promise<SettlementResult> {
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const settlementAmount = amount || Math.min(
      Number(wallet.negativeBalance),
      Number(wallet.availableBalance)
    );

    const result = await this.performAutoRecovery(wallet, wallet.ownerType);

    await this.logWalletAction(walletId, 'manual_settle', `Admin ${adminId} triggered settlement of ${settlementAmount}`);

    return result;
  }

  async getSettlementHistory(
    ownerType?: string,
    limit: number = 100
  ): Promise<any[]> {
    return prisma.automationLog.findMany({
      where: {
        automationType: 'auto_settlement',
        ...(ownerType ? { metadata: { path: ['ownerType'], equals: ownerType } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getPendingSettlements(): Promise<any[]> {
    return prisma.wallet.findMany({
      where: {
        negativeBalance: { gt: 0 },
        isFrozen: false,
      },
      orderBy: { negativeBalance: 'desc' },
      take: 100,
    });
  }

  updateConfig(newConfig: Partial<SettlementConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): SettlementConfig {
    return { ...this.config };
  }
}

export const autoSettlementService = AutoSettlementService.getInstance();
