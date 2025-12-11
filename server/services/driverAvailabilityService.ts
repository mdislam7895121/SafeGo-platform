/**
 * SafeGo Driver Availability Service (C5)
 * 
 * Provides real-time driver availability counts and ETA estimates per vehicle category.
 * ETA is calculated based on nearby driver count:
 * - 10+ drivers → 2 min
 * - 5-9 drivers → 5 min
 * - 1-4 drivers → 8 min
 * - 0 drivers → null (No drivers nearby)
 * 
 * This service does NOT modify TLC fees, fare logic, commission, or dispatch rules.
 */

import { prisma } from '../db';
import { DocumentStatus } from '@prisma/client';
import {
  VehicleCategoryId,
  VEHICLE_CATEGORY_ORDER,
  VEHICLE_CATEGORIES,
  REVERSE_DISPATCH_ELIGIBILITY,
} from '@shared/vehicleCategories';

export type AvailabilityLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export interface CategoryAvailability {
  categoryId: VehicleCategoryId;
  driverCount: number;
  etaMinutes: number | null;
  etaText: string;
  availabilityLevel: AvailabilityLevel;
  isAvailable: boolean;
}

export interface AvailabilityResult {
  categories: CategoryAvailability[];
  totalNearbyDrivers: number;
  timestamp: Date;
  pickupLocation?: {
    lat: number;
    lng: number;
  };
}

export class DriverAvailabilityService {
  private static instance: DriverAvailabilityService;

  public static getInstance(): DriverAvailabilityService {
    if (!DriverAvailabilityService.instance) {
      DriverAvailabilityService.instance = new DriverAvailabilityService();
    }
    return DriverAvailabilityService.instance;
  }

  /**
   * Calculate ETA minutes based on driver count
   * - 10+ drivers → 2 min
   * - 5-9 drivers → 5 min  
   * - 1-4 drivers → 8 min
   * - 0 drivers → null
   */
  calculateETAFromDriverCount(driverCount: number): number | null {
    if (driverCount >= 10) return 2;
    if (driverCount >= 5) return 5;
    if (driverCount >= 1) return 8;
    return null;
  }

  /**
   * Get availability level from driver count
   */
  getAvailabilityLevel(driverCount: number): AvailabilityLevel {
    if (driverCount >= 10) return 'HIGH';
    if (driverCount >= 5) return 'MEDIUM';
    if (driverCount >= 1) return 'LOW';
    return 'NONE';
  }

  /**
   * Format ETA text for display
   */
  formatETAText(etaMinutes: number | null): string {
    if (etaMinutes === null) return 'No drivers nearby';
    if (etaMinutes <= 2) return '2 min away';
    if (etaMinutes <= 5) return '5 min away';
    if (etaMinutes <= 8) return '8 min away';
    return `${etaMinutes} min away`;
  }

  /**
   * Get online driver counts per category from database
   * In production, this would use real-time location data
   */
  async getOnlineDriverCountsByCategory(): Promise<Record<VehicleCategoryId, number>> {
    const counts: Record<VehicleCategoryId, number> = {
      SAFEGO_X: 0,
      SAFEGO_COMFORT: 0,
      SAFEGO_COMFORT_XL: 0,
      SAFEGO_XL: 0,
      SAFEGO_BLACK: 0,
      SAFEGO_BLACK_SUV: 0,
      SAFEGO_WAV: 0,
    };

    try {
      const onlineVehicles = await prisma.vehicle.findMany({
        where: {
          isPrimary: true,
          isActive: true,
          isOnline: true,
          vehicleCategoryStatus: DocumentStatus.APPROVED,
          vehicleCategory: { not: null },
        },
        select: {
          vehicleCategory: true,
        },
      });

      for (const vehicle of onlineVehicles) {
        if (vehicle.vehicleCategory) {
          const category = vehicle.vehicleCategory as VehicleCategoryId;
          if (category in counts) {
            counts[category]++;
          }
        }
      }
    } catch (error) {
      console.error('[DriverAvailabilityService] Error fetching driver counts:', error);
    }

    return counts;
  }

  /**
   * Get mock driver counts for demo mode
   * Provides realistic distribution across categories
   */
  getMockDriverCounts(): Record<VehicleCategoryId, number> {
    return {
      SAFEGO_X: 15,
      SAFEGO_COMFORT: 8,
      SAFEGO_COMFORT_XL: 4,
      SAFEGO_XL: 6,
      SAFEGO_BLACK: 3,
      SAFEGO_BLACK_SUV: 2,
      SAFEGO_WAV: 1,
    };
  }

  /**
   * Calculate available drivers for a requested category
   * Takes into account dispatch eligibility (e.g., Comfort drivers can serve X requests)
   */
  calculateAvailableDriversForCategory(
    requestedCategory: VehicleCategoryId,
    driverCounts: Record<VehicleCategoryId, number>
  ): number {
    const eligibleCategories = REVERSE_DISPATCH_ELIGIBILITY[requestedCategory] || [requestedCategory];
    let totalAvailable = 0;
    
    for (const eligibleCategory of eligibleCategories) {
      totalAvailable += driverCounts[eligibleCategory] || 0;
    }
    
    return totalAvailable;
  }

  /**
   * Get availability for all categories
   */
  async getCategoryAvailability(
    pickupLat?: number,
    pickupLng?: number,
    useMockData: boolean = true
  ): Promise<AvailabilityResult> {
    const driverCounts = useMockData 
      ? this.getMockDriverCounts() 
      : await this.getOnlineDriverCountsByCategory();

    const categories: CategoryAvailability[] = VEHICLE_CATEGORY_ORDER.map(categoryId => {
      const availableDrivers = this.calculateAvailableDriversForCategory(categoryId, driverCounts);
      const etaMinutes = this.calculateETAFromDriverCount(availableDrivers);
      const availabilityLevel = this.getAvailabilityLevel(availableDrivers);

      return {
        categoryId,
        driverCount: availableDrivers,
        etaMinutes,
        etaText: this.formatETAText(etaMinutes),
        availabilityLevel,
        isAvailable: availableDrivers > 0,
      };
    });

    const totalNearbyDrivers = Object.values(driverCounts).reduce((sum, count) => sum + count, 0);

    return {
      categories,
      totalNearbyDrivers,
      timestamp: new Date(),
      pickupLocation: pickupLat && pickupLng ? { lat: pickupLat, lng: pickupLng } : undefined,
    };
  }

  /**
   * Get availability for a single category
   */
  async getSingleCategoryAvailability(
    categoryId: VehicleCategoryId,
    pickupLat?: number,
    pickupLng?: number,
    useMockData: boolean = true
  ): Promise<CategoryAvailability> {
    const driverCounts = useMockData
      ? this.getMockDriverCounts()
      : await this.getOnlineDriverCountsByCategory();

    const availableDrivers = this.calculateAvailableDriversForCategory(categoryId, driverCounts);
    const etaMinutes = this.calculateETAFromDriverCount(availableDrivers);
    const availabilityLevel = this.getAvailabilityLevel(availableDrivers);

    return {
      categoryId,
      driverCount: availableDrivers,
      etaMinutes,
      etaText: this.formatETAText(etaMinutes),
      availabilityLevel,
      isAvailable: availableDrivers > 0,
    };
  }
}

export const driverAvailabilityService = DriverAvailabilityService.getInstance();
