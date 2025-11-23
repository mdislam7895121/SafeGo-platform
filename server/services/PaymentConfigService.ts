import { PrismaClient } from "@prisma/client";
import type { CountryCode, ServiceType, KycLevel } from "../../shared/types";

const db = new PrismaClient();

export class PaymentConfigService {
  /**
   * Get enabled customer payment methods for a country and service type
   * Optionally filter by KYC level requirement
   */
  static async getCustomerPaymentMethods(params: {
    countryCode: CountryCode;
    serviceType: ServiceType;
    kycLevel?: KycLevel;
  }) {
    const { countryCode, serviceType, kycLevel } = params;

    const configs = await db.countryPaymentConfig.findMany({
      where: {
        countryCode,
        serviceType,
        isEnabled: true,
        ...(kycLevel && {
          OR: [
            { requiresKycLevel: "NONE" },
            { requiresKycLevel: kycLevel },
            ...(kycLevel === "FULL" ? [{ requiresKycLevel: "BASIC" }] : []),
          ],
        }),
      },
      orderBy: [
        { priority: "desc" },
        { createdAt: "asc" },
      ],
    });

    return configs.map((config) => ({
      id: config.id,
      methodType: config.methodType,
      provider: config.provider,
      priority: config.priority,
      minAmount: config.minAmount?.toString(),
      maxAmount: config.maxAmount?.toString(),
      supportsRecurring: config.supportsRecurring,
      requiresKycLevel: config.requiresKycLevel,
    }));
  }

  /**
   * Get all payment methods for a country (admin use)
   */
  static async getAllPaymentMethodsForCountry(countryCode: CountryCode) {
    const configs = await db.countryPaymentConfig.findMany({
      where: { countryCode },
      orderBy: [
        { serviceType: "asc" },
        { priority: "desc" },
        { createdAt: "asc" },
      ],
    });

    return configs;
  }

  /**
   * Create or update a payment method configuration (admin only)
   */
  static async upsertPaymentConfig(
    data: {
      countryCode: string;
      serviceType: string;
      methodType: string;
      provider: string;
      isEnabled?: boolean;
      priority?: number;
      minAmount?: number;
      maxAmount?: number;
      supportsRecurring?: boolean;
      requiresKycLevel?: string;
    },
    adminId: string
  ) {
    const existing = await db.countryPaymentConfig.findUnique({
      where: {
        countryCode_serviceType_methodType_provider: {
          countryCode: data.countryCode,
          serviceType: data.serviceType,
          methodType: data.methodType,
          provider: data.provider,
        },
      },
    });

    if (existing) {
      return db.countryPaymentConfig.update({
        where: { id: existing.id },
        data: {
          ...data,
          lastUpdatedByAdminId: adminId,
        },
      });
    } else {
      return db.countryPaymentConfig.create({
        data: {
          ...data,
          createdByAdminId: adminId,
        },
      });
    }
  }
}
