import { PrismaClient } from "@prisma/client";
import type { CountryCode, ActorType, KycLevel } from "../../shared/types";

const db = new PrismaClient();

export class PayoutConfigService {
  /**
   * Get enabled payout rails for a country and actor type (RESTAURANT or DRIVER)
   * Optionally filter by KYC level requirement
   */
  static async getPayoutRails(params: {
    countryCode: CountryCode;
    actorType: ActorType;
    kycLevel?: KycLevel;
  }) {
    const { countryCode, actorType, kycLevel } = params;

    const configs = await db.countryPayoutConfig.findMany({
      where: {
        countryCode,
        actorType,
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
        { createdAt: "asc" },
      ],
    });

    return configs.map((config) => ({
      id: config.id,
      payoutRailType: config.payoutRailType,
      provider: config.provider,
      minPayoutAmount: config.minPayoutAmount?.toString(),
      payoutSchedule: config.payoutSchedule,
      requiresKycLevel: config.requiresKycLevel,
    }));
  }

  /**
   * Get all payout rails for a country (admin use)
   */
  static async getAllPayoutRailsForCountry(countryCode: CountryCode) {
    const configs = await db.countryPayoutConfig.findMany({
      where: { countryCode },
      orderBy: [
        { actorType: "asc" },
        { createdAt: "asc" },
      ],
    });

    return configs;
  }

  /**
   * Create or update a payout rail configuration (admin only)
   */
  static async upsertPayoutConfig(
    data: {
      countryCode: string;
      actorType: string;
      payoutRailType: string;
      provider: string;
      isEnabled?: boolean;
      minPayoutAmount?: number;
      payoutSchedule?: string;
      requiresKycLevel?: string;
    },
    adminId: string
  ) {
    const existing = await db.countryPayoutConfig.findUnique({
      where: {
        countryCode_actorType_payoutRailType_provider: {
          countryCode: data.countryCode,
          actorType: data.actorType,
          payoutRailType: data.payoutRailType,
          provider: data.provider,
        },
      },
    });

    if (existing) {
      return db.countryPayoutConfig.update({
        where: { id: existing.id },
        data: {
          ...data,
          lastUpdatedByAdminId: adminId,
        },
      });
    } else {
      return db.countryPayoutConfig.create({
        data: {
          ...data,
          createdByAdminId: adminId,
        },
      });
    }
  }
}
