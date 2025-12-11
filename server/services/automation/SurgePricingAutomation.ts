/**
 * SafeGo Surge Pricing Automation Service
 * Automatic price increase during high demand and reduced supply
 * Server-controlled and admin-visible
 */

import { prisma } from '../../db';
import { Decimal } from '@prisma/client/runtime/library';

export interface SurgeZone {
  id: string;
  countryCode: string;
  cityCode?: string;
  zoneId?: string;
  lat: number;
  lng: number;
  radiusKm: number;
}

export interface DemandMetrics {
  activeRequests: number;
  completedRequests: number;
  cancelledRequests: number;
  averageWaitTime: number;
}

export interface SupplyMetrics {
  availableDrivers: number;
  busyDrivers: number;
  offlineDrivers: number;
  totalDrivers: number;
}

export interface SurgeCalculation {
  zone: SurgeZone;
  demandMetrics: DemandMetrics;
  supplyMetrics: SupplyMetrics;
  demandSupplyRatio: number;
  calculatedMultiplier: number;
  appliedMultiplier: number;
  reason: string;
  timestamp: Date;
}

export interface SurgeConfig {
  minMultiplier: number;
  maxMultiplier: number;
  demandThresholdLow: number;
  demandThresholdHigh: number;
  supplyThresholdLow: number;
  supplyThresholdHigh: number;
  smoothingFactor: number;
  updateIntervalMinutes: number;
  peakHours: { start: number; end: number }[];
  weekendMultiplierBonus: number;
  festivalMultiplierBonus: number;
}

const DEFAULT_SURGE_CONFIG: SurgeConfig = {
  minMultiplier: 1.0,
  maxMultiplier: 3.0,
  demandThresholdLow: 5,
  demandThresholdHigh: 20,
  supplyThresholdLow: 3,
  supplyThresholdHigh: 15,
  smoothingFactor: 0.3,
  updateIntervalMinutes: 5,
  peakHours: [
    { start: 7, end: 9 },
    { start: 17, end: 20 },
  ],
  weekendMultiplierBonus: 0.2,
  festivalMultiplierBonus: 0.5,
};

export class SurgePricingAutomation {
  private static instance: SurgePricingAutomation;
  private config: SurgeConfig;
  private activeMultipliers: Map<string, SurgeCalculation>;
  private isRunning: boolean;
  private intervalId: NodeJS.Timeout | null;

  private constructor() {
    this.config = DEFAULT_SURGE_CONFIG;
    this.activeMultipliers = new Map();
    this.isRunning = false;
    this.intervalId = null;
  }

  public static getInstance(): SurgePricingAutomation {
    if (!SurgePricingAutomation.instance) {
      SurgePricingAutomation.instance = new SurgePricingAutomation();
    }
    return SurgePricingAutomation.instance;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    await this.runSurgeCalculation();
    
    this.intervalId = setInterval(
      () => this.runSurgeCalculation(),
      this.config.updateIntervalMinutes * 60 * 1000
    );
    
    console.log('[SurgePricingAutomation] Started with interval:', this.config.updateIntervalMinutes, 'minutes');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[SurgePricingAutomation] Stopped');
  }

  private async runSurgeCalculation(): Promise<void> {
    try {
      const zones = await this.getActiveZones();
      
      for (const zone of zones) {
        const calculation = await this.calculateSurgeForZone(zone);
        this.activeMultipliers.set(zone.id, calculation);
        
        await this.logSurgeCalculation(calculation);
        
        if (calculation.appliedMultiplier > 1.0) {
          await this.notifyAdminsOfSurge(calculation);
        }
      }
    } catch (error) {
      console.error('[SurgePricingAutomation] Calculation error:', error);
    }
  }

  private async getActiveZones(): Promise<SurgeZone[]> {
    const configs = await prisma.countryConfig.findMany({
      where: { isActive: true },
    });

    return configs.map(config => ({
      id: `${config.countryCode}-default`,
      countryCode: config.countryCode,
      lat: 0,
      lng: 0,
      radiusKm: 50,
    }));
  }

  private async calculateSurgeForZone(zone: SurgeZone): Promise<SurgeCalculation> {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    const demandMetrics = await this.getDemandMetrics(zone, thirtyMinutesAgo, now);
    const supplyMetrics = await this.getSupplyMetrics(zone);

    const demandSupplyRatio = supplyMetrics.availableDrivers > 0
      ? demandMetrics.activeRequests / supplyMetrics.availableDrivers
      : demandMetrics.activeRequests > 0 ? 5 : 1;

    let calculatedMultiplier = this.calculateBaseMultiplier(demandSupplyRatio);

    calculatedMultiplier = this.applyTimeModifiers(calculatedMultiplier, now);

    calculatedMultiplier = Math.max(
      this.config.minMultiplier,
      Math.min(this.config.maxMultiplier, calculatedMultiplier)
    );

    const previousCalculation = this.activeMultipliers.get(zone.id);
    const appliedMultiplier = previousCalculation
      ? this.smoothMultiplier(previousCalculation.appliedMultiplier, calculatedMultiplier)
      : calculatedMultiplier;

    const reason = this.generateReason(demandSupplyRatio, appliedMultiplier);

    return {
      zone,
      demandMetrics,
      supplyMetrics,
      demandSupplyRatio,
      calculatedMultiplier,
      appliedMultiplier: Math.round(appliedMultiplier * 100) / 100,
      reason,
      timestamp: now,
    };
  }

  private async getDemandMetrics(
    zone: SurgeZone,
    startTime: Date,
    endTime: Date
  ): Promise<DemandMetrics> {
    const [activeRides, completedRides, cancelledRides] = await Promise.all([
      prisma.ride.count({
        where: {
          countryCode: zone.countryCode,
          status: { in: ['requested', 'accepted', 'driver_assigned'] },
          createdAt: { gte: startTime, lte: endTime },
        },
      }),
      prisma.ride.count({
        where: {
          countryCode: zone.countryCode,
          status: 'completed',
          completedAt: { gte: startTime, lte: endTime },
        },
      }),
      prisma.ride.count({
        where: {
          countryCode: zone.countryCode,
          status: 'cancelled',
          updatedAt: { gte: startTime, lte: endTime },
        },
      }),
    ]);

    const avgWaitTimeResult = await prisma.ride.aggregate({
      where: {
        countryCode: zone.countryCode,
        status: 'completed',
        completedAt: { gte: startTime, lte: endTime },
        driverAcceptedAt: { not: null },
        requestedAt: { not: null },
      },
      _avg: {
        etaToPickupSeconds: true,
      },
    });

    return {
      activeRequests: activeRides,
      completedRequests: completedRides,
      cancelledRequests: cancelledRides,
      averageWaitTime: avgWaitTimeResult._avg.etaToPickupSeconds || 0,
    };
  }

  private async getSupplyMetrics(zone: SurgeZone): Promise<SupplyMetrics> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const [available, busy, total] = await Promise.all([
      prisma.driverRealtimeState.count({
        where: {
          countryCode: zone.countryCode,
          isOnline: true,
          isBusy: false,
          lastHeartbeatAt: { gte: fiveMinutesAgo },
        },
      }),
      prisma.driverRealtimeState.count({
        where: {
          countryCode: zone.countryCode,
          isOnline: true,
          isBusy: true,
          lastHeartbeatAt: { gte: fiveMinutesAgo },
        },
      }),
      prisma.driverProfile.count({
        where: {
          isVerified: true,
          isSuspended: false,
        },
      }),
    ]);

    return {
      availableDrivers: available,
      busyDrivers: busy,
      offlineDrivers: total - available - busy,
      totalDrivers: total,
    };
  }

  private calculateBaseMultiplier(demandSupplyRatio: number): number {
    if (demandSupplyRatio <= 1) return 1.0;
    if (demandSupplyRatio <= 1.5) return 1.0 + (demandSupplyRatio - 1) * 0.5;
    if (demandSupplyRatio <= 2) return 1.25 + (demandSupplyRatio - 1.5) * 0.5;
    if (demandSupplyRatio <= 3) return 1.5 + (demandSupplyRatio - 2) * 0.5;
    return Math.min(3.0, 2.0 + (demandSupplyRatio - 3) * 0.25);
  }

  private applyTimeModifiers(multiplier: number, now: Date): number {
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    let modifier = 0;

    for (const peak of this.config.peakHours) {
      if (hour >= peak.start && hour < peak.end) {
        modifier += 0.3;
        break;
      }
    }

    if (isWeekend) {
      modifier += this.config.weekendMultiplierBonus;
    }

    return multiplier + modifier;
  }

  private smoothMultiplier(previous: number, current: number): number {
    return previous + (current - previous) * this.config.smoothingFactor;
  }

  private generateReason(ratio: number, multiplier: number): string {
    if (multiplier <= 1.0) return 'Normal pricing - balanced demand and supply';
    if (ratio > 3) return 'Very high demand - limited driver availability';
    if (ratio > 2) return 'High demand - moderate driver shortage';
    if (ratio > 1.5) return 'Increased demand - slightly fewer drivers available';
    return 'Slightly elevated demand';
  }

  private async logSurgeCalculation(calculation: SurgeCalculation): Promise<void> {
    try {
      await prisma.automationLog.create({
        data: {
          automationType: 'surge_pricing',
          entityType: 'zone',
          entityId: calculation.zone.id,
          status: calculation.appliedMultiplier > 1.0 ? 'surge_active' : 'normal',
          score: calculation.appliedMultiplier,
          metadata: {
            demandMetrics: calculation.demandMetrics,
            supplyMetrics: calculation.supplyMetrics,
            demandSupplyRatio: calculation.demandSupplyRatio,
            reason: calculation.reason,
          },
        },
      });
    } catch (error) {
      console.error('[SurgePricingAutomation] Failed to log calculation:', error);
    }
  }

  private async notifyAdminsOfSurge(calculation: SurgeCalculation): Promise<void> {
    if (calculation.appliedMultiplier >= 2.0) {
      console.log('[SurgePricingAutomation] High surge alert:', {
        zone: calculation.zone.id,
        multiplier: calculation.appliedMultiplier,
        reason: calculation.reason,
      });
    }
  }

  async getSurgeMultiplier(
    countryCode: string,
    lat?: number,
    lng?: number
  ): Promise<number> {
    const zoneKey = `${countryCode}-default`;
    const calculation = this.activeMultipliers.get(zoneKey);
    return calculation?.appliedMultiplier || 1.0;
  }

  async getActiveSurges(): Promise<SurgeCalculation[]> {
    return Array.from(this.activeMultipliers.values())
      .filter(calc => calc.appliedMultiplier > 1.0);
  }

  async getAllSurgeData(): Promise<SurgeCalculation[]> {
    return Array.from(this.activeMultipliers.values());
  }

  async adminOverride(
    zoneId: string,
    multiplier: number,
    adminId: string,
    reason: string
  ): Promise<void> {
    const existing = this.activeMultipliers.get(zoneId);
    if (existing) {
      existing.appliedMultiplier = multiplier;
      existing.reason = `Admin override: ${reason}`;
      this.activeMultipliers.set(zoneId, existing);

      await prisma.automationLog.create({
        data: {
          automationType: 'surge_pricing',
          entityType: 'admin_override',
          entityId: zoneId,
          status: 'override',
          score: multiplier,
          metadata: {
            adminId,
            reason,
            previousMultiplier: existing.appliedMultiplier,
          },
        },
      });
    }
  }

  updateConfig(newConfig: Partial<SurgeConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): SurgeConfig {
    return { ...this.config };
  }

  isActive(): boolean {
    return this.isRunning;
  }
}

export const surgePricingAutomation = SurgePricingAutomation.getInstance();
