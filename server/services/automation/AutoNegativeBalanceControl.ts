/**
 * SafeGo Auto Negative Balance Control Service
 * Manages negative balance wallets:
 * - Weekly reminders
 * - Auto settlement attempts
 * - Auto freeze after overdue
 * - Auto unlock after settlement
 */

import { prisma } from '../../db';

interface NegativeBalanceWallet {
  walletId: string;
  ownerId: string;
  ownerType: string;
  balance: number;
  negativeBalance: number;
  updatedAt: Date;
}

interface NegativeBalanceConfig {
  reminders: {
    enabled: boolean;
    intervalDays: number;
    maxReminders: number;
    channels: ('email' | 'sms' | 'push')[];
  };
  autoSettlement: {
    enabled: boolean;
    attemptIntervalDays: number;
    maxAttempts: number;
    minEarningsToSettle: number;
  };
  freeze: {
    enabled: boolean;
    freezeAfterDays: number;
    freezeAfterReminders: number;
    gracePerioD: number;
  };
  unlock: {
    autoUnlockOnSettlement: boolean;
    requireFullSettlement: boolean;
    partialSettlementThreshold: number;
  };
}

class AutoNegativeBalanceControl {
  private config: NegativeBalanceConfig;
  private isRunning: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.config = {
      reminders: {
        enabled: true,
        intervalDays: 7,
        maxReminders: 4,
        channels: ['email', 'push'],
      },
      autoSettlement: {
        enabled: true,
        attemptIntervalDays: 3,
        maxAttempts: 5,
        minEarningsToSettle: 100,
      },
      freeze: {
        enabled: true,
        freezeAfterDays: 30,
        freezeAfterReminders: 3,
        gracePerioD: 7,
      },
      unlock: {
        autoUnlockOnSettlement: true,
        requireFullSettlement: false,
        partialSettlementThreshold: 0.8,
      },
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.checkInterval = setInterval(async () => {
      await this.runDailyCheck();
    }, 24 * 60 * 60 * 1000);

    await this.logAutomation('NEGATIVE_BALANCE', 'SYSTEM', 'started', { config: this.config });
    console.log('[NegativeBalance] Automation started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('[NegativeBalance] Automation stopped');
  }

  getStatus(): { isRunning: boolean; config: NegativeBalanceConfig } {
    return { isRunning: this.isRunning, config: this.config };
  }

  updateConfig(updates: Partial<NegativeBalanceConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): NegativeBalanceConfig {
    return this.config;
  }

  async runDailyCheck(): Promise<{
    remindersSent: number;
    settlementsAttempted: number;
    accountsFrozen: number;
    accountsUnlocked: number;
  }> {
    const results = {
      remindersSent: 0,
      settlementsAttempted: 0,
      accountsFrozen: 0,
      accountsUnlocked: 0,
    };

    try {
      const negativeWallets = await this.getNegativeBalanceWallets();

      for (const wallet of negativeWallets) {
        if (this.config.reminders.enabled) {
          const sent = await this.processReminder(wallet);
          if (sent) results.remindersSent++;
        }

        if (this.config.autoSettlement.enabled) {
          const attempted = await this.attemptAutoSettlement(wallet);
          if (attempted) results.settlementsAttempted++;
        }

        if (this.config.freeze.enabled) {
          const frozen = await this.checkAndFreeze(wallet);
          if (frozen) results.accountsFrozen++;
        }
      }

      await this.logAutomation('NEGATIVE_BALANCE', 'SYSTEM', 'daily_check', results);

    } catch (error) {
      console.error('[NegativeBalance] Daily check error:', error);
    }

    return results;
  }

  async getNegativeBalanceWallets(): Promise<NegativeBalanceWallet[]> {
    const wallets = await prisma.wallet.findMany({
      where: {
        negativeBalance: { gt: 0 },
      },
    });

    return wallets.map(w => ({
      walletId: w.id,
      ownerId: w.ownerId,
      ownerType: w.ownerType,
      balance: Number(w.availableBalance),
      negativeBalance: Number(w.negativeBalance),
      updatedAt: w.updatedAt,
    }));
  }

  async processReminder(wallet: NegativeBalanceWallet): Promise<boolean> {
    const recentLogs = await prisma.automationLog.findMany({
      where: {
        entityId: wallet.walletId,
        automationType: 'NEGATIVE_BALANCE',
        status: 'reminder_sent',
        createdAt: { gte: new Date(Date.now() - this.config.reminders.intervalDays * 24 * 60 * 60 * 1000) },
      },
    });

    if (recentLogs.length >= this.config.reminders.maxReminders) {
      return false;
    }

    await this.sendReminder(wallet);

    await this.logAutomation('NEGATIVE_BALANCE', wallet.walletId, 'reminder_sent', {
      ownerId: wallet.ownerId,
      ownerType: wallet.ownerType,
      balance: wallet.balance,
      negativeBalance: wallet.negativeBalance,
      reminderNumber: recentLogs.length + 1,
      channels: this.config.reminders.channels,
    });

    return true;
  }

  async attemptAutoSettlement(wallet: NegativeBalanceWallet): Promise<boolean> {
    try {
      const earnings = await this.getAvailableEarnings(wallet.ownerId, wallet.ownerType);

      if (earnings < this.config.autoSettlement.minEarningsToSettle) {
        return false;
      }

      const settlementAmount = Math.min(earnings, wallet.negativeBalance);

      await prisma.$transaction(async (tx) => {
        await tx.wallet.update({
          where: { id: wallet.walletId },
          data: {
            availableBalance: { increment: settlementAmount },
            negativeBalance: { decrement: settlementAmount },
          },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.walletId,
            ownerType: wallet.ownerType as any,
            countryCode: 'US',
            serviceType: 'settlement',
            direction: 'credit',
            amount: settlementAmount,
            balanceSnapshot: wallet.balance + settlementAmount,
            negativeBalanceSnapshot: wallet.negativeBalance - settlementAmount,
            referenceType: 'adjustment',
            description: 'Automatic settlement from earnings',
          },
        });
      });

      const updatedWallet = await prisma.wallet.findUnique({
        where: { id: wallet.walletId },
      });

      if (updatedWallet && Number(updatedWallet.negativeBalance) <= 0) {
        await this.handleSettlementComplete(wallet);
      }

      await this.logAutomation('NEGATIVE_BALANCE', wallet.walletId, 'auto_settlement', {
        ownerId: wallet.ownerId,
        previousBalance: wallet.balance,
        previousNegativeBalance: wallet.negativeBalance,
        settlementAmount,
        newBalance: wallet.balance + settlementAmount,
      });

      return true;

    } catch (error) {
      console.error('[NegativeBalance] Auto settlement error:', error);
      return false;
    }
  }

  async checkAndFreeze(wallet: NegativeBalanceWallet): Promise<boolean> {
    const frozenLog = await prisma.automationLog.findFirst({
      where: {
        entityId: wallet.walletId,
        automationType: 'NEGATIVE_BALANCE',
        status: 'account_frozen',
      },
    });

    if (frozenLog) return false;

    const daysSinceNegative = Math.floor(
      (Date.now() - wallet.updatedAt.getTime()) / (24 * 60 * 60 * 1000)
    );

    const reminderLogs = await prisma.automationLog.findMany({
      where: {
        entityId: wallet.walletId,
        automationType: 'NEGATIVE_BALANCE',
        status: 'reminder_sent',
      },
    });

    const shouldFreeze = 
      (daysSinceNegative >= this.config.freeze.freezeAfterDays) ||
      (reminderLogs.length >= this.config.freeze.freezeAfterReminders &&
       daysSinceNegative >= this.config.freeze.gracePerioD);

    if (shouldFreeze) {
      await this.logAutomation('NEGATIVE_BALANCE', wallet.walletId, 'account_frozen', {
        ownerId: wallet.ownerId,
        ownerType: wallet.ownerType,
        balance: wallet.balance,
        negativeBalance: wallet.negativeBalance,
        daysSinceNegative,
        remindersSent: reminderLogs.length,
      });

      return true;
    }

    return false;
  }

  async handleSettlementComplete(wallet: NegativeBalanceWallet): Promise<void> {
    if (!this.config.unlock.autoUnlockOnSettlement) return;

    await this.logAutomation('NEGATIVE_BALANCE', wallet.walletId, 'auto_unlocked', {
      ownerId: wallet.ownerId,
      ownerType: wallet.ownerType,
      reason: 'Balance settled',
    });
  }

  async manualUnlock(walletId: string, adminId: string, reason: string): Promise<void> {
    await this.logAutomation('NEGATIVE_BALANCE', walletId, 'admin_unlocked', {
      adminId,
      reason,
      unlockedAt: new Date().toISOString(),
    });
  }

  async manualFreeze(walletId: string, adminId: string, reason: string): Promise<void> {
    await this.logAutomation('NEGATIVE_BALANCE', walletId, 'admin_frozen', {
      adminId,
      reason,
      frozenAt: new Date().toISOString(),
    });
  }

  async getOverdueWallets(): Promise<NegativeBalanceWallet[]> {
    const wallets = await this.getNegativeBalanceWallets();
    const overdueThreshold = this.config.freeze.freezeAfterDays;

    return wallets.filter(w => {
      const daysSinceNegative = Math.floor(
        (Date.now() - w.updatedAt.getTime()) / (24 * 60 * 60 * 1000)
      );
      return daysSinceNegative >= overdueThreshold;
    });
  }

  async getStats(): Promise<Record<string, any>> {
    const wallets = await this.getNegativeBalanceWallets();

    const totalNegative = wallets.reduce((sum, w) => sum + w.negativeBalance, 0);
    
    const frozenLogs = await prisma.automationLog.findMany({
      where: {
        automationType: 'NEGATIVE_BALANCE',
        status: 'account_frozen',
      },
      select: { entityId: true },
    });
    const frozenWalletIds = new Set(frozenLogs.map(l => l.entityId));
    const frozenCount = wallets.filter(w => frozenWalletIds.has(w.walletId)).length;

    const logs = await prisma.automationLog.findMany({
      where: {
        automationType: 'NEGATIVE_BALANCE',
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    });

    return {
      totalNegativeWallets: wallets.length,
      totalNegativeBalance: totalNegative,
      frozenWallets: frozenCount,
      activeWallets: wallets.length - frozenCount,
      remindersSentLast30Days: logs.filter(l => l.status === 'reminder_sent').length,
      autoSettlementsLast30Days: logs.filter(l => l.status === 'auto_settlement').length,
      autoFrozenLast30Days: logs.filter(l => l.status === 'account_frozen').length,
      autoUnlockedLast30Days: logs.filter(l => l.status === 'auto_unlocked').length,
    };
  }

  private async sendReminder(wallet: NegativeBalanceWallet): Promise<void> {
    console.log(`[NegativeBalance] Sending reminder to ${wallet.ownerId}: Balance ${wallet.balance}`);
  }

  private async getAvailableEarnings(ownerId: string, ownerType: string): Promise<number> {
    try {
      const wallet = await prisma.wallet.findFirst({
        where: {
          ownerId,
          ownerType: ownerType as any,
        },
      });

      if (!wallet) return 0;

      return Math.max(0, Number(wallet.availableBalance));
    } catch {
      return 0;
    }
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
          entityType: 'wallet',
          entityId,
          status,
          metadata: details,
        },
      });
    } catch (error) {
      console.error('[NegativeBalance] Log error:', error);
    }
  }
}

export const autoNegativeBalanceControl = new AutoNegativeBalanceControl();
