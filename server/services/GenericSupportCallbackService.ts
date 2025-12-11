import { prisma } from "../db";

/**
 * Generic Support Callback Service - Domain Config Interface
 */
export interface CallbackDomainConfig {
  role: "restaurant" | "driver" | "customer" | "admin";
  callbackDelegate: any;
  profileIdField: string;
}

/**
 * Generic Support Callback Service
 * Handles phone support callback requests for all user roles
 */
export class GenericSupportCallbackService {
  constructor(private config: CallbackDomainConfig) {}

  /**
   * Request a support callback
   */
  async requestCallback(data: {
    profileId: string;
    phoneNumber: string;
    preferredTime: string;
    timezone: string;
    reason: string;
  }) {
    const callback = await this.config.callbackDelegate.create({
      data: {
        [this.config.profileIdField]: data.profileId,
        phoneNumber: data.phoneNumber,
        preferredTime: data.preferredTime,
        timezone: data.timezone,
        reason: data.reason,
        status: "pending"
      }
    });

    return callback;
  }

  /**
   * Get callback requests for a profile
   */
  async getCallbacks(profileId: string) {
    return await this.config.callbackDelegate.findMany({
      where: { [this.config.profileIdField]: profileId },
      orderBy: { createdAt: "desc" }
    });
  }

  /**
   * Get specific callback by ID with access control
   */
  async getCallbackById(callbackId: string, profileId: string) {
    const callback = await this.config.callbackDelegate.findUnique({
      where: { id: callbackId }
    });

    if (!callback) {
      throw new Error("Callback request not found");
    }

    // Access control
    if (callback[this.config.profileIdField] !== profileId) {
      throw new Error("Access denied: You can only view your own callback requests");
    }

    return callback;
  }

  /**
   * Backwards compatibility: createCallback (alias for requestCallback)
   */
  async createCallback(data: {
    profileId: string;
    phoneNumber: string;
    preferredTime: string;
    timezone: string;
    reason: string;
  }) {
    return await this.requestCallback(data);
  }
}

/**
 * Role-Specific Callback Service Adapters
 */

// Restaurant Callback
export const restaurantCallbackService = new GenericSupportCallbackService({
  role: "restaurant",
  callbackDelegate: prisma.supportCallback,
  profileIdField: "restaurantId"
});

// Driver Callback
export const driverCallbackService = new GenericSupportCallbackService({
  role: "driver",
  callbackDelegate: prisma.driverSupportCallback,
  profileIdField: "driverId"
});

// Customer Callback
export const customerCallbackService = new GenericSupportCallbackService({
  role: "customer",
  callbackDelegate: prisma.customerSupportCallback,
  profileIdField: "customerId"
});

// Admin Callback
export const adminCallbackService = new GenericSupportCallbackService({
  role: "admin",
  callbackDelegate: prisma.adminSupportCallback,
  profileIdField: "adminId"
});
