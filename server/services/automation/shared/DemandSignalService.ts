import { prisma } from '../../../db';

interface AreaDemandData {
  areaId: string;
  areaName: string;
  cityCode: string;
  latitude: number;
  longitude: number;
  serviceType: string;
  demandLevel: number;
  supplyLevel: number;
  activeOrders: number;
  activeDrivers: number;
  activeRestaurants: number;
  activeShops: number;
}

interface DemandPrediction {
  predicted15Min: number;
  predicted30Min: number;
  predicted60Min: number;
}

export class DemandSignalService {
  private static instance: DemandSignalService;

  private constructor() {}

  static getInstance(): DemandSignalService {
    if (!DemandSignalService.instance) {
      DemandSignalService.instance = new DemandSignalService();
    }
    return DemandSignalService.instance;
  }

  async calculateAreaDemand(areaId: string, serviceType: string): Promise<AreaDemandData> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    let activeOrders = 0;
    let activeDrivers = 0;
    let activeRestaurants = 0;
    let activeShops = 0;

    if (serviceType === 'ride' || serviceType === 'all') {
      activeOrders += await prisma.ride.count({
        where: {
          status: { in: ['requested', 'driver_assigned', 'picked_up'] },
          createdAt: { gte: oneHourAgo },
        },
      });

      activeDrivers = await prisma.vehicle.count({
        where: { isOnline: true, isActive: true },
      });
    }

    if (serviceType === 'food' || serviceType === 'all') {
      activeOrders += await prisma.foodOrder.count({
        where: {
          status: { in: ['placed', 'confirmed', 'preparing', 'ready'] },
          createdAt: { gte: oneHourAgo },
        },
      });

      activeRestaurants = await prisma.restaurantProfile.count({
        where: { isActive: true },
      });
    }

    if (serviceType === 'shop' || serviceType === 'all') {
      activeShops = await prisma.shopPartner.count({
        where: { isActive: true },
      });
    }

    const demandLevel = Math.min(activeOrders * 10, 100);
    const supplyLevel = Math.min((activeDrivers + activeRestaurants + activeShops) * 5, 100);

    return {
      areaId,
      areaName: `Area ${areaId}`,
      cityCode: 'DEFAULT',
      latitude: 0,
      longitude: 0,
      serviceType,
      demandLevel,
      supplyLevel,
      activeOrders,
      activeDrivers,
      activeRestaurants,
      activeShops,
    };
  }

  predictDemand(currentDemand: number, historicalPattern: number[]): DemandPrediction {
    const avgHistorical = historicalPattern.length > 0
      ? historicalPattern.reduce((sum, val) => sum + val, 0) / historicalPattern.length
      : currentDemand;

    const trend = currentDemand - avgHistorical;
    const trendFactor = trend > 0 ? 1.1 : trend < 0 ? 0.9 : 1.0;

    return {
      predicted15Min: Math.min(currentDemand * trendFactor * 1.05, 100),
      predicted30Min: Math.min(currentDemand * trendFactor * 1.1, 100),
      predicted60Min: Math.min(currentDemand * trendFactor * 1.15, 100),
    };
  }

  calculateImbalance(demandLevel: number, supplyLevel: number): number {
    if (supplyLevel === 0) return 100;
    return ((demandLevel - supplyLevel) / Math.max(demandLevel, supplyLevel)) * 100;
  }

  shouldRecommendSurge(imbalanceScore: number): boolean {
    return imbalanceScore > 30;
  }

  calculateSurgeMultiplier(imbalanceScore: number): number {
    if (imbalanceScore <= 30) return 1.0;
    if (imbalanceScore <= 50) return 1.25;
    if (imbalanceScore <= 70) return 1.5;
    if (imbalanceScore <= 85) return 1.75;
    return 2.0;
  }

  identifyZoneType(data: AreaDemandData): {
    isHotZone: boolean;
    isLowDriverZone: boolean;
    isHighShopLoad: boolean;
  } {
    return {
      isHotZone: data.demandLevel > 70,
      isLowDriverZone: data.activeDrivers < 5 && data.demandLevel > 30,
      isHighShopLoad: data.activeShops > 0 && (data.activeOrders / data.activeShops) > 10,
    };
  }

  async saveDemandSignal(data: AreaDemandData, prediction: DemandPrediction): Promise<void> {
    const imbalanceScore = this.calculateImbalance(data.demandLevel, data.supplyLevel);
    const zoneType = this.identifyZoneType(data);

    await prisma.demandSignal.create({
      data: {
        areaId: data.areaId,
        areaName: data.areaName,
        cityCode: data.cityCode,
        latitude: data.latitude,
        longitude: data.longitude,
        serviceType: data.serviceType,
        demandLevel: data.demandLevel,
        supplyLevel: data.supplyLevel,
        imbalanceScore,
        activeOrders: data.activeOrders,
        activeDrivers: data.activeDrivers,
        activeRestaurants: data.activeRestaurants,
        activeShops: data.activeShops,
        predictedDemand15Min: prediction.predicted15Min,
        predictedDemand30Min: prediction.predicted30Min,
        predictedDemand60Min: prediction.predicted60Min,
        surgeRecommended: this.shouldRecommendSurge(imbalanceScore),
        suggestedSurgeMultiplier: this.calculateSurgeMultiplier(imbalanceScore),
        isHotZone: zoneType.isHotZone,
        isLowDriverZone: zoneType.isLowDriverZone,
        isHighShopLoad: zoneType.isHighShopLoad,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
  }

  async getLatestDemandSignals(serviceType?: string, limit: number = 50): Promise<unknown[]> {
    return prisma.demandSignal.findMany({
      where: {
        ...(serviceType ? { serviceType } : {}),
        expiresAt: { gt: new Date() },
      },
      orderBy: { generatedAt: 'desc' },
      take: limit,
    });
  }

  async getHotZones(serviceType?: string): Promise<unknown[]> {
    return prisma.demandSignal.findMany({
      where: {
        isHotZone: true,
        ...(serviceType ? { serviceType } : {}),
        expiresAt: { gt: new Date() },
      },
      orderBy: { demandLevel: 'desc' },
    });
  }
}

export const demandSignalService = DemandSignalService.getInstance();
