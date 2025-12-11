/**
 * SafeGo Traffic ETA Correction Automation Service (Module 6)
 * Uses traffic conditions to adjust ETA calculations:
 * - Historical traffic patterns
 * - Weather impact on travel times
 * - Time-of-day and day-of-week signals
 * - Holiday/weekend adjustments
 * Overrides base ETA system-wide for accuracy
 * Integrates with TrafficDataService from shared/
 */

import { prisma } from '../../db';
import { TrafficDataService, trafficDataService } from './shared/TrafficDataService';

interface TrafficSourceData {
  areaId: string;
  avgSpeedKmh: number;
  weatherCondition: string;
}

interface ETACorrectionResult {
  originalEtaMinutes: number;
  correctedEtaMinutes: number;
  multiplier: number;
  adjustmentMinutes: number;
  confidence: number;
  factors: Record<string, any>;
}

interface TrafficETAConfig {
  enabled: boolean;
  scanIntervalMs: number;
  areas: Array<{
    areaId: string;
    areaName: string;
    latitude: number;
    longitude: number;
    baselineSpeedKmh: number;
  }>;
  weatherSources: {
    enabled: boolean;
    defaultCondition: string;
  };
  congestionLevels: {
    freeFlow: { speedRatio: number; multiplier: number };
    light: { speedRatio: number; multiplier: number };
    moderate: { speedRatio: number; multiplier: number };
    heavy: { speedRatio: number; multiplier: number };
    severe: { speedRatio: number; multiplier: number };
  };
  timeOfDayFactors: {
    morningRush: number;
    midday: number;
    eveningRush: number;
    night: number;
  };
  weekendFactor: number;
  holidayFactor: number;
  snapshotExpiry: {
    defaultExpiryMinutes: number;
  };
  historicalLearning: {
    enabled: boolean;
    minDataPointsForLearning: number;
    learningDecayDays: number;
  };
}

class TrafficETACorrectionAutomation {
  private static instance: TrafficETACorrectionAutomation;
  private config: TrafficETAConfig;
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private trafficService: TrafficDataService;
  private holidays: Set<string> = new Set();

  private constructor() {
    this.trafficService = trafficDataService;
    this.config = {
      enabled: true,
      scanIntervalMs: 300000,
      areas: [
        { areaId: 'default', areaName: 'Default Area', latitude: 0, longitude: 0, baselineSpeedKmh: 40 },
      ],
      weatherSources: {
        enabled: true,
        defaultCondition: 'clear',
      },
      congestionLevels: {
        freeFlow: { speedRatio: 0.9, multiplier: 1.0 },
        light: { speedRatio: 0.7, multiplier: 1.15 },
        moderate: { speedRatio: 0.5, multiplier: 1.3 },
        heavy: { speedRatio: 0.3, multiplier: 1.5 },
        severe: { speedRatio: 0.0, multiplier: 2.0 },
      },
      timeOfDayFactors: {
        morningRush: 1.25,
        midday: 1.0,
        eveningRush: 1.3,
        night: 0.9,
      },
      weekendFactor: 0.85,
      holidayFactor: 0.75,
      snapshotExpiry: {
        defaultExpiryMinutes: 15,
      },
      historicalLearning: {
        enabled: true,
        minDataPointsForLearning: 10,
        learningDecayDays: 30,
      },
    };

    this.initializeHolidays();
  }

  static getInstance(): TrafficETACorrectionAutomation {
    if (!TrafficETACorrectionAutomation.instance) {
      TrafficETACorrectionAutomation.instance = new TrafficETACorrectionAutomation();
    }
    return TrafficETACorrectionAutomation.instance;
  }

  private initializeHolidays(): void {
    const year = new Date().getFullYear();
    this.holidays.add(`${year}-01-01`);
    this.holidays.add(`${year}-07-04`);
    this.holidays.add(`${year}-12-25`);
    this.holidays.add(`${year}-12-26`);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.scanInterval = setInterval(() => {
      this.runTrafficScan();
    }, this.config.scanIntervalMs);

    await this.logAutomation('TRAFFIC_ETA_CORRECTION', 'SYSTEM', 'started', {
      config: this.config,
    });
    console.log('[TrafficETA] Automation started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    console.log('[TrafficETA] Automation stopped');
  }

  getStatus(): { isRunning: boolean; config: TrafficETAConfig } {
    return { isRunning: this.isRunning, config: this.config };
  }

  updateConfig(updates: Partial<TrafficETAConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): TrafficETAConfig {
    return this.config;
  }

  addArea(area: TrafficETAConfig['areas'][0]): void {
    const existing = this.config.areas.find(a => a.areaId === area.areaId);
    if (!existing) {
      this.config.areas.push(area);
    }
  }

  addHoliday(date: string): void {
    this.holidays.add(date);
  }

  removeHoliday(date: string): void {
    this.holidays.delete(date);
  }

  async calculateCorrectedETA(
    areaId: string,
    baseEtaMinutes: number,
    pickupLat?: number,
    pickupLng?: number
  ): Promise<ETACorrectionResult> {
    const now = new Date();
    const timeOfDay = this.trafficService.getTimeOfDay(now);
    const isWeekend = this.trafficService.isWeekend(now);
    const isHoliday = this.isHoliday(now);

    const trafficData = await this.getTrafficData(areaId);

    const congestionScore = trafficData.congestionScore;
    const weatherImpact = trafficData.weatherImpactScore;

    const etaCorrection = this.trafficService.calculateETACorrection(
      congestionScore,
      weatherImpact,
      timeOfDay,
      isHoliday
    );

    let finalMultiplier = etaCorrection.etaMultiplier;
    let finalAdjustment = etaCorrection.etaAdjustmentMinutes;

    const timeOfDayFactor = this.getTimeOfDayFactor(timeOfDay);
    finalMultiplier *= timeOfDayFactor;

    if (isWeekend) {
      finalMultiplier *= this.config.weekendFactor;
    }

    if (isHoliday) {
      finalMultiplier *= this.config.holidayFactor;
    }

    const correctedEta = Math.round(
      baseEtaMinutes * finalMultiplier + finalAdjustment
    );

    const factors = {
      congestionScore,
      congestionLevel: trafficData.congestionLevel,
      weatherCondition: trafficData.weatherCondition,
      weatherImpact,
      timeOfDay,
      timeOfDayFactor,
      isWeekend,
      isHoliday,
      baseMultiplier: etaCorrection.etaMultiplier,
      finalMultiplier,
      adjustmentMinutes: finalAdjustment,
    };

    return {
      originalEtaMinutes: baseEtaMinutes,
      correctedEtaMinutes: Math.max(correctedEta, baseEtaMinutes),
      multiplier: finalMultiplier,
      adjustmentMinutes: finalAdjustment,
      confidence: etaCorrection.confidence,
      factors,
    };
  }

  private async getTrafficData(areaId: string): Promise<{
    congestionScore: number;
    congestionLevel: string;
    weatherCondition: string;
    weatherImpactScore: number;
  }> {
    const latestSnapshot = await this.trafficService.getLatestTrafficData(areaId);

    if (latestSnapshot) {
      const snapshot = latestSnapshot as {
        congestionScore: number;
        congestionLevel: string;
        weatherCondition: string | null;
        weatherImpactScore: number | null;
      };

      return {
        congestionScore: snapshot.congestionScore,
        congestionLevel: snapshot.congestionLevel,
        weatherCondition: snapshot.weatherCondition || 'clear',
        weatherImpactScore: snapshot.weatherImpactScore ?? 0,
      };
    }

    return {
      congestionScore: 20,
      congestionLevel: 'light',
      weatherCondition: this.config.weatherSources.defaultCondition,
      weatherImpactScore: 0,
    };
  }

  private getTimeOfDayFactor(timeOfDay: string): number {
    switch (timeOfDay) {
      case 'morning_rush':
        return this.config.timeOfDayFactors.morningRush;
      case 'midday':
        return this.config.timeOfDayFactors.midday;
      case 'evening_rush':
        return this.config.timeOfDayFactors.eveningRush;
      case 'night':
        return this.config.timeOfDayFactors.night;
      default:
        return 1.0;
    }
  }

  private isHoliday(date: Date): boolean {
    const dateStr = date.toISOString().split('T')[0];
    return this.holidays.has(dateStr);
  }

  async recordTrafficObservation(
    areaId: string,
    avgSpeedKmh: number,
    weatherCondition?: string
  ): Promise<void> {
    const areaConfig = this.config.areas.find(a => a.areaId === areaId);
    const baselineSpeed = areaConfig?.baselineSpeedKmh || 40;

    const congestionScore = this.trafficService.calculateCongestionScore(avgSpeedKmh, baselineSpeed);
    const weatherImpactScore = this.trafficService.calculateWeatherImpact(
      weatherCondition || this.config.weatherSources.defaultCondition
    );

    await this.trafficService.saveTrafficSnapshot({
      areaId,
      areaName: areaConfig?.areaName || `Area ${areaId}`,
      latitude: areaConfig?.latitude || 0,
      longitude: areaConfig?.longitude || 0,
      avgSpeedKmh,
      congestionScore,
      weatherCondition: weatherCondition || this.config.weatherSources.defaultCondition,
      weatherImpactScore,
    });

    await this.logAutomation('TRAFFIC_ETA_CORRECTION', areaId, 'traffic_recorded', {
      avgSpeedKmh,
      congestionScore,
      weatherCondition,
      weatherImpactScore,
    });
  }

  private async runTrafficScan(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      let snapshotsCreated = 0;
      const congestedAreas: string[] = [];

      for (const area of this.config.areas) {
        const simulatedSpeed = this.simulateTrafficSpeed(area.baselineSpeedKmh);
        const weatherCondition = this.simulateWeather();

        await this.recordTrafficObservation(area.areaId, simulatedSpeed, weatherCondition);
        snapshotsCreated++;

        const congestionScore = this.trafficService.calculateCongestionScore(
          simulatedSpeed,
          area.baselineSpeedKmh
        );

        if (congestionScore > 50) {
          congestedAreas.push(area.areaId);
        }
      }

      await this.cleanupExpiredSnapshots();

      await this.logAutomation('TRAFFIC_ETA_CORRECTION', 'SYSTEM', 'scan_completed', {
        areasScanned: this.config.areas.length,
        snapshotsCreated,
        congestedAreas,
      });
    } catch (error) {
      console.error('[TrafficETA] Scan error:', error);
      await this.logAutomation('TRAFFIC_ETA_CORRECTION', 'SYSTEM', 'scan_error', {
        error: String(error),
      });
    }
  }

  private simulateTrafficSpeed(baselineSpeed: number): number {
    const now = new Date();
    const hour = now.getHours();
    let factor = 1.0;

    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
      factor = 0.4 + Math.random() * 0.3;
    } else if (hour >= 10 && hour <= 16) {
      factor = 0.6 + Math.random() * 0.3;
    } else {
      factor = 0.8 + Math.random() * 0.2;
    }

    return Math.round(baselineSpeed * factor);
  }

  private simulateWeather(): string {
    const conditions = ['clear', 'clear', 'clear', 'cloudy', 'cloudy', 'rain', 'fog'];
    return conditions[Math.floor(Math.random() * conditions.length)];
  }

  private async cleanupExpiredSnapshots(): Promise<void> {
    try {
      await prisma.trafficSnapshot.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });
    } catch (error) {
      console.error('[TrafficETA] Cleanup error:', error);
    }
  }

  async getCongestedAreas(minScore: number = 50): Promise<any[]> {
    return this.trafficService.getCongestedAreas(minScore);
  }

  async getETACorrectionForRoute(
    pickupAreaId: string,
    dropoffAreaId: string,
    baseEtaMinutes: number
  ): Promise<ETACorrectionResult> {
    const pickupCorrection = await this.calculateCorrectedETA(pickupAreaId, baseEtaMinutes / 2);
    const dropoffCorrection = await this.calculateCorrectedETA(dropoffAreaId, baseEtaMinutes / 2);

    const combinedMultiplier = (pickupCorrection.multiplier + dropoffCorrection.multiplier) / 2;
    const combinedAdjustment = pickupCorrection.adjustmentMinutes + dropoffCorrection.adjustmentMinutes;
    const combinedConfidence = Math.min(pickupCorrection.confidence, dropoffCorrection.confidence);

    const correctedEta = Math.round(baseEtaMinutes * combinedMultiplier + combinedAdjustment);

    return {
      originalEtaMinutes: baseEtaMinutes,
      correctedEtaMinutes: Math.max(correctedEta, baseEtaMinutes),
      multiplier: combinedMultiplier,
      adjustmentMinutes: combinedAdjustment,
      confidence: combinedConfidence,
      factors: {
        pickupArea: pickupCorrection.factors,
        dropoffArea: dropoffCorrection.factors,
      },
    };
  }

  async getTrafficStats(days: number = 7): Promise<Record<string, any>> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const snapshots = await prisma.trafficSnapshot.findMany({
      where: { observedAt: { gte: startDate } },
    });

    const logs = await prisma.automationLog.findMany({
      where: {
        automationType: 'TRAFFIC_ETA_CORRECTION',
        createdAt: { gte: startDate },
      },
    });

    const byCongestion = snapshots.reduce((acc, s) => {
      acc[s.congestionLevel] = (acc[s.congestionLevel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalSnapshots: snapshots.length,
      byCongestionLevel: byCongestion,
      avgCongestionScore:
        snapshots.length > 0
          ? snapshots.reduce((sum, s) => sum + s.congestionScore, 0) / snapshots.length
          : 0,
      avgSpeedKmh:
        snapshots.length > 0
          ? snapshots.reduce((sum, s) => sum + (s.avgSpeedKmh || 0), 0) / snapshots.length
          : 0,
      avgEtaMultiplier:
        snapshots.length > 0
          ? snapshots.reduce((sum, s) => sum + s.etaMultiplier, 0) / snapshots.length
          : 1.0,
      scansCompleted: logs.filter(l => l.status === 'scan_completed').length,
      trafficObservations: logs.filter(l => l.status === 'traffic_recorded').length,
      currentlyCongestedAreas: snapshots.filter(
        s => s.congestionScore > 50 && s.expiresAt > new Date()
      ).length,
    };
  }

  async getHistoricalETAAccuracy(days: number = 14): Promise<Record<string, any>> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const ridesWithETA = await prisma.ride.findMany({
      where: {
        status: 'completed',
        createdAt: { gte: startDate },
        estimatedDuration: { not: null },
        actualDuration: { not: null },
      },
      select: {
        estimatedDuration: true,
        actualDuration: true,
      },
    });

    if (ridesWithETA.length === 0) {
      return { message: 'No completed rides with ETA data', accuracy: null };
    }

    const deviations = ridesWithETA.map(r => {
      const estimated = r.estimatedDuration || 0;
      const actual = r.actualDuration || 0;
      return actual > 0 ? Math.abs((estimated - actual) / actual) : 0;
    });

    const avgDeviation =
      deviations.reduce((sum, d) => sum + d, 0) / deviations.length;
    const accuracy = Math.max(0, 1 - avgDeviation) * 100;

    return {
      ridesAnalyzed: ridesWithETA.length,
      avgDeviationPercent: avgDeviation * 100,
      estimatedAccuracyPercent: accuracy,
      withinFiveMinutes: deviations.filter(d => d <= 0.15).length,
      withinTenMinutes: deviations.filter(d => d <= 0.3).length,
    };
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
      console.error('[TrafficETA] Log error:', error);
    }
  }
}

export const trafficETACorrectionAutomation = TrafficETACorrectionAutomation.getInstance();
