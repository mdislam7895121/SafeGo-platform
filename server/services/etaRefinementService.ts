import { prisma } from '../db';
import type { DriverEtaProfile } from '@prisma/client';

interface ETACalculation {
  estimatedMinutes: number;
  confidencePercent: number;
  factors: {
    baseMinutes: number;
    trafficFactor: number;
    driverFactor: number;
    timeOfDayFactor: number;
    weatherFactor: number;
  };
}

interface DriverSpeedData {
  avgSpeed: number;
  tripCount: number;
  timestamp: Date;
}

class ETARefinementService {
  async calculateRefinedETA(
    driverId: string,
    distanceMeters: number,
    currentTrafficLevel?: number,
    weatherCondition?: string
  ): Promise<ETACalculation> {
    const profile = await this.getOrCreateProfile(driverId);
    
    const baseMinutes = this.calculateBaseETA(distanceMeters);
    
    const timeOfDay = this.getTimeOfDay();
    const timeOfDayFactor = this.getTimeOfDayFactor(profile, timeOfDay);
    
    const trafficFactor = this.calculateTrafficFactor(currentTrafficLevel);
    
    const weatherFactor = this.calculateWeatherFactor(weatherCondition);
    
    const driverFactor = this.calculateDriverFactor(profile);
    
    const adjustedMinutes = baseMinutes * timeOfDayFactor * trafficFactor * weatherFactor * driverFactor;
    
    const confidencePercent = this.calculateConfidence(profile, currentTrafficLevel);
    
    return {
      estimatedMinutes: Math.round(adjustedMinutes),
      confidencePercent,
      factors: {
        baseMinutes: Math.round(baseMinutes),
        trafficFactor: Math.round(trafficFactor * 100) / 100,
        driverFactor: Math.round(driverFactor * 100) / 100,
        timeOfDayFactor: Math.round(timeOfDayFactor * 100) / 100,
        weatherFactor: Math.round(weatherFactor * 100) / 100,
      },
    };
  }

  async getOrCreateProfile(driverId: string): Promise<DriverEtaProfile> {
    let profile = await prisma.driverEtaProfile.findUnique({
      where: { driverId },
    });
    
    if (!profile) {
      profile = await prisma.driverEtaProfile.create({
        data: {
          driverId,
          avgSpeedCity: 25,
          avgSpeedHighway: 80,
          avgSpeedRush: 15,
          etaAccuracyPercent: 80,
          totalTripsAnalyzed: 0,
          morningRushFactor: 1.3,
          eveningRushFactor: 1.4,
          nightFactor: 0.9,
          last7DaysTrips: 0,
        },
      });
    }
    
    return profile;
  }

  async updateDriverProfile(
    driverId: string,
    tripData: {
      actualDurationMinutes: number;
      estimatedDurationMinutes: number;
      distanceMeters: number;
      timeOfDay: string;
      roadType: 'city' | 'highway' | 'mixed';
    }
  ): Promise<DriverEtaProfile> {
    const profile = await this.getOrCreateProfile(driverId);
    
    const avgSpeedKmh = (tripData.distanceMeters / 1000) / (tripData.actualDurationMinutes / 60);
    
    const updates: any = {
      totalTripsAnalyzed: { increment: 1 },
      last7DaysTrips: { increment: 1 },
      lastCalculatedAt: new Date(),
    };
    
    if (tripData.roadType === 'city') {
      const newAvg = this.calculateMovingAverage(
        Number(profile.avgSpeedCity),
        avgSpeedKmh,
        profile.totalTripsAnalyzed
      );
      updates.avgSpeedCity = newAvg;
    } else if (tripData.roadType === 'highway') {
      const newAvg = this.calculateMovingAverage(
        Number(profile.avgSpeedHighway),
        avgSpeedKmh,
        profile.totalTripsAnalyzed
      );
      updates.avgSpeedHighway = newAvg;
    }
    
    if (tripData.timeOfDay.includes('rush')) {
      const newAvg = this.calculateMovingAverage(
        Number(profile.avgSpeedRush),
        avgSpeedKmh,
        profile.totalTripsAnalyzed
      );
      updates.avgSpeedRush = newAvg;
    }
    
    const etaAccuracy = 100 - Math.abs(
      (tripData.actualDurationMinutes - tripData.estimatedDurationMinutes) / 
      tripData.estimatedDurationMinutes * 100
    );
    
    updates.etaAccuracyPercent = this.calculateMovingAverage(
      Number(profile.etaAccuracyPercent),
      Math.max(0, Math.min(100, etaAccuracy)),
      profile.totalTripsAnalyzed
    );
    
    updates.last7DaysAvgSpeed = this.calculateMovingAverage(
      Number(profile.last7DaysAvgSpeed) || avgSpeedKmh,
      avgSpeedKmh,
      profile.last7DaysTrips
    );
    
    return prisma.driverEtaProfile.update({
      where: { driverId },
      data: updates,
    });
  }

  async recalculateWeeklyStats(): Promise<number> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const result = await prisma.driverEtaProfile.updateMany({
      where: {
        lastCalculatedAt: { lt: oneWeekAgo },
      },
      data: {
        last7DaysTrips: 0,
        last7DaysAvgSpeed: null,
      },
    });
    
    return result.count;
  }

  async getRefinedETA(
    driverId: string,
    currentLat: number,
    currentLng: number,
    destLat: number,
    destLng: number,
    trafficLevel?: number
  ): Promise<{
    etaMinutes: number;
    etaRange: { min: number; max: number };
    confidence: number;
    lastUpdated: Date;
  }> {
    const distanceMeters = this.haversineDistance(currentLat, currentLng, destLat, destLng);
    const calculation = await this.calculateRefinedETA(driverId, distanceMeters, trafficLevel);
    
    const variance = (100 - calculation.confidencePercent) / 100;
    const minEta = Math.max(1, Math.round(calculation.estimatedMinutes * (1 - variance)));
    const maxEta = Math.round(calculation.estimatedMinutes * (1 + variance));
    
    return {
      etaMinutes: calculation.estimatedMinutes,
      etaRange: { min: minEta, max: maxEta },
      confidence: calculation.confidencePercent,
      lastUpdated: new Date(),
    };
  }

  async getDriverStats(driverId: string): Promise<{
    avgSpeedCity: number;
    avgSpeedHighway: number;
    avgSpeedRush: number;
    etaAccuracy: number;
    totalTrips: number;
    last7DaysTrips: number;
  } | null> {
    const profile = await prisma.driverEtaProfile.findUnique({
      where: { driverId },
    });
    
    if (!profile) {
      return null;
    }
    
    return {
      avgSpeedCity: Number(profile.avgSpeedCity),
      avgSpeedHighway: Number(profile.avgSpeedHighway),
      avgSpeedRush: Number(profile.avgSpeedRush),
      etaAccuracy: Number(profile.etaAccuracyPercent),
      totalTrips: profile.totalTripsAnalyzed,
      last7DaysTrips: profile.last7DaysTrips,
    };
  }

  private calculateBaseETA(distanceMeters: number): number {
    const avgSpeedMps = 8.33;
    return (distanceMeters / avgSpeedMps) / 60;
  }

  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour >= 7 && hour < 10) return 'morning_rush';
    if (hour >= 17 && hour < 20) return 'evening_rush';
    if (hour >= 22 || hour < 6) return 'night';
    return 'normal';
  }

  private getTimeOfDayFactor(profile: DriverEtaProfile, timeOfDay: string): number {
    switch (timeOfDay) {
      case 'morning_rush':
        return Number(profile.morningRushFactor);
      case 'evening_rush':
        return Number(profile.eveningRushFactor);
      case 'night':
        return Number(profile.nightFactor);
      default:
        return 1.0;
    }
  }

  private calculateTrafficFactor(trafficLevel?: number): number {
    if (trafficLevel === undefined) {
      return 1.0;
    }
    return 1 + (trafficLevel / 100) * 0.8;
  }

  private calculateWeatherFactor(condition?: string): number {
    switch (condition?.toLowerCase()) {
      case 'rain':
        return 1.2;
      case 'heavy_rain':
        return 1.5;
      case 'snow':
        return 1.8;
      case 'fog':
        return 1.3;
      case 'storm':
        return 2.0;
      default:
        return 1.0;
    }
  }

  private calculateDriverFactor(profile: DriverEtaProfile): number {
    if (profile.totalTripsAnalyzed < 10) {
      return 1.0;
    }
    
    const avgCitySpeed = Number(profile.avgSpeedCity);
    const baselineSpeed = 25;
    
    const speedRatio = avgCitySpeed / baselineSpeed;
    return Math.max(0.7, Math.min(1.3, 1 / speedRatio));
  }

  private calculateConfidence(profile: DriverEtaProfile, trafficLevel?: number): number {
    let baseConfidence = Number(profile.etaAccuracyPercent);
    
    if (profile.totalTripsAnalyzed < 10) {
      baseConfidence *= 0.8;
    }
    
    if (trafficLevel !== undefined && trafficLevel > 50) {
      baseConfidence *= 0.9;
    }
    
    return Math.round(Math.max(50, Math.min(95, baseConfidence)));
  }

  private calculateMovingAverage(oldAvg: number, newValue: number, count: number): number {
    const weight = Math.min(0.1, 1 / (count + 1));
    return oldAvg * (1 - weight) + newValue * weight;
  }

  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const toRad = (deg: number) => deg * (Math.PI / 180);
    
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

export const etaRefinementService = new ETARefinementService();
