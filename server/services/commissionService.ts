import { getSection } from "../utils/settings";
import type { CommissionSettings } from "../utils/settings";
import type { WalletOwnerType, WalletTransactionServiceType } from "@prisma/client";

export interface CommissionCalculation {
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  commissionPercent: number;
  currency: string;
}

export class CommissionService {
  /**
   * Calculate commission for rides and parcels (driver services)
   * Driver receives gross amount, owes commission to platform
   */
  async calculateDriverCommission(
    fareAmount: number,
    serviceType: "ride" | "parcel",
    countryCode: "BD" | "US",
    currency: string = "BDT"
  ): Promise<CommissionCalculation> {
    if (fareAmount <= 0) {
      throw new Error("Fare amount must be greater than zero");
    }

    const commissionSettings = await getSection("commission");
    const commissionPercent = this.getCommissionRate(
      commissionSettings,
      serviceType,
      "driver",
      countryCode
    );

    const commissionAmount = (fareAmount * commissionPercent) / 100;
    const netAmount = fareAmount - commissionAmount;

    return {
      grossAmount: fareAmount,
      commissionAmount: parseFloat(commissionAmount.toFixed(2)),
      netAmount: parseFloat(netAmount.toFixed(2)),
      commissionPercent,
      currency,
    };
  }

  /**
   * Legacy method - use calculateDriverCommission or calculateFoodOrderCommission instead
   * @deprecated
   */
  async calculateCommission(
    grossAmount: number,
    serviceType: "ride" | "food" | "parcel",
    ownerType: WalletOwnerType,
    countryCode: "BD" | "US",
    currency: string = "BDT"
  ): Promise<CommissionCalculation> {
    if (serviceType === "food") {
      throw new Error("Use calculateFoodOrderCommission for food orders");
    }
    return this.calculateDriverCommission(grossAmount, serviceType as "ride" | "parcel", countryCode, currency);
  }

  /**
   * Get commission rate with country override support
   */
  private getCommissionRate(
    settings: CommissionSettings,
    serviceType: "ride" | "food" | "parcel",
    ownerType: WalletOwnerType,
    countryCode: "BD" | "US"
  ): number {
    // Check for country-specific override first
    const overrides = settings.countryOverrides[countryCode];

    if (serviceType === "ride" && ownerType === "driver") {
      return overrides.driverRideCommissionPercent ?? settings.driver.ride.defaultCommissionPercent;
    }

    if (serviceType === "parcel" && ownerType === "driver") {
      return overrides.driverParcelCommissionPercent ?? settings.driver.parcel.defaultCommissionPercent;
    }

    if (serviceType === "food" && ownerType === "restaurant") {
      return overrides.restaurantFoodCommissionPercent ?? settings.restaurant.food.defaultCommissionPercent;
    }

    // Fallback to defaults
    if (serviceType === "ride") {
      return settings.driver.ride.defaultCommissionPercent;
    }

    if (serviceType === "parcel") {
      return settings.driver.parcel.defaultCommissionPercent;
    }

    if (serviceType === "food") {
      return settings.restaurant.food.defaultCommissionPercent;
    }

    // Default to 20% if nothing matches
    return 20;
  }

  /**
   * Calculate service fee breakdown for food orders
   * Food orders have complex commission: 15% from restaurant, 5% from delivery fee
   */
  async calculateFoodOrderCommission(
    subtotal: number,
    deliveryFee: number,
    countryCode: "BD" | "US",
    currency: string = "BDT"
  ): Promise<{
    restaurant: CommissionCalculation;
    driver: CommissionCalculation;
    total: CommissionCalculation;
  }> {
    const commissionSettings = await getSection("commission");
    const totalCommissionPercent = this.getCommissionRate(
      commissionSettings,
      "food",
      "restaurant",
      countryCode
    );

    // For food: assume 75% of total commission from restaurant, 25% from delivery
    const restaurantCommissionPercent = totalCommissionPercent * 0.75;
    const deliveryCommissionPercent = totalCommissionPercent * 0.25;

    const restaurantCommission = (subtotal * restaurantCommissionPercent) / 100;
    const driverCommission = (deliveryFee * deliveryCommissionPercent) / 100;
    const totalCommission = restaurantCommission + driverCommission;

    const restaurantNet = subtotal - restaurantCommission;
    const driverNet = deliveryFee - driverCommission;

    return {
      restaurant: {
        grossAmount: subtotal,
        commissionAmount: parseFloat(restaurantCommission.toFixed(2)),
        netAmount: parseFloat(restaurantNet.toFixed(2)),
        commissionPercent: parseFloat(restaurantCommissionPercent.toFixed(2)),
        currency,
      },
      driver: {
        grossAmount: deliveryFee,
        commissionAmount: parseFloat(driverCommission.toFixed(2)),
        netAmount: parseFloat(driverNet.toFixed(2)),
        commissionPercent: parseFloat(deliveryCommissionPercent.toFixed(2)),
        currency,
      },
      total: {
        grossAmount: subtotal + deliveryFee,
        commissionAmount: parseFloat(totalCommission.toFixed(2)),
        netAmount: parseFloat((restaurantNet + driverNet).toFixed(2)),
        commissionPercent: totalCommissionPercent,
        currency,
      },
    };
  }

  /**
   * Determine wallet transaction service type from service name
   */
  getServiceTypeForTransaction(
    serviceType: "ride" | "food" | "parcel"
  ): WalletTransactionServiceType {
    const mapping: Record<string, WalletTransactionServiceType> = {
      ride: "ride",
      food: "food",
      parcel: "parcel",
    };

    return mapping[serviceType] || "ride";
  }

  /**
   * Get currency based on country code
   */
  getCurrency(countryCode: "BD" | "US"): string {
    return countryCode === "BD" ? "BDT" : "USD";
  }
}

export const commissionService = new CommissionService();
