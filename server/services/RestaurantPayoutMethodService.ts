import { PrismaClient } from "@prisma/client";
import type { ActorType, CountryCode, PayoutRailType, PayoutProvider, PayoutMethodStatus } from "../../shared/types";

const db = new PrismaClient();

export class RestaurantPayoutMethodService {
  /**
   * Get all payout methods for a restaurant
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
    const { restaurantId, isDefault = false, ...rest } = data;

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
        isDefault,
        status: "PENDING_VERIFICATION",
        ...rest,
      },
    });

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
