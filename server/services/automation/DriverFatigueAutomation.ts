/**
 * SafeGo Driver Fatigue Automation Service (Module 4)
 * Detects driver fatigue indicators:
 * - Long continuous driving sessions
 * - Response delay patterns
 * - Sharp speed changes and hard braking
 * Auto-sends break recommendations
 * Can force drivers offline when critical fatigue detected
 */

import { prisma } from '../../db';

interface DriverSessionData {
  driverId: string;
  sessionStartTime: Date;
  sessionDuration: number;
  tripCount: number;
  avgResponseDelay: number;
  speedVariance: number;
  hardBrakingCount: number;
  lastActivityAt: Date;
}

interface FatigueAssessment {
  driverId: string;
  fatigueIndex: number;
  fatigueLevel: 'normal' | 'mild' | 'moderate' | 'severe' | 'critical';
  indicators: Record<string, any>;
  breakRecommended: boolean;
  forceOffline: boolean;
}

interface DriverFatigueConfig {
  enabled: boolean;
  scanIntervalMs: number;
  thresholds: {
    maxContinuousSessionHours: number;
    maxTripsPerSession: number;
    slowResponseDelaySeconds: number;
    highSpeedVarianceKmh: number;
    maxHardBrakingPerHour: number;
  };
  fatigueScoring: {
    sessionDurationWeight: number;
    tripCountWeight: number;
    responseDelayWeight: number;
    speedVarianceWeight: number;
    hardBrakingWeight: number;
  };
  fatigueLevels: {
    mild: number;
    moderate: number;
    severe: number;
    critical: number;
  };
  actions: {
    sendBreakRecommendationAt: number;
    forceOfflineAt: number;
    requiredBreakMinutes: number;
    cooldownAfterBreakMinutes: number;
  };
  notifications: {
    breakReminderEnabled: boolean;
    adminAlertOnCritical: boolean;
  };
}

class DriverFatigueAutomation {
  private static instance: DriverFatigueAutomation;
  private config: DriverFatigueConfig;
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private driverSessions: Map<string, DriverSessionData> = new Map();

  private constructor() {
    this.config = {
      enabled: true,
      scanIntervalMs: 120000,
      thresholds: {
        maxContinuousSessionHours: 8,
        maxTripsPerSession: 20,
        slowResponseDelaySeconds: 30,
        highSpeedVarianceKmh: 15,
        maxHardBrakingPerHour: 5,
      },
      fatigueScoring: {
        sessionDurationWeight: 0.30,
        tripCountWeight: 0.20,
        responseDelayWeight: 0.25,
        speedVarianceWeight: 0.15,
        hardBrakingWeight: 0.10,
      },
      fatigueLevels: {
        mild: 25,
        moderate: 50,
        severe: 70,
        critical: 85,
      },
      actions: {
        sendBreakRecommendationAt: 50,
        forceOfflineAt: 85,
        requiredBreakMinutes: 30,
        cooldownAfterBreakMinutes: 15,
      },
      notifications: {
        breakReminderEnabled: true,
        adminAlertOnCritical: true,
      },
    };
  }

  static getInstance(): DriverFatigueAutomation {
    if (!DriverFatigueAutomation.instance) {
      DriverFatigueAutomation.instance = new DriverFatigueAutomation();
    }
    return DriverFatigueAutomation.instance;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.scanInterval = setInterval(() => {
      this.runFatigueScan();
    }, this.config.scanIntervalMs);

    await this.logAutomation('DRIVER_FATIGUE', 'SYSTEM', 'started', {
      config: this.config,
    });
    console.log('[DriverFatigue] Automation started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    console.log('[DriverFatigue] Automation stopped');
  }

  getStatus(): { isRunning: boolean; config: DriverFatigueConfig } {
    return { isRunning: this.isRunning, config: this.config };
  }

  updateConfig(updates: Partial<DriverFatigueConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): DriverFatigueConfig {
    return this.config;
  }

  async recordDriverActivity(
    driverId: string,
    activityType: 'trip_start' | 'trip_end' | 'online' | 'offline' | 'location_update',
    data?: {
      responseDelaySeconds?: number;
      currentSpeedKmh?: number;
      hardBraking?: boolean;
    }
  ): Promise<void> {
    let session = this.driverSessions.get(driverId);

    if (activityType === 'online' || !session) {
      session = {
        driverId,
        sessionStartTime: new Date(),
        sessionDuration: 0,
        tripCount: 0,
        avgResponseDelay: 0,
        speedVariance: 0,
        hardBrakingCount: 0,
        lastActivityAt: new Date(),
      };
      this.driverSessions.set(driverId, session);
    }

    if (activityType === 'offline') {
      await this.saveFatigueLog(driverId, session);
      this.driverSessions.delete(driverId);
      return;
    }

    session.lastActivityAt = new Date();
    session.sessionDuration = Math.floor(
      (Date.now() - session.sessionStartTime.getTime()) / 60000
    );

    if (activityType === 'trip_end') {
      session.tripCount++;
    }

    if (data?.responseDelaySeconds !== undefined) {
      const currentDelays = session.avgResponseDelay * (session.tripCount || 1);
      session.avgResponseDelay =
        (currentDelays + data.responseDelaySeconds) / ((session.tripCount || 1) + 1);
    }

    if (data?.hardBraking) {
      session.hardBrakingCount++;
    }

    this.driverSessions.set(driverId, session);
  }

  async assessDriverFatigue(driverId: string): Promise<FatigueAssessment> {
    const session = this.driverSessions.get(driverId);

    if (!session) {
      return {
        driverId,
        fatigueIndex: 0,
        fatigueLevel: 'normal',
        indicators: { message: 'No active session' },
        breakRecommended: false,
        forceOffline: false,
      };
    }

    const indicators = this.calculateFatigueIndicators(session);
    const fatigueIndex = this.calculateFatigueIndex(indicators);
    const fatigueLevel = this.determineFatigueLevel(fatigueIndex);

    const breakRecommended =
      fatigueIndex >= this.config.actions.sendBreakRecommendationAt;
    const forceOffline = fatigueIndex >= this.config.actions.forceOfflineAt;

    const assessment: FatigueAssessment = {
      driverId,
      fatigueIndex,
      fatigueLevel,
      indicators,
      breakRecommended,
      forceOffline,
    };

    if (breakRecommended && !forceOffline) {
      await this.sendBreakRecommendation(driverId, fatigueLevel, fatigueIndex);
    }

    if (forceOffline) {
      await this.forceDriverOffline(driverId, fatigueIndex);
    }

    return assessment;
  }

  private calculateFatigueIndicators(session: DriverSessionData): Record<string, any> {
    const sessionHours = session.sessionDuration / 60;
    const maxSessionHours = this.config.thresholds.maxContinuousSessionHours;
    const sessionScore = Math.min((sessionHours / maxSessionHours) * 100, 100);

    const maxTrips = this.config.thresholds.maxTripsPerSession;
    const tripScore = Math.min((session.tripCount / maxTrips) * 100, 100);

    const slowResponseThreshold = this.config.thresholds.slowResponseDelaySeconds;
    const responseScore = Math.min(
      (session.avgResponseDelay / slowResponseThreshold) * 100,
      100
    );

    const hardBrakingPerHour =
      sessionHours > 0 ? session.hardBrakingCount / sessionHours : 0;
    const maxBrakingPerHour = this.config.thresholds.maxHardBrakingPerHour;
    const brakingScore = Math.min((hardBrakingPerHour / maxBrakingPerHour) * 100, 100);

    return {
      sessionDurationMinutes: session.sessionDuration,
      sessionScore,
      tripCount: session.tripCount,
      tripScore,
      avgResponseDelaySeconds: session.avgResponseDelay,
      responseScore,
      hardBrakingCount: session.hardBrakingCount,
      hardBrakingPerHour,
      brakingScore,
      speedVariance: session.speedVariance,
    };
  }

  private calculateFatigueIndex(indicators: Record<string, any>): number {
    const weights = this.config.fatigueScoring;

    const weightedScore =
      indicators.sessionScore * weights.sessionDurationWeight +
      indicators.tripScore * weights.tripCountWeight +
      indicators.responseScore * weights.responseDelayWeight +
      indicators.brakingScore * weights.hardBrakingWeight +
      (indicators.speedVariance || 0) * weights.speedVarianceWeight;

    return Math.min(Math.round(weightedScore), 100);
  }

  private determineFatigueLevel(
    fatigueIndex: number
  ): 'normal' | 'mild' | 'moderate' | 'severe' | 'critical' {
    const levels = this.config.fatigueLevels;
    if (fatigueIndex >= levels.critical) return 'critical';
    if (fatigueIndex >= levels.severe) return 'severe';
    if (fatigueIndex >= levels.moderate) return 'moderate';
    if (fatigueIndex >= levels.mild) return 'mild';
    return 'normal';
  }

  private async sendBreakRecommendation(
    driverId: string,
    fatigueLevel: string,
    fatigueIndex: number
  ): Promise<void> {
    if (!this.config.notifications.breakReminderEnabled) return;

    const session = this.driverSessions.get(driverId);
    if (!session) return;

    const existingLog = await prisma.driverFatigueLog.findFirst({
      where: {
        driverId,
        breakNotificationSent: true,
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });

    if (existingLog) return;

    await prisma.driverFatigueLog.create({
      data: {
        driverId,
        sessionStartTime: session.sessionStartTime,
        sessionDuration: session.sessionDuration,
        tripCount: session.tripCount,
        fatigueIndex,
        fatigueLevel,
        indicators: {
          avgResponseDelay: session.avgResponseDelay,
          hardBrakingCount: session.hardBrakingCount,
        },
        avgResponseDelay: session.avgResponseDelay,
        hardBrakingCount: session.hardBrakingCount,
        breakRecommended: true,
        breakRecommendedAt: new Date(),
        breakNotificationSent: true,
      },
    });

    await this.logAutomation('DRIVER_FATIGUE', driverId, 'break_recommended', {
      fatigueLevel,
      fatigueIndex,
      sessionDurationMinutes: session.sessionDuration,
      tripCount: session.tripCount,
      requiredBreakMinutes: this.config.actions.requiredBreakMinutes,
    });

    console.log(
      `[DriverFatigue] Break recommendation sent to driver ${driverId} (fatigue: ${fatigueLevel})`
    );
  }

  private async forceDriverOffline(driverId: string, fatigueIndex: number): Promise<void> {
    const session = this.driverSessions.get(driverId);

    try {
      await prisma.vehicle.updateMany({
        where: {
          driver: { id: driverId },
          isOnline: true,
        },
        data: {
          isOnline: false,
        },
      });

      await prisma.driverFatigueLog.create({
        data: {
          driverId,
          sessionStartTime: session?.sessionStartTime || new Date(),
          sessionDuration: session?.sessionDuration || 0,
          tripCount: session?.tripCount || 0,
          fatigueIndex,
          fatigueLevel: 'critical',
          indicators: {
            avgResponseDelay: session?.avgResponseDelay,
            hardBrakingCount: session?.hardBrakingCount,
          },
          avgResponseDelay: session?.avgResponseDelay,
          hardBrakingCount: session?.hardBrakingCount,
          breakRecommended: true,
          breakRecommendedAt: new Date(),
          breakNotificationSent: true,
          forcedOfflineAt: new Date(),
        },
      });

      this.driverSessions.delete(driverId);

      await this.logAutomation('DRIVER_FATIGUE', driverId, 'forced_offline', {
        fatigueIndex,
        reason: 'Critical fatigue level detected',
        requiredRestMinutes: this.config.actions.requiredBreakMinutes,
      });

      if (this.config.notifications.adminAlertOnCritical) {
        await this.logAutomation('DRIVER_FATIGUE', driverId, 'admin_alert', {
          type: 'CRITICAL_FATIGUE',
          fatigueIndex,
          message: 'Driver forcibly taken offline due to critical fatigue',
        });
      }

      console.log(
        `[DriverFatigue] Driver ${driverId} forced offline (fatigue index: ${fatigueIndex})`
      );
    } catch (error) {
      console.error('[DriverFatigue] Failed to force driver offline:', error);
    }
  }

  async recordBreakTaken(driverId: string): Promise<void> {
    const recentLog = await prisma.driverFatigueLog.findFirst({
      where: {
        driverId,
        breakRecommended: true,
        breakTaken: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentLog) {
      await prisma.driverFatigueLog.update({
        where: { id: recentLog.id },
        data: {
          breakTaken: true,
          breakTakenAt: new Date(),
        },
      });

      this.driverSessions.delete(driverId);

      await this.logAutomation('DRIVER_FATIGUE', driverId, 'break_taken', {
        breakDurationMinutes: this.config.actions.requiredBreakMinutes,
      });
    }
  }

  private async saveFatigueLog(
    driverId: string,
    session: DriverSessionData
  ): Promise<void> {
    if (session.sessionDuration < 30) return;

    const indicators = this.calculateFatigueIndicators(session);
    const fatigueIndex = this.calculateFatigueIndex(indicators);
    const fatigueLevel = this.determineFatigueLevel(fatigueIndex);

    try {
      await prisma.driverFatigueLog.create({
        data: {
          driverId,
          sessionStartTime: session.sessionStartTime,
          sessionDuration: session.sessionDuration,
          tripCount: session.tripCount,
          fatigueIndex,
          fatigueLevel,
          indicators,
          avgResponseDelay: session.avgResponseDelay,
          hardBrakingCount: session.hardBrakingCount,
        },
      });
    } catch (error) {
      console.error('[DriverFatigue] Failed to save fatigue log:', error);
    }
  }

  private async runFatigueScan(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const onlineVehicles = await prisma.vehicle.findMany({
        where: { isOnline: true, isActive: true },
        include: { driver: { select: { id: true } } },
        take: 100,
      });

      let assessedCount = 0;
      let breakRecommendedCount = 0;
      let forcedOfflineCount = 0;

      for (const vehicle of onlineVehicles) {
        if (!vehicle.driver?.id) continue;

        const driverId = vehicle.driver.id;

        if (!this.driverSessions.has(driverId)) {
          const lastCompletedTrip = await prisma.ride.findFirst({
            where: { driverId, status: 'completed' },
            orderBy: { completedAt: 'desc' },
          });

          if (lastCompletedTrip?.completedAt) {
            await this.recordDriverActivity(driverId, 'online');

            const tripsSinceOnline = await prisma.ride.count({
              where: {
                driverId,
                status: 'completed',
                completedAt: { gte: new Date(Date.now() - 8 * 60 * 60 * 1000) },
              },
            });

            const session = this.driverSessions.get(driverId);
            if (session) {
              session.tripCount = tripsSinceOnline;
              this.driverSessions.set(driverId, session);
            }
          }
        }

        const assessment = await this.assessDriverFatigue(driverId);
        assessedCount++;

        if (assessment.breakRecommended) breakRecommendedCount++;
        if (assessment.forceOffline) forcedOfflineCount++;
      }

      await this.logAutomation('DRIVER_FATIGUE', 'SYSTEM', 'scan_completed', {
        driversAssessed: assessedCount,
        breakRecommendations: breakRecommendedCount,
        forcedOffline: forcedOfflineCount,
      });
    } catch (error) {
      console.error('[DriverFatigue] Scan error:', error);
      await this.logAutomation('DRIVER_FATIGUE', 'SYSTEM', 'scan_error', {
        error: String(error),
      });
    }
  }

  async getFatigueStats(days: number = 30): Promise<Record<string, any>> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const logs = await prisma.driverFatigueLog.findMany({
      where: { createdAt: { gte: startDate } },
    });

    return {
      totalLogs: logs.length,
      byLevel: {
        normal: logs.filter(l => l.fatigueLevel === 'normal').length,
        mild: logs.filter(l => l.fatigueLevel === 'mild').length,
        moderate: logs.filter(l => l.fatigueLevel === 'moderate').length,
        severe: logs.filter(l => l.fatigueLevel === 'severe').length,
        critical: logs.filter(l => l.fatigueLevel === 'critical').length,
      },
      breakRecommendations: logs.filter(l => l.breakRecommended).length,
      breaksTaken: logs.filter(l => l.breakTaken).length,
      forcedOffline: logs.filter(l => l.forcedOfflineAt).length,
      avgFatigueIndex:
        logs.length > 0
          ? logs.reduce((sum, l) => sum + l.fatigueIndex, 0) / logs.length
          : 0,
      avgSessionDurationMinutes:
        logs.length > 0
          ? logs.reduce((sum, l) => sum + l.sessionDuration, 0) / logs.length
          : 0,
      activeDriverSessions: this.driverSessions.size,
    };
  }

  async getDriverFatigueHistory(driverId: string, limit: number = 10): Promise<any[]> {
    return prisma.driverFatigueLog.findMany({
      where: { driverId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
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
          entityType: 'driver',
          entityId,
          status,
          metadata: details,
        },
      });
    } catch (error) {
      console.error('[DriverFatigue] Log error:', error);
    }
  }
}

export const driverFatigueAutomation = DriverFatigueAutomation.getInstance();
