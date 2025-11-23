import { PrismaClient } from "@prisma/client";
import type { CountryCode, PayoutRailType, PayoutProvider, PayoutMethodStatus } from "../../shared/types";
import { encryptSensitive } from "../utils/crypto";
import { PayoutConfigService } from "./PayoutConfigService";

const db = new PrismaClient();

export class RestaurantPayoutMethodService {
  /**
   * Get all payout methods for a restaurant
   * Note: Metadata is encrypted and should not be exposed to frontend
   */
  static async getRestaurantPayoutMethods(restaurantId: string) {
    const methods = await db.restaurantPayoutMethod.findMany({
      where: {
        actorType: "RESTAURANT",
        restaurantId,
      },
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "desc" },
      ],
    });

    // Return methods without decrypting metadata (frontend only sees masked details)
    return methods;
  }

  /**
   * Get a single payout method by ID (with ownership check)
   */
  static async getPayoutMethodById(id: string, restaurantId: string) {
    const method = await db.restaurantPayoutMethod.findFirst({
      where: {
        id,
        actorType: "RESTAURANT",
        restaurantId,
      },
    });

    return method;
  }

  /**
   * Create a new payout method for a restaurant
   * SECURITY: Validates against approved payout rails and encrypts sensitive metadata
   */
  static async createPayoutMethod(data: {
    restaurantId: string;
    countryCode: CountryCode;
    payoutRailType: PayoutRailType;
    provider: PayoutProvider;
    currency: string;
    maskedDetails: string;
    metadata?: any;
    isDefault?: boolean;
    actorRole: string;
    createdByActorId: string;
  }) {
    const { restaurantId, isDefault = false, countryCode, payoutRailType, provider, metadata, ...rest } = data;

    // Fetch restaurant profile to get KYC level
    const restaurant = await db.restaurantProfile.findUnique({
      where: { id: restaurantId },
      select: { 
        isVerified: true, 
        verificationStatus: true,
        countryCode: true,
        nidNumber: true, // BD KYC
        governmentIdLast4: true, // US KYC
        fatherName: true, // BD KYC
        dateOfBirth: true, // Common KYC
      },
    });

    if (!restaurant) {
      const error: any = new Error("Restaurant not found");
      error.statusCode = 404;
      throw error;
    }

    // SECURITY: Use restaurant's actual country code, ignore client-supplied value
    // This prevents country code spoofing attacks - we derive country from restaurant profile
    const actualCountryCode = restaurant.countryCode || "BD"; // Default to BD if not set
    
    // Note: Client-supplied countryCode is completely ignored for security
    // We always use the restaurant's registered country code

    // Infer KYC level from verification status and submitted documents
    // NOTE: This is a temporary mapping until a dedicated kycLevel field is added to the schema
    let kycLevel: "NONE" | "BASIC" | "FULL" = "NONE";
    
    // Case-insensitive check for approved status (supports both "approved" and "APPROVED")
    const isApproved = restaurant.isVerified && 
      restaurant.verificationStatus?.toLowerCase() === "approved";
    
    if (isApproved) {
      // Check if restaurant has submitted full KYC documents
      const hasFullKyc = 
        (actualCountryCode === "BD" && restaurant.nidNumber && restaurant.fatherName) ||
        (actualCountryCode === "US" && restaurant.governmentIdLast4 && restaurant.dateOfBirth) ||
        (actualCountryCode !== "BD" && actualCountryCode !== "US"); // Other countries default to FULL if verified
      
      if (hasFullKyc) {
        kycLevel = "FULL";
      } else if (restaurant.dateOfBirth) {
        // Has basic information but not full KYC
        kycLevel = "BASIC";
      }
    }

    // CRITICAL: Validate that this payout rail is approved for this country and KYC level
    // Use actualCountryCode (from restaurant profile) not client-supplied countryCode
    const availableRails = await PayoutConfigService.getPayoutRails({
      countryCode: actualCountryCode as CountryCode,
      actorType: "RESTAURANT",
      kycLevel: kycLevel as any,
    });
    
    const validRail = availableRails.find(
      (rail) =>
        rail.payoutRailType === payoutRailType &&
        rail.provider === provider
    );

    if (!validRail) {
      const error: any = new Error(
        `Invalid payout method: ${payoutRailType} with provider ${provider} is not approved for ${countryCode} restaurants with ${kycLevel} KYC level`
      );
      error.statusCode = 400;
      throw error;
    }

    // CRITICAL: Encrypt sensitive metadata before storing
    let encryptedMetadata: string | null = null;
    if (metadata) {
      try {
        const metadataJson = JSON.stringify(metadata);
        encryptedMetadata = encryptSensitive(metadataJson);
        
        if (!encryptedMetadata) {
          const error: any = new Error("Failed to encrypt payout method metadata");
          error.statusCode = 500;
          throw error;
        }
      } catch (encryptError: any) {
        const error: any = new Error("Failed to encrypt payout method metadata: " + (encryptError.message || "Unknown error"));
        error.statusCode = 500;
        throw error;
      }
    }

    // If this is being set as default, unset any existing default
    if (isDefault) {
      await db.restaurantPayoutMethod.updateMany({
        where: {
          actorType: "RESTAURANT",
          restaurantId,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    const method = await db.restaurantPayoutMethod.create({
      data: {
        actorType: "RESTAURANT",
        restaurantId,
        countryCode: actualCountryCode, // Use restaurant's actual country code, not client-supplied
        payoutRailType,
        provider,
        isDefault,
        status: "PENDING_VERIFICATION",
        metadata: encryptedMetadata, // Store encrypted metadata
        ...rest,
      },
    });

    // Return without decrypting metadata (frontend only needs masked details)
    return method;
  }

  /**
   * Update a payout method (status, default flag)
   */
  static async updatePayoutMethod(
    id: string,
    restaurantId: string,
    data: {
      status?: PayoutMethodStatus;
      isDefault?: boolean;
      lastUpdatedByActorId?: string;
    }
  ) {
    // Verify ownership
    const existing = await this.getPayoutMethodById(id, restaurantId);
    if (!existing) {
      throw new Error("Payout method not found or access denied");
    }

    // If setting as default, unset any existing default
    if (data.isDefault === true) {
      await db.restaurantPayoutMethod.updateMany({
        where: {
          actorType: "RESTAURANT",
          restaurantId,
          isDefault: true,
          id: { not: id },
        },
        data: {
          isDefault: false,
        },
      });
    }

    const updated = await db.restaurantPayoutMethod.update({
      where: { id },
      data,
    });

    return updated;
  }

  /**
   * Disable a payout method
   */
  static async disablePayoutMethod(
    id: string,
    restaurantId: string,
    actorId: string
  ) {
    return this.updatePayoutMethod(id, restaurantId, {
      status: "DISABLED",
      lastUpdatedByActorId: actorId,
    });
  }

  /**
   * Set a payout method as default
   */
  static async setAsDefault(
    id: string,
    restaurantId: string,
    actorId: string
  ) {
    return this.updatePayoutMethod(id, restaurantId, {
      isDefault: true,
      lastUpdatedByActorId: actorId,
    });
  }

  /**
   * Get the default payout method for a restaurant
   */
  static async getDefaultPayoutMethod(restaurantId: string) {
    const method = await db.restaurantPayoutMethod.findFirst({
      where: {
        actorType: "RESTAURANT",
        restaurantId,
        isDefault: true,
        status: "ACTIVE",
      },
    });

    return method;
  }
}
