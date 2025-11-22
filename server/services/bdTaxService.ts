import { prisma } from "../db";

/**
 * Bangladesh Tax Service
 * Aggregates driver earnings for BD tax reporting
 * - total_trip_earnings: Gross fares before SafeGo commission
 * - safego_commission_total: Total commission deducted
 * - driver_net_payout: Total earnings minus commission
 * - any_withheld_tax: Future use (default 0)
 */
export class BDTaxService {
  /**
   * Calculate BD tax summary for a driver for a given year
   */
  async getBDTaxSummary(driverId: string, year: number) {
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
      return {
        year,
        total_trip_earnings: 0,
        safego_commission_total: 0,
        driver_net_payout: 0,
        any_withheld_tax: 0,
        generated_at: new Date(),
      };
    }

    // Get all trip-related credit transactions (driver earnings from trips)
    const tripEarnings = await prisma.walletTransaction.aggregate({
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

    // Get all commission debit transactions (SafeGo commission deducted)
    const commissionDeductions = await prisma.walletTransaction.aggregate({
      where: {
        walletId: wallet.id,
        direction: "debit",
        serviceType: {
          in: ["ride", "food", "parcel"],
        },
        referenceType: "commission",
        createdAt: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const totalTripEarnings = Number(tripEarnings._sum.amount || 0);
    const totalCommission = Number(commissionDeductions._sum.amount || 0);
    
    // Driver net payout is trip earnings minus commission
    const driverNetPayout = totalTripEarnings - totalCommission;

    return {
      year,
      total_trip_earnings: totalTripEarnings,
      safego_commission_total: totalCommission,
      driver_net_payout: driverNetPayout,
      any_withheld_tax: 0, // Future use
      generated_at: new Date(),
    };
  }

  /**
   * Get available tax years for a BD driver
   * Returns years where the driver had any trip earnings
   */
  async getAvailableTaxYears(driverId: string): Promise<number[]> {
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

    // Get all trip transactions to find years with activity
    const transactions = await prisma.walletTransaction.findMany({
      where: {
        walletId: wallet.id,
        direction: "credit",
        serviceType: {
          in: ["ride", "food", "parcel"],
        },
      },
      select: {
        createdAt: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Extract unique years
    const years = new Set<number>();
    transactions.forEach((tx) => {
      years.add(tx.createdAt.getFullYear());
    });

    // Always include current year even if no transactions yet
    const currentYear = new Date().getFullYear();
    years.add(currentYear);

    return Array.from(years).sort((a, b) => b - a); // Descending order
  }
}

export const bdTaxService = new BDTaxService();
