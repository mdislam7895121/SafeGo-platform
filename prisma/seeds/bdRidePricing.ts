/**
 * Bangladesh Ride Pricing Rules Seed Data
 * Seeds city-specific, vehicle-specific fare configurations for SafeGo Bangladesh
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface PricingRuleInput {
  countryCode: string;
  cityCode: string;
  vehicleType: string;
  baseFare: number;
  perKmRate: number;
  perMinRate: number;
  minimumFare: number;
  bookingFee: number;
  nightStartHour: number;
  nightEndHour: number;
  nightMultiplier: number;
  peakMultiplier: number;
  peakTimeRanges: { start: number; end: number }[] | null;
  commissionRate: number;
  currency: string;
  allowCash: boolean;
  allowOnline: boolean;
  displayName: string;
  description: string;
}

const BD_PRICING_RULES: PricingRuleInput[] = [
  // ========== DHAKA (DHK) ==========
  {
    countryCode: "BD",
    cityCode: "DHK",
    vehicleType: "bike",
    baseFare: 30,
    perKmRate: 18,
    perMinRate: 1,
    minimumFare: 60,
    bookingFee: 5,
    nightStartHour: 22,
    nightEndHour: 6,
    nightMultiplier: 1.2,
    peakMultiplier: 1.15,
    peakTimeRanges: [{ start: 8, end: 10 }, { start: 17, end: 20 }],
    commissionRate: 15,
    currency: "BDT",
    allowCash: true,
    allowOnline: true,
    displayName: "Dhaka Bike",
    description: "Motorcycle rides in Dhaka - fastest in traffic",
  },
  {
    countryCode: "BD",
    cityCode: "DHK",
    vehicleType: "cng",
    baseFare: 40,
    perKmRate: 20,
    perMinRate: 1.5,
    minimumFare: 80,
    bookingFee: 8,
    nightStartHour: 22,
    nightEndHour: 6,
    nightMultiplier: 1.25,
    peakMultiplier: 1.2,
    peakTimeRanges: [{ start: 8, end: 10 }, { start: 17, end: 20 }],
    commissionRate: 18,
    currency: "BDT",
    allowCash: true,
    allowOnline: true,
    displayName: "Dhaka CNG Auto",
    description: "Auto-rickshaw CNG in Dhaka - eco-friendly option",
  },
  {
    countryCode: "BD",
    cityCode: "DHK",
    vehicleType: "car_economy",
    baseFare: 50,
    perKmRate: 25,
    perMinRate: 2,
    minimumFare: 120,
    bookingFee: 10,
    nightStartHour: 22,
    nightEndHour: 6,
    nightMultiplier: 1.3,
    peakMultiplier: 1.25,
    peakTimeRanges: [{ start: 8, end: 10 }, { start: 17, end: 20 }],
    commissionRate: 20,
    currency: "BDT",
    allowCash: true,
    allowOnline: true,
    displayName: "Dhaka Economy Car",
    description: "Affordable sedan rides in Dhaka",
  },
  {
    countryCode: "BD",
    cityCode: "DHK",
    vehicleType: "car_premium",
    baseFare: 100,
    perKmRate: 40,
    perMinRate: 3,
    minimumFare: 200,
    bookingFee: 15,
    nightStartHour: 22,
    nightEndHour: 6,
    nightMultiplier: 1.35,
    peakMultiplier: 1.3,
    peakTimeRanges: [{ start: 8, end: 10 }, { start: 17, end: 20 }],
    commissionRate: 22,
    currency: "BDT",
    allowCash: true,
    allowOnline: true,
    displayName: "Dhaka Premium Car",
    description: "Premium sedan with AC and comfort features",
  },
  
  // ========== CHITTAGONG (CTG) ==========
  {
    countryCode: "BD",
    cityCode: "CTG",
    vehicleType: "bike",
    baseFare: 25,
    perKmRate: 15,
    perMinRate: 0.8,
    minimumFare: 50,
    bookingFee: 5,
    nightStartHour: 22,
    nightEndHour: 6,
    nightMultiplier: 1.2,
    peakMultiplier: 1.1,
    peakTimeRanges: [{ start: 8, end: 10 }, { start: 17, end: 19 }],
    commissionRate: 15,
    currency: "BDT",
    allowCash: true,
    allowOnline: true,
    displayName: "Chittagong Bike",
    description: "Motorcycle rides in Chittagong",
  },
  {
    countryCode: "BD",
    cityCode: "CTG",
    vehicleType: "cng",
    baseFare: 35,
    perKmRate: 18,
    perMinRate: 1.2,
    minimumFare: 70,
    bookingFee: 7,
    nightStartHour: 22,
    nightEndHour: 6,
    nightMultiplier: 1.2,
    peakMultiplier: 1.15,
    peakTimeRanges: [{ start: 8, end: 10 }, { start: 17, end: 19 }],
    commissionRate: 18,
    currency: "BDT",
    allowCash: true,
    allowOnline: true,
    displayName: "Chittagong CNG",
    description: "Auto-rickshaw CNG in Chittagong",
  },
  {
    countryCode: "BD",
    cityCode: "CTG",
    vehicleType: "car_economy",
    baseFare: 45,
    perKmRate: 22,
    perMinRate: 1.8,
    minimumFare: 100,
    bookingFee: 10,
    nightStartHour: 22,
    nightEndHour: 6,
    nightMultiplier: 1.25,
    peakMultiplier: 1.2,
    peakTimeRanges: [{ start: 8, end: 10 }, { start: 17, end: 19 }],
    commissionRate: 20,
    currency: "BDT",
    allowCash: true,
    allowOnline: true,
    displayName: "Chittagong Economy Car",
    description: "Affordable sedan rides in Chittagong",
  },
  {
    countryCode: "BD",
    cityCode: "CTG",
    vehicleType: "car_premium",
    baseFare: 90,
    perKmRate: 35,
    perMinRate: 2.5,
    minimumFare: 180,
    bookingFee: 12,
    nightStartHour: 22,
    nightEndHour: 6,
    nightMultiplier: 1.3,
    peakMultiplier: 1.25,
    peakTimeRanges: [{ start: 8, end: 10 }, { start: 17, end: 19 }],
    commissionRate: 22,
    currency: "BDT",
    allowCash: true,
    allowOnline: true,
    displayName: "Chittagong Premium Car",
    description: "Premium sedan in Chittagong",
  },

  // ========== KHULNA (KHL) ==========
  {
    countryCode: "BD",
    cityCode: "KHL",
    vehicleType: "bike",
    baseFare: 22,
    perKmRate: 14,
    perMinRate: 0.7,
    minimumFare: 45,
    bookingFee: 4,
    nightStartHour: 22,
    nightEndHour: 6,
    nightMultiplier: 1.15,
    peakMultiplier: 1.1,
    peakTimeRanges: [{ start: 8, end: 10 }, { start: 17, end: 19 }],
    commissionRate: 15,
    currency: "BDT",
    allowCash: true,
    allowOnline: true,
    displayName: "Khulna Bike",
    description: "Motorcycle rides in Khulna",
  },
  {
    countryCode: "BD",
    cityCode: "KHL",
    vehicleType: "cng",
    baseFare: 30,
    perKmRate: 16,
    perMinRate: 1,
    minimumFare: 60,
    bookingFee: 6,
    nightStartHour: 22,
    nightEndHour: 6,
    nightMultiplier: 1.2,
    peakMultiplier: 1.15,
    peakTimeRanges: [{ start: 8, end: 10 }, { start: 17, end: 19 }],
    commissionRate: 18,
    currency: "BDT",
    allowCash: true,
    allowOnline: true,
    displayName: "Khulna CNG",
    description: "Auto-rickshaw CNG in Khulna",
  },
  {
    countryCode: "BD",
    cityCode: "KHL",
    vehicleType: "car_economy",
    baseFare: 40,
    perKmRate: 20,
    perMinRate: 1.5,
    minimumFare: 90,
    bookingFee: 8,
    nightStartHour: 22,
    nightEndHour: 6,
    nightMultiplier: 1.2,
    peakMultiplier: 1.15,
    peakTimeRanges: [{ start: 8, end: 10 }, { start: 17, end: 19 }],
    commissionRate: 20,
    currency: "BDT",
    allowCash: true,
    allowOnline: true,
    displayName: "Khulna Economy Car",
    description: "Affordable sedan rides in Khulna",
  },

  // ========== SYLHET (SYL) ==========
  {
    countryCode: "BD",
    cityCode: "SYL",
    vehicleType: "bike",
    baseFare: 25,
    perKmRate: 15,
    perMinRate: 0.8,
    minimumFare: 50,
    bookingFee: 5,
    nightStartHour: 22,
    nightEndHour: 6,
    nightMultiplier: 1.2,
    peakMultiplier: 1.1,
    peakTimeRanges: [{ start: 8, end: 10 }, { start: 17, end: 19 }],
    commissionRate: 15,
    currency: "BDT",
    allowCash: true,
    allowOnline: true,
    displayName: "Sylhet Bike",
    description: "Motorcycle rides in Sylhet",
  },
  {
    countryCode: "BD",
    cityCode: "SYL",
    vehicleType: "cng",
    baseFare: 35,
    perKmRate: 17,
    perMinRate: 1.1,
    minimumFare: 65,
    bookingFee: 6,
    nightStartHour: 22,
    nightEndHour: 6,
    nightMultiplier: 1.2,
    peakMultiplier: 1.15,
    peakTimeRanges: [{ start: 8, end: 10 }, { start: 17, end: 19 }],
    commissionRate: 18,
    currency: "BDT",
    allowCash: true,
    allowOnline: true,
    displayName: "Sylhet CNG",
    description: "Auto-rickshaw CNG in Sylhet",
  },
  {
    countryCode: "BD",
    cityCode: "SYL",
    vehicleType: "car_economy",
    baseFare: 45,
    perKmRate: 22,
    perMinRate: 1.7,
    minimumFare: 100,
    bookingFee: 9,
    nightStartHour: 22,
    nightEndHour: 6,
    nightMultiplier: 1.25,
    peakMultiplier: 1.15,
    peakTimeRanges: [{ start: 8, end: 10 }, { start: 17, end: 19 }],
    commissionRate: 20,
    currency: "BDT",
    allowCash: true,
    allowOnline: true,
    displayName: "Sylhet Economy Car",
    description: "Affordable sedan rides in Sylhet",
  },

  // ========== US - NEW YORK (NYC) ==========
  {
    countryCode: "US",
    cityCode: "NYC",
    vehicleType: "car_economy",
    baseFare: 2.5,
    perKmRate: 1.5,
    perMinRate: 0.35,
    minimumFare: 8,
    bookingFee: 2,
    nightStartHour: 20,
    nightEndHour: 6,
    nightMultiplier: 1.25,
    peakMultiplier: 1.3,
    peakTimeRanges: [{ start: 7, end: 9 }, { start: 16, end: 19 }],
    commissionRate: 25,
    currency: "USD",
    allowCash: false,
    allowOnline: true,
    displayName: "NYC Economy",
    description: "SafeGo X - Affordable everyday rides in NYC",
  },
  {
    countryCode: "US",
    cityCode: "NYC",
    vehicleType: "car_premium",
    baseFare: 5,
    perKmRate: 2.5,
    perMinRate: 0.5,
    minimumFare: 15,
    bookingFee: 3,
    nightStartHour: 20,
    nightEndHour: 6,
    nightMultiplier: 1.3,
    peakMultiplier: 1.35,
    peakTimeRanges: [{ start: 7, end: 9 }, { start: 16, end: 19 }],
    commissionRate: 25,
    currency: "USD",
    allowCash: false,
    allowOnline: true,
    displayName: "NYC Premium",
    description: "SafeGo Black - Premium rides in NYC",
  },
];

export async function seedBDRidePricing() {
  console.log("[BDRidePricing] Seeding ride pricing rules...");

  for (const rule of BD_PRICING_RULES) {
    await prisma.ridePricingRule.upsert({
      where: {
        countryCode_cityCode_vehicleType: {
          countryCode: rule.countryCode,
          cityCode: rule.cityCode,
          vehicleType: rule.vehicleType,
        },
      },
      create: {
        countryCode: rule.countryCode,
        cityCode: rule.cityCode,
        vehicleType: rule.vehicleType,
        baseFare: rule.baseFare,
        perKmRate: rule.perKmRate,
        perMinRate: rule.perMinRate,
        minimumFare: rule.minimumFare,
        bookingFee: rule.bookingFee,
        nightStartHour: rule.nightStartHour,
        nightEndHour: rule.nightEndHour,
        nightMultiplier: rule.nightMultiplier,
        peakMultiplier: rule.peakMultiplier,
        peakTimeRanges: rule.peakTimeRanges,
        commissionRate: rule.commissionRate,
        currency: rule.currency,
        allowCash: rule.allowCash,
        allowOnline: rule.allowOnline,
        displayName: rule.displayName,
        description: rule.description,
        isActive: true,
      },
      update: {
        baseFare: rule.baseFare,
        perKmRate: rule.perKmRate,
        perMinRate: rule.perMinRate,
        minimumFare: rule.minimumFare,
        bookingFee: rule.bookingFee,
        nightStartHour: rule.nightStartHour,
        nightEndHour: rule.nightEndHour,
        nightMultiplier: rule.nightMultiplier,
        peakMultiplier: rule.peakMultiplier,
        peakTimeRanges: rule.peakTimeRanges,
        commissionRate: rule.commissionRate,
        currency: rule.currency,
        allowCash: rule.allowCash,
        allowOnline: rule.allowOnline,
        displayName: rule.displayName,
        description: rule.description,
      },
    });

    console.log(`[BDRidePricing] Seeded ${rule.countryCode}/${rule.cityCode}/${rule.vehicleType}`);
  }

  console.log(`[BDRidePricing] Successfully seeded ${BD_PRICING_RULES.length} pricing rules`);
}

// Run directly if executed as script
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     import.meta.url.endsWith(process.argv[1]?.split('/').pop() || '');

if (isMainModule) {
  seedBDRidePricing()
    .then(() => {
      console.log("[BDRidePricing] Seed completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("[BDRidePricing] Seed failed:", error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
