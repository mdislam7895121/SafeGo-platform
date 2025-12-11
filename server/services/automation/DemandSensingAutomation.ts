/**
 * SafeGo Demand Sensing Automation Service (Module 5)
 * Detects and monitors area-wise demand patterns:
 * - Hot zone detection (high demand areas)
 * - Low-driver zone detection
 * - High shop/restaurant load areas
 * Auto-suggests surge pricing based on demand-supply imbalance
 * Integrates with DemandSignalService from shared/
 */

import { prisma } from '../../db';
import { DemandSignalService, demandSignalService } from './shared/DemandSignalService';

interface AreaConfig {
  areaId: string;
  areaName: string;
  cityCode: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
}

interface DemandSensingConfig {
  enabled: boolean;
  scanIntervalMs: number;
  areas: AreaConfig[];
  serviceTypes: string[];
  thresholds: {
    hotZoneDemandLevel: number;
    lowDriverThreshold: number;
    highShopLoadOrdersPerShop: number;
    surgeRecommendationImbalance: number;
  };
  surgeMultipliers: {
    mild: number;
    moderate: number;
    high: number;
    extreme: number;
  };
  predictions: {
    enablePrediction: boolean;
    predictionHorizons: number[];
  };
  notifications: {
    alertOnHotZone: boolean;
    alertOnLowDriverZone: boolean;
    alertOnHighImbalance: boolean;
  };
  signalExpiry: {
    defaultExpiryMinutes: number;
  };
}

class DemandSensingAutomation {
  private static instance: DemandSensingAutomation;
  private config: DemandSensingConfig;
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private demandService: DemandSignalService;

  private constructor() {
    this.demandService = demandSignalService;
    this.config = {
      enabled: true,
      scanIntervalMs: 180000,
      areas: [
        { areaId: 'default', areaName: 'Default Area', cityCode: 'DEFAULT', latitude: 0, longitude: 0, radiusKm: 10 },
      ],
      serviceTypes: ['ride', 'food', 'parcel', 'shop'],
      thresholds: {
        hotZoneDemandLevel: 70,
        lowDriverThreshold: 5,
        highShopLoadOrdersPerShop: 10,
        surgeRecommendationImbalance: 30,
      },
      surgeMultipliers: {
        mild: 1.25,
        moderate: 1.5,
        high: 1.75,
        extreme: 2.0,
      },
      predictions: {
        enablePrediction: true,
        predictionHorizons: [15, 30, 60],
      },
      notifications: {
        alertOnHotZone: true,
        alertOnLowDriverZone: true,
        alertOnHighImbalance: true,
      },
      signalExpiry: {
        defaultExpiryMinutes: 15,
      },
    };
  }

  static getInstance(): DemandSensingAutomation {
    if (!DemandSensingAutomation.instance) {
      DemandSensingAutomation.instance = new DemandSensingAutomation();
    }
    return DemandSensingAutomation.instance;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.scanInterval = setInterval(() => {
      this.runDemandScan();
    }, this.config.scanIntervalMs);

    await this.logAutomation('DEMAND_SENSING', 'SYSTEM', 'started', {
      config: this.config,
    });
    console.log('[DemandSensing] Automation started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    console.log('[DemandSensing] Automation stopped');
  }

  getStatus(): { isRunning: boolean; config: DemandSensingConfig } {
    return { isRunning: this.isRunning, config: this.config };
  }

  updateConfig(updates: Partial<DemandSensingConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): DemandSensingConfig {
    return this.config;
  }

  addArea(area: AreaConfig): void {
    const existing = this.config.areas.find(a => a.areaId === area.areaId);
    if (!existing) {
      this.config.areas.push(area);
    }
  }

  removeArea(areaId: string): void {
    this.config.areas = this.config.areas.filter(a => a.areaId !== areaId);
  }

  async analyzeDemand(
    areaId: string,
    serviceType: string
  ): Promise<{
    demandData: any;
    prediction: any;
    zoneType: any;
    surgeRecommendation: any;
  }> {
    const demandData = await this.demandService.calculateAreaDemand(areaId, serviceType);

    const historicalPatterns = await this.getHistoricalPatterns(areaId, serviceType);
    const prediction = this.demandService.predictDemand(
      demandData.demandLevel,
      historicalPatterns
    );

    const zoneType = this.demandService.identifyZoneType(demandData);

    const imbalanceScore = this.demandService.calculateImbalance(
      demandData.demandLevel,
      demandData.supplyLevel
    );

    const surgeRecommendation = {
      recommended: this.demandService.shouldRecommendSurge(imbalanceScore),
      multiplier: this.demandService.calculateSurgeMultiplier(imbalanceScore),
      imbalanceScore,
      reason: this.getSurgeReason(imbalanceScore, zoneType),
    };

    await this.demandService.saveDemandSignal(demandData, prediction);

    if (zoneType.isHotZone || zoneType.isLowDriverZone || surgeRecommendation.recommended) {
      await this.handleDemandAlert(areaId, serviceType, demandData, zoneType, surgeRecommendation);
    }

    return { demandData, prediction, zoneType, surgeRecommendation };
  }

  private async getHistoricalPatterns(areaId: string, serviceType: string): Promise<number[]> {
    const now = new Date();
    const hourOfDay = now.getHours();
    const dayOfWeek = now.getDay();

    const historicalSignals = await prisma.demandSignal.findMany({
      where: {
        areaId,
        serviceType,
        generatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      select: { demandLevel: true, generatedAt: true },
      orderBy: { generatedAt: 'desc' },
      take: 100,
    });

    const sameTimePatterns = historicalSignals.filter(s => {
      const signalHour = s.generatedAt.getHours();
      const signalDay = s.generatedAt.getDay();
      return Math.abs(signalHour - hourOfDay) <= 1 && signalDay === dayOfWeek;
    });

    return sameTimePatterns.map(s => s.demandLevel);
  }

  private getSurgeReason(
    imbalanceScore: number,
    zoneType: { isHotZone: boolean; isLowDriverZone: boolean; isHighShopLoad: boolean }
  ): string {
    const reasons: string[] = [];

    if (zoneType.isHotZone) {
      reasons.push('High demand zone detected');
    }
    if (zoneType.isLowDriverZone) {
      reasons.push('Low driver availability');
    }
    if (zoneType.isHighShopLoad) {
      reasons.push('High shop/restaurant load');
    }
    if (imbalanceScore > 50) {
      reasons.push('Significant demand-supply imbalance');
    }

    return reasons.join('; ') || 'Normal conditions';
  }

  private async handleDemandAlert(
    areaId: string,
    serviceType: string,
    demandData: any,
    zoneType: any,
    surgeRecommendation: any
  ): Promise<void> {
    const alertType = zoneType.isHotZone
      ? 'hot_zone'
      : zoneType.isLowDriverZone
      ? 'low_driver'
      : 'high_imbalance';

    await this.logAutomation('DEMAND_SENSING', areaId, 'demand_alert', {
      alertType,
      serviceType,
      demandLevel: demandData.demandLevel,
      supplyLevel: demandData.supplyLevel,
      zoneType,
      surgeRecommendation,
    });

    if (
      (zoneType.isHotZone && this.config.notifications.alertOnHotZone) ||
      (zoneType.isLowDriverZone && this.config.notifications.alertOnLowDriverZone) ||
      (surgeRecommendation.recommended && this.config.notifications.alertOnHighImbalance)
    ) {
      console.log(
        `[DemandSensing] Alert: ${alertType} in ${areaId} for ${serviceType} ` +
          `(demand: ${demandData.demandLevel}, supply: ${demandData.supplyLevel})`
      );
    }
  }

  private async runDemandScan(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      let totalSignals = 0;
      let hotZones = 0;
      let lowDriverZones = 0;
      let surgeRecommendations = 0;

      for (const area of this.config.areas) {
        for (const serviceType of this.config.serviceTypes) {
          const result = await this.analyzeDemand(area.areaId, serviceType);
          totalSignals++;

          if (result.zoneType.isHotZone) hotZones++;
          if (result.zoneType.isLowDriverZone) lowDriverZones++;
          if (result.surgeRecommendation.recommended) surgeRecommendations++;
        }
      }

      await this.cleanupExpiredSignals();

      await this.logAutomation('DEMAND_SENSING', 'SYSTEM', 'scan_completed', {
        areasScanned: this.config.areas.length,
        serviceTypes: this.config.serviceTypes.length,
        totalSignals,
        hotZones,
        lowDriverZones,
        surgeRecommendations,
      });
    } catch (error) {
      console.error('[DemandSensing] Scan error:', error);
      await this.logAutomation('DEMAND_SENSING', 'SYSTEM', 'scan_error', {
        error: String(error),
      });
    }
  }

  private async cleanupExpiredSignals(): Promise<void> {
    try {
      await prisma.demandSignal.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });
    } catch (error) {
      console.error('[DemandSensing] Cleanup error:', error);
    }
  }

  async getHotZones(serviceType?: string): Promise<any[]> {
    return this.demandService.getHotZones(serviceType);
  }

  async getLowDriverZones(): Promise<any[]> {
    return prisma.demandSignal.findMany({
      where: {
        isLowDriverZone: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { activeDrivers: 'asc' },
    });
  }

  async getSurgeAreas(): Promise<any[]> {
    return prisma.demandSignal.findMany({
      where: {
        surgeRecommended: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { suggestedSurgeMultiplier: 'desc' },
    });
  }

  async getLatestSignals(limit: number = 50): Promise<any[]> {
    return this.demandService.getLatestDemandSignals(undefined, limit);
  }

  async getDemandStats(days: number = 7): Promise<Record<string, any>> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const signals = await prisma.demandSignal.findMany({
      where: { generatedAt: { gte: startDate } },
    });

    const logs = await prisma.automationLog.findMany({
      where: {
        automationType: 'DEMAND_SENSING',
        createdAt: { gte: startDate },
      },
    });

    return {
      totalSignals: signals.length,
      byServiceType: signals.reduce((acc, s) => {
        acc[s.serviceType] = (acc[s.serviceType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      hotZoneEvents: signals.filter(s => s.isHotZone).length,
      lowDriverEvents: signals.filter(s => s.isLowDriverZone).length,
      highShopLoadEvents: signals.filter(s => s.isHighShopLoad).length,
      surgeRecommendations: signals.filter(s => s.surgeRecommended).length,
      avgDemandLevel:
        signals.length > 0
          ? signals.reduce((sum, s) => sum + s.demandLevel, 0) / signals.length
          : 0,
      avgSupplyLevel:
        signals.length > 0
          ? signals.reduce((sum, s) => sum + s.supplyLevel, 0) / signals.length
          : 0,
      avgImbalance:
        signals.length > 0
          ? signals.reduce((sum, s) => sum + s.imbalanceScore, 0) / signals.length
          : 0,
      scansCompleted: logs.filter(l => l.status === 'scan_completed').length,
      alertsGenerated: logs.filter(l => l.status === 'demand_alert').length,
    };
  }

  async getPredictedDemand(
    areaId: string,
    serviceType: string,
    horizonMinutes: number = 30
  ): Promise<number> {
    const latestSignal = await prisma.demandSignal.findFirst({
      where: {
        areaId,
        serviceType,
        expiresAt: { gt: new Date() },
      },
      orderBy: { generatedAt: 'desc' },
    });

    if (!latestSignal) return 0;

    switch (horizonMinutes) {
      case 15:
        return latestSignal.predictedDemand15Min || latestSignal.demandLevel;
      case 30:
        return latestSignal.predictedDemand30Min || latestSignal.demandLevel;
      case 60:
        return latestSignal.predictedDemand60Min || latestSignal.demandLevel;
      default:
        return latestSignal.demandLevel;
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
          entityType: 'zone',
          entityId,
          status,
          metadata: details,
        },
      });
    } catch (error) {
      console.error('[DemandSensing] Log error:', error);
    }
  }
}

export const demandSensingAutomation = DemandSensingAutomation.getInstance();
