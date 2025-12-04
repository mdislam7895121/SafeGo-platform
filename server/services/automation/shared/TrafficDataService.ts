import { prisma } from '../../../db';

interface TrafficData {
  areaId: string;
  areaName: string;
  latitude: number;
  longitude: number;
  avgSpeedKmh: number;
  congestionScore: number;
  weatherCondition: string;
  weatherImpactScore: number;
}

interface ETACorrection {
  etaMultiplier: number;
  etaAdjustmentMinutes: number;
  confidence: number;
}

export class TrafficDataService {
  private static instance: TrafficDataService;

  private constructor() {}

  static getInstance(): TrafficDataService {
    if (!TrafficDataService.instance) {
      TrafficDataService.instance = new TrafficDataService();
    }
    return TrafficDataService.instance;
  }

  getTimeOfDay(date: Date = new Date()): string {
    const hour = date.getHours();
    if (hour >= 7 && hour < 10) return 'morning_rush';
    if (hour >= 10 && hour < 16) return 'midday';
    if (hour >= 16 && hour < 20) return 'evening_rush';
    return 'night';
  }

  getDayOfWeek(date: Date = new Date()): string {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  }

  isWeekend(date: Date = new Date()): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  calculateCongestionLevel(avgSpeedKmh: number, baselineSpeedKmh: number = 40): string {
    const speedRatio = avgSpeedKmh / baselineSpeedKmh;
    if (speedRatio >= 0.9) return 'free_flow';
    if (speedRatio >= 0.7) return 'light';
    if (speedRatio >= 0.5) return 'moderate';
    if (speedRatio >= 0.3) return 'heavy';
    return 'severe';
  }

  calculateCongestionScore(avgSpeedKmh: number, baselineSpeedKmh: number = 40): number {
    const speedRatio = avgSpeedKmh / baselineSpeedKmh;
    return Math.max(0, Math.min(100, (1 - speedRatio) * 100));
  }

  calculateWeatherImpact(weatherCondition: string): number {
    const impacts: Record<string, number> = {
      clear: 0,
      cloudy: 5,
      rain: 20,
      heavy_rain: 40,
      fog: 30,
      storm: 60,
      snow: 50,
    };
    return impacts[weatherCondition] ?? 10;
  }

  calculateETACorrection(
    congestionScore: number,
    weatherImpactScore: number,
    timeOfDay: string,
    isHoliday: boolean
  ): ETACorrection {
    let baseMultiplier = 1.0;
    let baseAdjustment = 0;

    if (congestionScore > 70) {
      baseMultiplier = 1.5;
      baseAdjustment = 10;
    } else if (congestionScore > 50) {
      baseMultiplier = 1.3;
      baseAdjustment = 5;
    } else if (congestionScore > 30) {
      baseMultiplier = 1.15;
      baseAdjustment = 2;
    }

    if (weatherImpactScore > 30) {
      baseMultiplier += 0.2;
      baseAdjustment += 5;
    } else if (weatherImpactScore > 10) {
      baseMultiplier += 0.1;
      baseAdjustment += 2;
    }

    if (timeOfDay === 'morning_rush' || timeOfDay === 'evening_rush') {
      baseMultiplier += 0.1;
      baseAdjustment += 3;
    }

    if (isHoliday) {
      baseMultiplier -= 0.1;
      baseAdjustment -= 2;
    }

    const confidence = Math.max(0.5, 1 - (congestionScore / 200));

    return {
      etaMultiplier: Math.max(1.0, Math.min(2.5, baseMultiplier)),
      etaAdjustmentMinutes: Math.max(0, Math.min(30, baseAdjustment)),
      confidence,
    };
  }

  async saveTrafficSnapshot(data: TrafficData): Promise<void> {
    const now = new Date();
    const timeOfDay = this.getTimeOfDay(now);
    const dayOfWeek = this.getDayOfWeek(now);
    const isWeekend = this.isWeekend(now);
    
    const congestionLevel = this.calculateCongestionLevel(data.avgSpeedKmh);
    const etaCorrection = this.calculateETACorrection(
      data.congestionScore,
      data.weatherImpactScore,
      timeOfDay,
      false
    );

    await prisma.trafficSnapshot.create({
      data: {
        areaId: data.areaId,
        areaName: data.areaName,
        latitude: data.latitude,
        longitude: data.longitude,
        avgSpeedKmh: data.avgSpeedKmh,
        congestionLevel,
        congestionScore: data.congestionScore,
        weatherCondition: data.weatherCondition,
        weatherImpactScore: data.weatherImpactScore,
        timeOfDay,
        dayOfWeek,
        isWeekend,
        etaMultiplier: etaCorrection.etaMultiplier,
        etaAdjustmentMinutes: etaCorrection.etaAdjustmentMinutes,
        confidence: etaCorrection.confidence,
        expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
      },
    });
  }

  async getLatestTrafficData(areaId: string): Promise<unknown | null> {
    return prisma.trafficSnapshot.findFirst({
      where: {
        areaId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { observedAt: 'desc' },
    });
  }

  async getETACorrectionForArea(areaId: string): Promise<ETACorrection> {
    const traffic = await this.getLatestTrafficData(areaId);
    
    if (!traffic) {
      return { etaMultiplier: 1.0, etaAdjustmentMinutes: 0, confidence: 0.5 };
    }

    const snapshot = traffic as {
      congestionScore: number;
      weatherImpactScore: number | null;
      timeOfDay: string;
      isHoliday: boolean;
    };

    return this.calculateETACorrection(
      snapshot.congestionScore,
      snapshot.weatherImpactScore ?? 0,
      snapshot.timeOfDay,
      snapshot.isHoliday
    );
  }

  async getCongestedAreas(minCongestionScore: number = 50): Promise<unknown[]> {
    return prisma.trafficSnapshot.findMany({
      where: {
        congestionScore: { gte: minCongestionScore },
        expiresAt: { gt: new Date() },
      },
      orderBy: { congestionScore: 'desc' },
    });
  }
}

export const trafficDataService = TrafficDataService.getInstance();
