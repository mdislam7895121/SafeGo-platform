import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

/**
 * Tax Service for US 1099 Tax System
 * Categorizes driver earnings into two buckets:
 * - 1099-K: Trip revenue (rides, food delivery, parcel delivery)
 * - 1099-NEC: Non-trip income (bonuses, referrals, promotions)
 */
export class TaxService {
  /**
   * Calculate 1099-K earnings (trip revenue) for a driver
   * Includes: ride fares, food delivery fees, parcel delivery fees
   */
  async calculate1099K(driverId: string, year: number): Promise<number> {
    const startOfYear = new Date(year, 0, 1); // January 1
    const endOfYear = new Date(year, 11, 31, 23, 59, 59); // December 31

    // Get driver's wallet
    const wallet = await prisma.wallet.findUnique({
      where: {
        ownerId_ownerType: {
          ownerId: driverId,
          ownerType: "driver",
        },
      },
    });

    if (!wallet) {
      return 0;
    }

    // Sum all trip-related earnings (credit transactions)
    const tripRevenue = await prisma.walletTransaction.aggregate({
      where: {
        walletId: wallet.id,
        direction: "credit",
        serviceType: {
          in: ["ride", "food", "parcel"],
        },
        createdAt: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
      _sum: {
        amount: true,
      },
    });

    return Number(tripRevenue._sum.amount || 0);
  }

  /**
   * Calculate 1099-NEC earnings (non-trip income) for a driver
   * Includes: bonuses, referrals, promotions, adjustments
   */
  async calculate1099NEC(driverId: string, year: number): Promise<number> {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    // Get driver's wallet
    const wallet = await prisma.wallet.findUnique({
      where: {
        ownerId_ownerType: {
          ownerId: driverId,
          ownerType: "driver",
        },
      },
    });

    if (!wallet) {
      return 0;
    }

    // Sum all non-trip income (bonuses, referrals, adjustments)
    const nonTripIncome = await prisma.walletTransaction.aggregate({
      where: {
        walletId: wallet.id,
        direction: "credit",
        OR: [
          {
            serviceType: {
              in: ["adjustment", "refund", "commission_refund"],
            },
          },
          {
            referenceType: "referral_bonus",
          },
        ],
        createdAt: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
      _sum: {
        amount: true,
      },
    });

    return Number(nonTripIncome._sum.amount || 0);
  }

  /**
   * Update driver's year-to-date tax totals
   * This should be called periodically (e.g., daily) or after significant transactions
   */
  async updateYearToDateTotals(driverId: string): Promise<void> {
    const currentYear = new Date().getFullYear();

    const trip1099K = await this.calculate1099K(driverId, currentYear);
    const nonTrip1099NEC = await this.calculate1099NEC(driverId, currentYear);

    await prisma.driverProfile.update({
      where: { id: driverId },
      data: {
        tripRevenueTotalYtd: new Prisma.Decimal(trip1099K),
        nonTripIncomeTotalYtd: new Prisma.Decimal(nonTrip1099NEC),
        taxYear: currentYear,
      },
    });
  }

  /**
   * Get complete tax summary for a driver for a given year
   */
  async getTaxSummary(driverId: string, year: number) {
    const trip1099K = await this.calculate1099K(driverId, year);
    const nonTrip1099NEC = await this.calculate1099NEC(driverId, year);

    // Get driver profile for tax info
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { id: driverId },
      select: {
        usaFullLegalName: true,
        usaStreet: true,
        usaCity: true,
        usaState: true,
        usaZipCode: true,
        ssnLast4: true,
        taxClassification: true,
        w9Status: true,
        taxCertificationAccepted: true,
        taxCertificationDate: true,
      },
    });

    return {
      year,
      driverInfo: driverProfile,
      tripRevenue1099K: trip1099K,
      nonTripIncome1099NEC: nonTrip1099NEC,
      totalEarnings: trip1099K + nonTrip1099NEC,
      // IRS thresholds
      requires1099K: trip1099K >= 600, // $600 threshold (can be adjusted)
      requires1099NEC: nonTrip1099NEC >= 600,
    };
  }

  /**
   * Get all transactions for a driver in a given year (for detailed breakdown)
   */
  async getYearTransactions(driverId: string, year: number) {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    // Get driver's wallet
    const wallet = await prisma.wallet.findUnique({
      where: {
        ownerId_ownerType: {
          ownerId: driverId,
          ownerType: "driver",
        },
      },
    });

    if (!wallet) {
      return [];
    }

    const transactions = await prisma.walletTransaction.findMany({
      where: {
        walletId: wallet.id,
        direction: "credit",
        createdAt: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return transactions.map((tx) => ({
      id: tx.id,
      date: tx.createdAt,
      description: tx.description,
      amount: Number(tx.amount),
      serviceType: tx.serviceType,
      referenceType: tx.referenceType,
      category: this.categorizeTransaction(tx.serviceType, tx.referenceType),
    }));
  }

  /**
   * Categorize a transaction as 1099-K or 1099-NEC
   */
  private categorizeTransaction(
    serviceType: string,
    referenceType: string
  ): "1099-K" | "1099-NEC" | "Other" {
    // 1099-K: Trip revenue
    if (["ride", "food", "parcel"].includes(serviceType)) {
      return "1099-K";
    }

    // 1099-NEC: Bonuses, referrals, adjustments
    if (
      ["adjustment", "refund", "commission_refund"].includes(serviceType) ||
      referenceType === "referral_bonus"
    ) {
      return "1099-NEC";
    }

    return "Other";
  }
}

export const taxService = new TaxService();
