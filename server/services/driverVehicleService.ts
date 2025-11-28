/**
 * SafeGo Driver Vehicle Service
 * 
 * Manages driver-vehicle binding with validation, document management,
 * and dispatch eligibility enforcement for the 7 vehicle categories.
 * 
 * Key responsibilities:
 * 1. Register and update driver vehicles with validation
 * 2. Enforce one-primary-vehicle constraint per driver
 * 3. Validate vehicle requirements for each category
 * 4. Manage vehicle document status
 * 5. Support admin approval workflow
 */

import { prisma } from '../db';
import { DocumentStatus } from '@prisma/client';
import {
  VehicleCategoryId,
  VehicleBodyType,
  VEHICLE_CATEGORIES,
  validateVehicleForCategory,
  getHighestEligibleCategory,
  canVehicleServeCategory,
  isValidVehicleCategoryId,
  suggestVehicleCategory,
  REVERSE_DISPATCH_ELIGIBILITY,
} from '@shared/vehicleCategories';

// ========================================
// TYPES
// ========================================

export interface VehicleRegistrationInput {
  driverId: string;
  vehicleType: string;
  vehicleModel: string;
  vehiclePlate: string;
  make: string;
  year: number;
  color: string;
  exteriorColor?: string;
  interiorColor?: string;
  licensePlate: string;
  seatCapacity?: number;
  wheelchairAccessible?: boolean;
  isPrimary?: boolean;
  notes?: string;
  tlcLicenseNumber?: string;
  insurancePolicyNumber?: string;
  registrationDocumentUrl?: string;
  registrationExpiry?: Date;
  insuranceDocumentUrl?: string;
  insuranceExpiry?: Date;
  dmvInspectionImageUrl?: string;
  dmvInspectionExpiry?: Date;
  wavCertificationUrl?: string;
  wavCertificationExpiry?: Date;
  plateCountry?: string;
  plateState?: string;
  bodyType?: VehicleBodyType | string;
  luxury?: boolean;
  tlcBaseAffiliation?: string;
  hvfhvPermit?: string;
}

export interface VehicleUpdateInput {
  vehicleType?: string;
  vehicleModel?: string;
  vehiclePlate?: string;
  make?: string;
  year?: number;
  color?: string;
  exteriorColor?: string;
  interiorColor?: string;
  licensePlate?: string;
  seatCapacity?: number;
  wheelchairAccessible?: boolean;
  isPrimary?: boolean;
  notes?: string;
  tlcLicenseNumber?: string;
  insurancePolicyNumber?: string;
  registrationDocumentUrl?: string;
  registrationExpiry?: Date;
  insuranceDocumentUrl?: string;
  insuranceExpiry?: Date;
  dmvInspectionImageUrl?: string;
  dmvInspectionExpiry?: Date;
  wavCertificationUrl?: string;
  wavCertificationExpiry?: Date;
  plateCountry?: string;
  plateState?: string;
  bodyType?: VehicleBodyType | string;
  luxury?: boolean;
  tlcBaseAffiliation?: string;
  hvfhvPermit?: string;
}

export interface VehicleAdminApprovalInput {
  vehicleId: string;
  adminUserId: string;
  vehicleCategory: VehicleCategoryId;
  approved: boolean;
  rejectionReason?: string;
}

export interface VehicleServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  validationErrors?: string[];
  validationWarnings?: string[];
}

// ========================================
// DRIVER VEHICLE SERVICE
// ========================================

export class DriverVehicleService {
  
  /**
   * Register a new vehicle for a driver
   * Note: Vehicle category is NOT auto-assigned. Admin must verify and assign the category.
   * The system auto-suggests a category for admin review.
   */
  async registerVehicle(input: VehicleRegistrationInput): Promise<VehicleServiceResult<any>> {
    try {
      // Validate driver exists
      const driver = await prisma.driverProfile.findUnique({
        where: { id: input.driverId },
        include: { vehicles: true },
      });
      
      if (!driver) {
        return { success: false, error: 'Driver not found' };
      }

      // Auto-suggest category based on vehicle properties (for admin review)
      const suggestion = suggestVehicleCategory({
        bodyType: input.bodyType,
        seats: input.seatCapacity,
        year: input.year,
        make: input.make,
        luxury: input.luxury,
        wheelchairAccessible: input.wheelchairAccessible,
        exteriorColor: input.exteriorColor || input.color,
        interiorColor: input.interiorColor,
      });

      // Handle primary vehicle constraint
      const isPrimary = input.isPrimary ?? (driver.vehicles.length === 0);
      
      if (isPrimary) {
        // Unset any existing primary vehicles
        await prisma.vehicle.updateMany({
          where: { driverId: input.driverId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      // Create the vehicle - NO vehicleCategory assigned, admin must approve
      const vehicle = await prisma.vehicle.create({
        data: {
          driverId: input.driverId,
          vehicleType: input.vehicleType,
          vehicleModel: input.vehicleModel,
          vehiclePlate: input.vehiclePlate,
          make: input.make,
          year: input.year,
          color: input.color,
          exteriorColor: input.exteriorColor || input.color,
          interiorColor: input.interiorColor,
          licensePlate: input.licensePlate,
          seatCapacity: input.seatCapacity,
          wheelchairAccessible: input.wheelchairAccessible ?? false,
          vehicleCategoryStatus: DocumentStatus.PENDING,
          isPrimary,
          isActive: true,
          notes: input.notes,
          tlcLicenseNumber: input.tlcLicenseNumber,
          insurancePolicyNumber: input.insurancePolicyNumber,
          registrationDocumentUrl: input.registrationDocumentUrl,
          registrationExpiry: input.registrationExpiry,
          registrationStatus: input.registrationDocumentUrl ? DocumentStatus.PENDING : DocumentStatus.PENDING,
          insuranceDocumentUrl: input.insuranceDocumentUrl,
          insuranceExpiry: input.insuranceExpiry,
          insuranceStatus: input.insuranceDocumentUrl ? DocumentStatus.PENDING : DocumentStatus.PENDING,
          dmvInspectionImageUrl: input.dmvInspectionImageUrl,
          dmvInspectionExpiry: input.dmvInspectionExpiry,
          wavCertificationUrl: input.wavCertificationUrl,
          wavCertificationExpiry: input.wavCertificationExpiry,
          wavCertificationStatus: input.wavCertificationUrl ? DocumentStatus.PENDING : DocumentStatus.PENDING,
          plateCountry: input.plateCountry,
          plateState: input.plateState,
          bodyType: input.bodyType,
          luxury: input.luxury ?? false,
          suggestedCategory: suggestion.suggestedCategory,
          suggestedCategoryReasons: suggestion.reasons,
          vehicleVerificationStatus: 'PENDING_VERIFICATION',
          tlcBaseAffiliation: input.tlcBaseAffiliation,
          hvfhvPermit: input.hvfhvPermit,
          updatedAt: new Date(),
        },
      });

      console.log(`[DriverVehicleService] Registered vehicle ${vehicle.id} for driver ${input.driverId}, suggested: ${suggestion.suggestedCategory} (${suggestion.confidence})`);

      return { 
        success: true, 
        data: {
          ...vehicle,
          suggestion: {
            suggestedCategory: suggestion.suggestedCategory,
            confidence: suggestion.confidence,
            reasons: suggestion.reasons,
          },
        },
      };
    } catch (error: any) {
      console.error('[DriverVehicleService] Error registering vehicle:', error);
      return { success: false, error: error.message || 'Failed to register vehicle' };
    }
  }

  /**
   * Update an existing vehicle
   * Note: Updates to vehicle properties reset verification status for admin re-review
   */
  async updateVehicle(vehicleId: string, driverId: string, input: VehicleUpdateInput): Promise<VehicleServiceResult<any>> {
    try {
      const existingVehicle = await prisma.vehicle.findFirst({
        where: { id: vehicleId, driverId },
      });

      if (!existingVehicle) {
        return { success: false, error: 'Vehicle not found or does not belong to driver' };
      }

      // Handle primary vehicle changes
      if (input.isPrimary === true && !existingVehicle.isPrimary) {
        await prisma.vehicle.updateMany({
          where: { driverId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      // Re-calculate suggested category if relevant properties changed
      const vehiclePropsChanged = (
        input.bodyType !== undefined ||
        input.seatCapacity !== undefined ||
        input.year !== undefined ||
        input.make !== undefined ||
        input.luxury !== undefined ||
        input.wheelchairAccessible !== undefined ||
        input.exteriorColor !== undefined ||
        input.interiorColor !== undefined
      );

      let suggestion = null;
      if (vehiclePropsChanged) {
        suggestion = suggestVehicleCategory({
          bodyType: input.bodyType ?? existingVehicle.bodyType,
          seats: input.seatCapacity ?? existingVehicle.seatCapacity,
          year: input.year ?? existingVehicle.year,
          make: input.make ?? existingVehicle.make,
          luxury: input.luxury ?? existingVehicle.luxury,
          wheelchairAccessible: input.wheelchairAccessible ?? existingVehicle.wheelchairAccessible,
          exteriorColor: input.exteriorColor ?? existingVehicle.exteriorColor,
          interiorColor: input.interiorColor ?? existingVehicle.interiorColor,
        });
      }

      // Prepare update data (exclude any undefined values)
      const updateData: any = {
        updatedAt: new Date(),
      };
      
      if (input.vehicleType !== undefined) updateData.vehicleType = input.vehicleType;
      if (input.vehicleModel !== undefined) updateData.vehicleModel = input.vehicleModel;
      if (input.vehiclePlate !== undefined) updateData.vehiclePlate = input.vehiclePlate;
      if (input.make !== undefined) updateData.make = input.make;
      if (input.year !== undefined) updateData.year = input.year;
      if (input.color !== undefined) updateData.color = input.color;
      if (input.exteriorColor !== undefined) updateData.exteriorColor = input.exteriorColor;
      if (input.interiorColor !== undefined) updateData.interiorColor = input.interiorColor;
      if (input.licensePlate !== undefined) updateData.licensePlate = input.licensePlate;
      if (input.seatCapacity !== undefined) updateData.seatCapacity = input.seatCapacity;
      if (input.wheelchairAccessible !== undefined) updateData.wheelchairAccessible = input.wheelchairAccessible;
      if (input.isPrimary !== undefined) updateData.isPrimary = input.isPrimary;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.tlcLicenseNumber !== undefined) updateData.tlcLicenseNumber = input.tlcLicenseNumber;
      if (input.insurancePolicyNumber !== undefined) updateData.insurancePolicyNumber = input.insurancePolicyNumber;
      if (input.registrationDocumentUrl !== undefined) updateData.registrationDocumentUrl = input.registrationDocumentUrl;
      if (input.registrationExpiry !== undefined) updateData.registrationExpiry = input.registrationExpiry;
      if (input.insuranceDocumentUrl !== undefined) updateData.insuranceDocumentUrl = input.insuranceDocumentUrl;
      if (input.insuranceExpiry !== undefined) updateData.insuranceExpiry = input.insuranceExpiry;
      if (input.dmvInspectionImageUrl !== undefined) updateData.dmvInspectionImageUrl = input.dmvInspectionImageUrl;
      if (input.dmvInspectionExpiry !== undefined) updateData.dmvInspectionExpiry = input.dmvInspectionExpiry;
      if (input.wavCertificationUrl !== undefined) updateData.wavCertificationUrl = input.wavCertificationUrl;
      if (input.wavCertificationExpiry !== undefined) updateData.wavCertificationExpiry = input.wavCertificationExpiry;
      if (input.plateCountry !== undefined) updateData.plateCountry = input.plateCountry;
      if (input.plateState !== undefined) updateData.plateState = input.plateState;
      if (input.bodyType !== undefined) updateData.bodyType = input.bodyType;
      if (input.luxury !== undefined) updateData.luxury = input.luxury;
      if (input.tlcBaseAffiliation !== undefined) updateData.tlcBaseAffiliation = input.tlcBaseAffiliation;
      if (input.hvfhvPermit !== undefined) updateData.hvfhvPermit = input.hvfhvPermit;

      // Update suggestion if properties changed
      if (suggestion) {
        updateData.suggestedCategory = suggestion.suggestedCategory;
        updateData.suggestedCategoryReasons = suggestion.reasons;
        // Reset verification status for re-review
        updateData.vehicleVerificationStatus = 'PENDING_VERIFICATION';
        updateData.vehicleCategory = null;
        updateData.vehicleCategoryStatus = DocumentStatus.PENDING;
      }

      const vehicle = await prisma.vehicle.update({
        where: { id: vehicleId },
        data: updateData,
      });

      console.log(`[DriverVehicleService] Updated vehicle ${vehicleId} for driver ${driverId}`);

      return { 
        success: true, 
        data: {
          ...vehicle,
          suggestion: suggestion ? {
            suggestedCategory: suggestion.suggestedCategory,
            confidence: suggestion.confidence,
            reasons: suggestion.reasons,
          } : undefined,
        },
      };
    } catch (error: any) {
      console.error('[DriverVehicleService] Error updating vehicle:', error);
      return { success: false, error: error.message || 'Failed to update vehicle' };
    }
  }

  /**
   * Set a vehicle as the primary vehicle for a driver
   */
  async setPrimaryVehicle(vehicleId: string, driverId: string): Promise<VehicleServiceResult<any>> {
    try {
      const vehicle = await prisma.vehicle.findFirst({
        where: { id: vehicleId, driverId, isActive: true },
      });

      if (!vehicle) {
        return { success: false, error: 'Vehicle not found or not active' };
      }

      // Unset existing primary
      await prisma.vehicle.updateMany({
        where: { driverId, isPrimary: true },
        data: { isPrimary: false },
      });

      // Set new primary
      const updatedVehicle = await prisma.vehicle.update({
        where: { id: vehicleId },
        data: { isPrimary: true, updatedAt: new Date() },
      });

      console.log(`[DriverVehicleService] Set vehicle ${vehicleId} as primary for driver ${driverId}`);

      return { success: true, data: updatedVehicle };
    } catch (error: any) {
      console.error('[DriverVehicleService] Error setting primary vehicle:', error);
      return { success: false, error: error.message || 'Failed to set primary vehicle' };
    }
  }

  /**
   * Get driver's primary vehicle
   */
  async getPrimaryVehicle(driverId: string): Promise<VehicleServiceResult<any>> {
    try {
      const vehicle = await prisma.vehicle.findFirst({
        where: { driverId, isPrimary: true, isActive: true },
      });

      if (!vehicle) {
        return { success: false, error: 'No primary vehicle found' };
      }

      return { success: true, data: vehicle };
    } catch (error: any) {
      console.error('[DriverVehicleService] Error getting primary vehicle:', error);
      return { success: false, error: error.message || 'Failed to get primary vehicle' };
    }
  }

  /**
   * Get all vehicles for a driver
   */
  async getDriverVehicles(driverId: string, includeInactive: boolean = false): Promise<VehicleServiceResult<any[]>> {
    try {
      const vehicles = await prisma.vehicle.findMany({
        where: {
          driverId,
          ...(includeInactive ? {} : { isActive: true }),
        },
        orderBy: [
          { isPrimary: 'desc' },
          { createdAt: 'desc' },
        ],
      });

      return { success: true, data: vehicles };
    } catch (error: any) {
      console.error('[DriverVehicleService] Error getting driver vehicles:', error);
      return { success: false, error: error.message || 'Failed to get driver vehicles' };
    }
  }

  /**
   * Admin: Approve or reject a vehicle's category
   */
  async adminApproveVehicleCategory(input: VehicleAdminApprovalInput): Promise<VehicleServiceResult<any>> {
    try {
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: input.vehicleId },
      });

      if (!vehicle) {
        return { success: false, error: 'Vehicle not found' };
      }

      // Validate category if approving
      if (input.approved && isValidVehicleCategoryId(input.vehicleCategory)) {
        const validation = validateVehicleForCategory(
          {
            make: vehicle.make,
            year: vehicle.year,
            color: vehicle.color,
            exteriorColor: vehicle.exteriorColor,
            interiorColor: vehicle.interiorColor,
            wheelchairAccessible: vehicle.wheelchairAccessible,
            seatCapacity: vehicle.seatCapacity,
          },
          input.vehicleCategory
        );

        if (!validation.isValid) {
          return {
            success: false,
            error: 'Vehicle does not meet category requirements for admin approval',
            validationErrors: validation.errors,
            validationWarnings: validation.warnings,
          };
        }
      }

      const updatedVehicle = await prisma.vehicle.update({
        where: { id: input.vehicleId },
        data: {
          vehicleCategory: input.vehicleCategory,
          vehicleCategoryStatus: input.approved ? DocumentStatus.APPROVED : DocumentStatus.REJECTED,
          vehicleCategoryApprovedAt: input.approved ? new Date() : null,
          vehicleCategoryApprovedBy: input.approved ? input.adminUserId : null,
          updatedAt: new Date(),
        },
      });

      console.log(`[DriverVehicleService] Admin ${input.adminUserId} ${input.approved ? 'approved' : 'rejected'} vehicle ${input.vehicleId} for category ${input.vehicleCategory}`);

      return { success: true, data: updatedVehicle };
    } catch (error: any) {
      console.error('[DriverVehicleService] Error in admin approval:', error);
      return { success: false, error: error.message || 'Failed to process admin approval' };
    }
  }

  /**
   * Check if a driver is eligible for a requested ride category
   */
  async isDriverEligibleForCategory(
    driverId: string,
    requestedCategory: VehicleCategoryId
  ): Promise<VehicleServiceResult<{ eligible: boolean; reason?: string }>> {
    try {
      const primaryVehicle = await prisma.vehicle.findFirst({
        where: {
          driverId,
          isPrimary: true,
          isActive: true,
          vehicleCategoryStatus: DocumentStatus.APPROVED,
        },
      });

      if (!primaryVehicle) {
        return {
          success: true,
          data: {
            eligible: false,
            reason: 'Driver does not have an approved primary vehicle',
          },
        };
      }

      if (!primaryVehicle.vehicleCategory || !isValidVehicleCategoryId(primaryVehicle.vehicleCategory)) {
        return {
          success: true,
          data: {
            eligible: false,
            reason: 'Driver vehicle category is not set or not approved',
          },
        };
      }

      const eligibility = canVehicleServeCategory(
        primaryVehicle.vehicleCategory as VehicleCategoryId,
        requestedCategory
      );

      return {
        success: true,
        data: {
          eligible: eligibility.isEligible,
          reason: eligibility.reason,
        },
      };
    } catch (error: any) {
      console.error('[DriverVehicleService] Error checking eligibility:', error);
      return { success: false, error: error.message || 'Failed to check eligibility' };
    }
  }

  /**
   * Get eligible drivers for a category (for dispatch)
   */
  async getEligibleDriversForCategory(
    requestedCategory: VehicleCategoryId,
    options?: {
      limit?: number;
      isOnline?: boolean;
    }
  ): Promise<VehicleServiceResult<any[]>> {
    try {
      const { limit = 50, isOnline } = options || {};

      // Get the categories that can serve this ride
      const eligibleCategories = this.getEligibleVehicleCategories(requestedCategory);

      const vehicles = await prisma.vehicle.findMany({
        where: {
          isPrimary: true,
          isActive: true,
          vehicleCategoryStatus: DocumentStatus.APPROVED,
          vehicleCategory: { in: eligibleCategories },
          ...(isOnline !== undefined ? { isOnline } : {}),
        },
        include: {
          driver: {
            include: {
              driverStats: true,
            },
          },
        },
        take: limit,
      });

      return { success: true, data: vehicles };
    } catch (error: any) {
      console.error('[DriverVehicleService] Error getting eligible drivers:', error);
      return { success: false, error: error.message || 'Failed to get eligible drivers' };
    }
  }

  /**
   * Get vehicle categories that can serve a requested category
   */
  private getEligibleVehicleCategories(requestedCategory: VehicleCategoryId): string[] {
    const reverseMap: Record<VehicleCategoryId, VehicleCategoryId[]> = {
      SAFEGO_X: ["SAFEGO_X", "SAFEGO_COMFORT", "SAFEGO_COMFORT_XL", "SAFEGO_XL", "SAFEGO_BLACK", "SAFEGO_BLACK_SUV"],
      SAFEGO_COMFORT: ["SAFEGO_COMFORT", "SAFEGO_COMFORT_XL", "SAFEGO_XL", "SAFEGO_BLACK", "SAFEGO_BLACK_SUV"],
      SAFEGO_COMFORT_XL: ["SAFEGO_COMFORT_XL", "SAFEGO_XL"],
      SAFEGO_XL: ["SAFEGO_XL"],
      SAFEGO_BLACK: ["SAFEGO_BLACK", "SAFEGO_BLACK_SUV"],
      SAFEGO_BLACK_SUV: ["SAFEGO_BLACK_SUV"],
      SAFEGO_WAV: ["SAFEGO_WAV"],
    };
    return reverseMap[requestedCategory] || [];
  }

  /**
   * Deactivate a vehicle (soft delete)
   */
  async deactivateVehicle(vehicleId: string, driverId: string): Promise<VehicleServiceResult<any>> {
    try {
      const vehicle = await prisma.vehicle.findFirst({
        where: { id: vehicleId, driverId },
      });

      if (!vehicle) {
        return { success: false, error: 'Vehicle not found' };
      }

      const updatedVehicle = await prisma.vehicle.update({
        where: { id: vehicleId },
        data: {
          isActive: false,
          isPrimary: false,
          isOnline: false,
          updatedAt: new Date(),
        },
      });

      // If this was the primary vehicle, try to set another as primary
      if (vehicle.isPrimary) {
        const nextVehicle = await prisma.vehicle.findFirst({
          where: { driverId, isActive: true, id: { not: vehicleId } },
          orderBy: { createdAt: 'desc' },
        });

        if (nextVehicle) {
          await prisma.vehicle.update({
            where: { id: nextVehicle.id },
            data: { isPrimary: true, updatedAt: new Date() },
          });
        }
      }

      console.log(`[DriverVehicleService] Deactivated vehicle ${vehicleId} for driver ${driverId}`);

      return { success: true, data: updatedVehicle };
    } catch (error: any) {
      console.error('[DriverVehicleService] Error deactivating vehicle:', error);
      return { success: false, error: error.message || 'Failed to deactivate vehicle' };
    }
  }

  /**
   * Get vehicles pending admin approval
   */
  async getVehiclesPendingApproval(options?: {
    limit?: number;
    offset?: number;
  }): Promise<VehicleServiceResult<{ vehicles: any[]; total: number }>> {
    try {
      const { limit = 20, offset = 0 } = options || {};

      const [vehicles, total] = await Promise.all([
        prisma.vehicle.findMany({
          where: {
            vehicleCategoryStatus: DocumentStatus.PENDING,
            isActive: true,
          },
          include: {
            driver: {
              select: {
                id: true,
                fullName: true,
                firstName: true,
                lastName: true,
                phoneNumber: true,
                tlcLicenseNumber: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
          skip: offset,
          take: limit,
        }),
        prisma.vehicle.count({
          where: {
            vehicleCategoryStatus: DocumentStatus.PENDING,
            isActive: true,
          },
        }),
      ]);

      return { success: true, data: { vehicles, total } };
    } catch (error: any) {
      console.error('[DriverVehicleService] Error getting pending vehicles:', error);
      return { success: false, error: error.message || 'Failed to get pending vehicles' };
    }
  }
}

export const driverVehicleService = new DriverVehicleService();
