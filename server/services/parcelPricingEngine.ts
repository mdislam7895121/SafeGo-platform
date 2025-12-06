import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

export interface ParcelPricingInput {
  countryCode: string;
  isInternational: boolean;
  actualWeightKg: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  domesticZoneType?: "same_city" | "inside_division" | "outside_division" | "remote";
  destinationCountry?: string;
  deliverySpeed?: "regular" | "quick" | "express" | "super_express";
  isFragile?: boolean;
  codEnabled?: boolean;
  codAmount?: number;
}

export interface ParcelPricingResult {
  chargeableWeightKg: number;
  volumetricWeightKg: number;
  baseDeliveryCharge: number;
  speedSurcharge: number;
  fragileSurcharge: number;
  remoteSurcharge: number;
  fuelSurchargePercent: number;
  fuelSurchargeAmount: number;
  securitySurcharge: number;
  codFee: number;
  totalDeliveryCharge: number;
  commissionAmount: number;
  driverPayoutAmount: number;
  currency: string;
  breakdown: {
    label: string;
    amount: number;
  }[];
  zoneInfo: {
    zoneType: string;
    zoneName: string;
  } | null;
  estimatedDays?: {
    min: number;
    max: number;
  };
}

export class ParcelPricingEngine {
  private static VOLUMETRIC_DIVISOR = 5000;
  
  static calculateVolumetricWeight(lengthCm: number, widthCm: number, heightCm: number): number {
    return (lengthCm * widthCm * heightCm) / this.VOLUMETRIC_DIVISOR;
  }

  static calculateChargeableWeight(actualKg: number, volumetricKg: number): number {
    return Math.max(actualKg, volumetricKg);
  }

  static async calculateDomesticPrice(input: ParcelPricingInput): Promise<ParcelPricingResult> {
    const { countryCode, actualWeightKg, lengthCm, widthCm, heightCm, domesticZoneType, deliverySpeed, isFragile, codEnabled, codAmount } = input;

    let volumetricWeightKg = 0;
    if (lengthCm && widthCm && heightCm) {
      volumetricWeightKg = this.calculateVolumetricWeight(lengthCm, widthCm, heightCm);
    }
    const chargeableWeightKg = this.calculateChargeableWeight(actualWeightKg, volumetricWeightKg);

    const zone = await prisma.parcelDomesticZone.findFirst({
      where: {
        countryCode,
        zoneType: domesticZoneType,
        isActive: true,
      },
    });

    let baseDeliveryCharge = 0;
    let zoneInfo = null;

    if (zone) {
      zoneInfo = { zoneType: zone.zoneType, zoneName: zone.zoneName };
      if (chargeableWeightKg <= 1) {
        baseDeliveryCharge = Number(zone.rate0to1kg);
      } else if (chargeableWeightKg <= 2) {
        baseDeliveryCharge = Number(zone.rate1to2kg);
      } else if (chargeableWeightKg <= 5) {
        baseDeliveryCharge = Number(zone.rate2to5kg);
      } else if (chargeableWeightKg <= 10) {
        baseDeliveryCharge = Number(zone.rate5to10kg);
      } else {
        baseDeliveryCharge = Number(zone.rate5to10kg) + (chargeableWeightKg - 10) * Number(zone.rateAbove10kg);
      }
    } else {
      const defaultRates: Record<string, { base: number[]; perKgAbove10: number }> = {
        same_city: { base: [100, 120, 150, 250], perKgAbove10: 30 },
        inside_division: { base: [120, 150, 180, 280], perKgAbove10: 35 },
        outside_division: { base: [140, 170, 220, 320], perKgAbove10: 40 },
        remote: { base: [160, 200, 260, 380], perKgAbove10: 50 },
      };
      const rates = defaultRates[domesticZoneType || "same_city"] || defaultRates.same_city;
      if (chargeableWeightKg <= 1) {
        baseDeliveryCharge = rates.base[0];
      } else if (chargeableWeightKg <= 2) {
        baseDeliveryCharge = rates.base[1];
      } else if (chargeableWeightKg <= 5) {
        baseDeliveryCharge = rates.base[2];
      } else if (chargeableWeightKg <= 10) {
        baseDeliveryCharge = rates.base[3];
      } else {
        baseDeliveryCharge = rates.base[3] + (chargeableWeightKg - 10) * rates.perKgAbove10;
      }
      zoneInfo = { zoneType: domesticZoneType || "same_city", zoneName: "Default Zone" };
    }

    const speedSurcharges: Record<string, number> = {
      regular: 0,
      quick: 30,
      express: 60,
      super_express: 120,
    };
    const speedSurcharge = speedSurcharges[deliverySpeed || "regular"] || 0;

    const fragileSurcharge = isFragile ? 30 : 0;
    const remoteSurcharge = zone?.remoteSurcharge ? Number(zone.remoteSurcharge) : 0;

    let codFee = 0;
    if (codEnabled && codAmount && codAmount > 0) {
      codFee = Math.max(10, codAmount * 0.008);
    }

    const subtotal = baseDeliveryCharge + speedSurcharge + fragileSurcharge + remoteSurcharge + codFee;
    const totalDeliveryCharge = Math.round(subtotal * 100) / 100;

    const commissionPercent = 20;
    const commissionAmount = Math.round(totalDeliveryCharge * (commissionPercent / 100) * 100) / 100;
    const driverPayoutAmount = Math.round((totalDeliveryCharge - commissionAmount) * 100) / 100;

    const breakdown = [
      { label: "Base Delivery", amount: baseDeliveryCharge },
    ];
    if (speedSurcharge > 0) breakdown.push({ label: `Speed (${deliverySpeed})`, amount: speedSurcharge });
    if (fragileSurcharge > 0) breakdown.push({ label: "Fragile Handling", amount: fragileSurcharge });
    if (remoteSurcharge > 0) breakdown.push({ label: "Remote Area", amount: remoteSurcharge });
    if (codFee > 0) breakdown.push({ label: "COD Fee", amount: Math.round(codFee * 100) / 100 });

    return {
      chargeableWeightKg: Math.round(chargeableWeightKg * 100) / 100,
      volumetricWeightKg: Math.round(volumetricWeightKg * 100) / 100,
      baseDeliveryCharge,
      speedSurcharge,
      fragileSurcharge,
      remoteSurcharge,
      fuelSurchargePercent: 0,
      fuelSurchargeAmount: 0,
      securitySurcharge: 0,
      codFee: Math.round(codFee * 100) / 100,
      totalDeliveryCharge,
      commissionAmount,
      driverPayoutAmount,
      currency: countryCode === "BD" ? "BDT" : "USD",
      breakdown,
      zoneInfo,
    };
  }

  static async calculateInternationalPrice(input: ParcelPricingInput): Promise<ParcelPricingResult> {
    const { countryCode, actualWeightKg, lengthCm, widthCm, heightCm, destinationCountry, deliverySpeed, isFragile, codEnabled, codAmount } = input;

    let volumetricWeightKg = 0;
    if (lengthCm && widthCm && heightCm) {
      volumetricWeightKg = this.calculateVolumetricWeight(lengthCm, widthCm, heightCm);
    }
    const chargeableWeightKg = this.calculateChargeableWeight(actualWeightKg, volumetricWeightKg);

    const zone = await prisma.parcelInternationalZone.findFirst({
      where: {
        originCountry: countryCode,
        destinationCountries: { has: destinationCountry?.toUpperCase() },
        isActive: true,
      },
    });

    let baseDeliveryCharge = 0;
    let fuelSurchargePercent = 15;
    let securitySurcharge = 400;
    let commissionPercent = 20;
    let estimatedDays = { min: 5, max: 10 };
    let zoneInfo = null;

    if (zone) {
      zoneInfo = { zoneType: zone.zoneType, zoneName: zone.zoneName };
      fuelSurchargePercent = Number(zone.fuelSurchargePercent);
      securitySurcharge = Number(zone.securitySurcharge);
      commissionPercent = Number(zone.commissionPercent);
      estimatedDays = { min: zone.estimatedDaysMin, max: zone.estimatedDaysMax };

      if (chargeableWeightKg <= 0.5) {
        baseDeliveryCharge = Number(zone.rate0to0_5kg);
      } else if (chargeableWeightKg <= 1) {
        baseDeliveryCharge = Number(zone.rate0_5to1kg);
      } else if (chargeableWeightKg <= 2) {
        baseDeliveryCharge = Number(zone.rate1to2kg);
      } else if (chargeableWeightKg <= 5) {
        baseDeliveryCharge = Number(zone.rate2to5kg);
      } else if (chargeableWeightKg <= 10) {
        baseDeliveryCharge = Number(zone.rate5to10kg);
      } else {
        baseDeliveryCharge = Number(zone.rate5to10kg) + (chargeableWeightKg - 10) * Number(zone.rateAbove10kg);
      }
    } else {
      const zoneDefaults: Record<string, { rates: number[]; perKgAbove10: number; fuel: number; security: number; commission: number; days: { min: number; max: number } }> = {
        IN: { rates: [1500, 2000, 3000, 7000, 12000], perKgAbove10: 1000, fuel: 10, security: 300, commission: 15, days: { min: 3, max: 5 } },
        NP: { rates: [1500, 2000, 3000, 7000, 12000], perKgAbove10: 1000, fuel: 10, security: 300, commission: 15, days: { min: 3, max: 5 } },
        BT: { rates: [1500, 2000, 3000, 7000, 12000], perKgAbove10: 1000, fuel: 10, security: 300, commission: 15, days: { min: 3, max: 5 } },
        AE: { rates: [2500, 3200, 4500, 9000, 15000], perKgAbove10: 1500, fuel: 12, security: 400, commission: 18, days: { min: 4, max: 7 } },
        SA: { rates: [2500, 3200, 4500, 9000, 15000], perKgAbove10: 1500, fuel: 12, security: 400, commission: 18, days: { min: 4, max: 7 } },
        QA: { rates: [2500, 3200, 4500, 9000, 15000], perKgAbove10: 1500, fuel: 12, security: 400, commission: 18, days: { min: 4, max: 7 } },
        OM: { rates: [2500, 3200, 4500, 9000, 15000], perKgAbove10: 1500, fuel: 12, security: 400, commission: 18, days: { min: 4, max: 7 } },
        GB: { rates: [3500, 4500, 6500, 14000, 22000], perKgAbove10: 2000, fuel: 15, security: 500, commission: 20, days: { min: 5, max: 10 } },
        US: { rates: [5000, 6000, 8000, 20000, 35000], perKgAbove10: 2500, fuel: 18, security: 600, commission: 22, days: { min: 7, max: 14 } },
        CA: { rates: [5000, 6000, 8000, 20000, 35000], perKgAbove10: 2500, fuel: 18, security: 600, commission: 22, days: { min: 7, max: 14 } },
      };

      const dest = destinationCountry?.toUpperCase() || "IN";
      const defaults = zoneDefaults[dest] || zoneDefaults.IN;
      fuelSurchargePercent = defaults.fuel;
      securitySurcharge = defaults.security;
      commissionPercent = defaults.commission;
      estimatedDays = defaults.days;

      if (chargeableWeightKg <= 0.5) {
        baseDeliveryCharge = defaults.rates[0];
      } else if (chargeableWeightKg <= 1) {
        baseDeliveryCharge = defaults.rates[1];
      } else if (chargeableWeightKg <= 2) {
        baseDeliveryCharge = defaults.rates[2];
      } else if (chargeableWeightKg <= 5) {
        baseDeliveryCharge = defaults.rates[3];
      } else if (chargeableWeightKg <= 10) {
        baseDeliveryCharge = defaults.rates[4];
      } else {
        baseDeliveryCharge = defaults.rates[4] + (chargeableWeightKg - 10) * defaults.perKgAbove10;
      }

      zoneInfo = { zoneType: "default", zoneName: `International (${dest})` };
    }

    const fuelSurchargeAmount = Math.round(baseDeliveryCharge * (fuelSurchargePercent / 100) * 100) / 100;

    const speedSurcharges: Record<string, number> = {
      regular: 0,
      quick: 100,
      express: 200,
      super_express: 400,
    };
    const speedSurcharge = speedSurcharges[deliverySpeed || "regular"] || 0;

    const fragileSurcharge = isFragile ? Math.round(baseDeliveryCharge * 0.1 * 100) / 100 : 0;

    let codFee = 0;
    if (codEnabled && codAmount && codAmount > 0) {
      codFee = Math.max(50, codAmount * 0.015);
    }

    const subtotal = baseDeliveryCharge + fuelSurchargeAmount + securitySurcharge + speedSurcharge + fragileSurcharge + codFee;
    const totalDeliveryCharge = Math.round(subtotal * 100) / 100;

    const commissionAmount = Math.round(totalDeliveryCharge * (commissionPercent / 100) * 100) / 100;
    const domesticPickupFee = 150;
    const driverPayoutAmount = domesticPickupFee;

    const breakdown = [
      { label: "Base Delivery", amount: baseDeliveryCharge },
      { label: `Fuel Surcharge (${fuelSurchargePercent}%)`, amount: fuelSurchargeAmount },
      { label: "Security Fee", amount: securitySurcharge },
    ];
    if (speedSurcharge > 0) breakdown.push({ label: `Speed (${deliverySpeed})`, amount: speedSurcharge });
    if (fragileSurcharge > 0) breakdown.push({ label: "Fragile Handling (10%)", amount: fragileSurcharge });
    if (codFee > 0) breakdown.push({ label: "COD Fee", amount: Math.round(codFee * 100) / 100 });

    return {
      chargeableWeightKg: Math.round(chargeableWeightKg * 100) / 100,
      volumetricWeightKg: Math.round(volumetricWeightKg * 100) / 100,
      baseDeliveryCharge,
      speedSurcharge,
      fragileSurcharge,
      remoteSurcharge: 0,
      fuelSurchargePercent,
      fuelSurchargeAmount,
      securitySurcharge,
      codFee: Math.round(codFee * 100) / 100,
      totalDeliveryCharge,
      commissionAmount,
      driverPayoutAmount,
      currency: "BDT",
      breakdown,
      zoneInfo,
      estimatedDays,
    };
  }

  static async calculatePrice(input: ParcelPricingInput): Promise<ParcelPricingResult> {
    if (input.isInternational) {
      return this.calculateInternationalPrice(input);
    }
    return this.calculateDomesticPrice(input);
  }
}

export async function seedParcelZones() {
  const domesticZones = [
    {
      countryCode: "BD",
      zoneType: "same_city" as const,
      zoneName: "Same City Delivery",
      zoneCode: "SC",
      coverageCities: ["DHK", "CTG", "KHL", "RAJ", "SYL", "BAR", "RNG", "MYM"],
      rate0to1kg: new Prisma.Decimal(100),
      rate1to2kg: new Prisma.Decimal(120),
      rate2to5kg: new Prisma.Decimal(150),
      rate5to10kg: new Prisma.Decimal(250),
      rateAbove10kg: new Prisma.Decimal(30),
    },
    {
      countryCode: "BD",
      zoneType: "inside_division" as const,
      zoneName: "Inside Division",
      zoneCode: "ID",
      coverageCities: [],
      rate0to1kg: new Prisma.Decimal(120),
      rate1to2kg: new Prisma.Decimal(150),
      rate2to5kg: new Prisma.Decimal(180),
      rate5to10kg: new Prisma.Decimal(280),
      rateAbove10kg: new Prisma.Decimal(35),
    },
    {
      countryCode: "BD",
      zoneType: "outside_division" as const,
      zoneName: "Outside Division",
      zoneCode: "OD",
      coverageCities: [],
      rate0to1kg: new Prisma.Decimal(140),
      rate1to2kg: new Prisma.Decimal(170),
      rate2to5kg: new Prisma.Decimal(220),
      rate5to10kg: new Prisma.Decimal(320),
      rateAbove10kg: new Prisma.Decimal(40),
    },
    {
      countryCode: "BD",
      zoneType: "remote" as const,
      zoneName: "Remote Area",
      zoneCode: "RM",
      coverageCities: [],
      rate0to1kg: new Prisma.Decimal(160),
      rate1to2kg: new Prisma.Decimal(200),
      rate2to5kg: new Prisma.Decimal(260),
      rate5to10kg: new Prisma.Decimal(380),
      rateAbove10kg: new Prisma.Decimal(50),
      remoteSurcharge: new Prisma.Decimal(50),
    },
  ];

  for (const zone of domesticZones) {
    await prisma.parcelDomesticZone.upsert({
      where: { countryCode_zoneCode: { countryCode: zone.countryCode, zoneCode: zone.zoneCode } },
      update: zone,
      create: zone,
    });
  }

  const internationalZones = [
    {
      originCountry: "BD",
      zoneType: "zone1_south_asia" as const,
      zoneName: "South Asia",
      destinationCountries: ["IN", "NP", "BT", "LK", "MV"],
      rate0to0_5kg: new Prisma.Decimal(1500),
      rate0_5to1kg: new Prisma.Decimal(2000),
      rate1to2kg: new Prisma.Decimal(3000),
      rate2to5kg: new Prisma.Decimal(7000),
      rate5to10kg: new Prisma.Decimal(12000),
      rateAbove10kg: new Prisma.Decimal(1000),
      fuelSurchargePercent: new Prisma.Decimal(10),
      securitySurcharge: new Prisma.Decimal(300),
      remoteAreaSurcharge: new Prisma.Decimal(800),
      commissionPercent: new Prisma.Decimal(15),
      estimatedDaysMin: 3,
      estimatedDaysMax: 5,
    },
    {
      originCountry: "BD",
      zoneType: "zone3_middle_east" as const,
      zoneName: "Middle East",
      destinationCountries: ["AE", "SA", "QA", "OM", "KW", "BH"],
      rate0to0_5kg: new Prisma.Decimal(2500),
      rate0_5to1kg: new Prisma.Decimal(3200),
      rate1to2kg: new Prisma.Decimal(4500),
      rate2to5kg: new Prisma.Decimal(9000),
      rate5to10kg: new Prisma.Decimal(15000),
      rateAbove10kg: new Prisma.Decimal(1500),
      fuelSurchargePercent: new Prisma.Decimal(12),
      securitySurcharge: new Prisma.Decimal(400),
      remoteAreaSurcharge: new Prisma.Decimal(1000),
      commissionPercent: new Prisma.Decimal(18),
      estimatedDaysMin: 4,
      estimatedDaysMax: 7,
    },
    {
      originCountry: "BD",
      zoneType: "zone5_europe" as const,
      zoneName: "Europe",
      destinationCountries: ["GB", "DE", "FR", "IT", "ES", "NL", "BE", "SE", "NO", "DK", "FI", "PL", "AT", "CH", "IE"],
      rate0to0_5kg: new Prisma.Decimal(3500),
      rate0_5to1kg: new Prisma.Decimal(4500),
      rate1to2kg: new Prisma.Decimal(6500),
      rate2to5kg: new Prisma.Decimal(14000),
      rate5to10kg: new Prisma.Decimal(22000),
      rateAbove10kg: new Prisma.Decimal(2000),
      fuelSurchargePercent: new Prisma.Decimal(15),
      securitySurcharge: new Prisma.Decimal(500),
      remoteAreaSurcharge: new Prisma.Decimal(1200),
      commissionPercent: new Prisma.Decimal(20),
      estimatedDaysMin: 5,
      estimatedDaysMax: 10,
    },
    {
      originCountry: "BD",
      zoneType: "zone6_north_america" as const,
      zoneName: "North America",
      destinationCountries: ["US", "CA", "MX"],
      rate0to0_5kg: new Prisma.Decimal(5000),
      rate0_5to1kg: new Prisma.Decimal(6000),
      rate1to2kg: new Prisma.Decimal(8000),
      rate2to5kg: new Prisma.Decimal(20000),
      rate5to10kg: new Prisma.Decimal(35000),
      rateAbove10kg: new Prisma.Decimal(2500),
      fuelSurchargePercent: new Prisma.Decimal(18),
      securitySurcharge: new Prisma.Decimal(600),
      remoteAreaSurcharge: new Prisma.Decimal(1500),
      commissionPercent: new Prisma.Decimal(22),
      estimatedDaysMin: 7,
      estimatedDaysMax: 14,
    },
  ];

  for (const zone of internationalZones) {
    await prisma.parcelInternationalZone.upsert({
      where: { originCountry_zoneType: { originCountry: zone.originCountry, zoneType: zone.zoneType } },
      update: zone,
      create: zone,
    });
  }

  const surchargeRules = [
    { countryCode: "BD", ruleType: "speed_quick", flatAmount: new Prisma.Decimal(30), displayName: "Quick Delivery (+30৳)" },
    { countryCode: "BD", ruleType: "speed_express", flatAmount: new Prisma.Decimal(60), displayName: "Express Delivery (+60৳)" },
    { countryCode: "BD", ruleType: "speed_super_express", flatAmount: new Prisma.Decimal(120), displayName: "Super Express (+120৳)" },
    { countryCode: "BD", ruleType: "fragile_domestic", flatAmount: new Prisma.Decimal(30), displayName: "Fragile Handling (+30৳)" },
    { countryCode: "BD", ruleType: "fragile_international", percentAmount: new Prisma.Decimal(10), displayName: "Fragile Handling (+10%)" },
    { countryCode: "BD", ruleType: "cod_fee", percentAmount: new Prisma.Decimal(0.8), minAmount: new Prisma.Decimal(10), displayName: "COD Fee (0.8%, min ৳10)" },
  ];

  for (const rule of surchargeRules) {
    await prisma.parcelSurchargeRule.upsert({
      where: { countryCode_ruleType: { countryCode: rule.countryCode, ruleType: rule.ruleType } },
      update: rule,
      create: rule,
    });
  }

  console.log("[ParcelPricingEngine] Seeded BD domestic/international zones and surcharge rules");
}
