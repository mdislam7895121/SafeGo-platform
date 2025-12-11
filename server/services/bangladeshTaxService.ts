/**
 * Bangladesh Tax Service
 * 
 * Reusable tax calculation engine for Bangladesh (BD) only.
 * Supports 6 service types: ride, food, parcel, shop, ticket, rental
 * 
 * Rules:
 * - If country_code != "BD": Return zero tax, no behavior change
 * - If country_code == "BD": Apply VAT based on bd_tax_rules config
 */

import { prisma } from "../lib/prisma";
import { BdServiceType } from "@prisma/client";
import Decimal from "decimal.js";

export interface BdTaxInput {
  serviceType: "ride" | "food" | "parcel" | "shop" | "ticket" | "rental";
  countryCode: string | null | undefined;
  baseAmount: number | string;
}

export interface BdTaxResult {
  bdTaxType: string | null;
  bdTaxRate: number;
  bdTaxAmount: number;
  bdFareBeforeTax: number;
  bdFareAfterTax: number;
}

const SERVICE_TYPE_MAP: Record<string, BdServiceType> = {
  ride: "ride",
  food: "food",
  parcel: "parcel",
  shop: "shop",
  ticket: "ticket",
  rental: "rental",
};

export async function calculateBangladeshTax(input: BdTaxInput): Promise<BdTaxResult> {
  const { serviceType, countryCode, baseAmount } = input;
  const baseAmountDecimal = new Decimal(baseAmount || 0);

  if (countryCode !== "BD") {
    return {
      bdTaxType: null,
      bdTaxRate: 0,
      bdTaxAmount: 0,
      bdFareBeforeTax: baseAmountDecimal.toNumber(),
      bdFareAfterTax: baseAmountDecimal.toNumber(),
    };
  }

  try {
    const bdServiceType = SERVICE_TYPE_MAP[serviceType];
    if (!bdServiceType) {
      console.error(`[BdTax] Invalid service type: ${serviceType}`);
      return {
        bdTaxType: null,
        bdTaxRate: 0,
        bdTaxAmount: 0,
        bdFareBeforeTax: baseAmountDecimal.toNumber(),
        bdFareAfterTax: baseAmountDecimal.toNumber(),
      };
    }

    const taxRule = await prisma.bdTaxRule.findUnique({
      where: {
        serviceType: bdServiceType,
      },
    });

    if (!taxRule || !taxRule.isActive) {
      console.log(`[BdTax] No active tax rule for ${serviceType} in BD`);
      return {
        bdTaxType: null,
        bdTaxRate: 0,
        bdTaxAmount: 0,
        bdFareBeforeTax: baseAmountDecimal.toNumber(),
        bdFareAfterTax: baseAmountDecimal.toNumber(),
      };
    }

    const taxRatePercentage = new Decimal(taxRule.bdTaxRatePercentage);
    const bdTaxAmount = baseAmountDecimal.mul(taxRatePercentage).div(100);
    const bdFareAfterTax = baseAmountDecimal.plus(bdTaxAmount);

    return {
      bdTaxType: taxRule.bdTaxType,
      bdTaxRate: taxRatePercentage.toNumber(),
      bdTaxAmount: bdTaxAmount.toDecimalPlaces(2).toNumber(),
      bdFareBeforeTax: baseAmountDecimal.toDecimalPlaces(2).toNumber(),
      bdFareAfterTax: bdFareAfterTax.toDecimalPlaces(2).toNumber(),
    };
  } catch (error) {
    console.error(`[BdTax] Error calculating tax for ${serviceType}:`, error);
    return {
      bdTaxType: null,
      bdTaxRate: 0,
      bdTaxAmount: 0,
      bdFareBeforeTax: baseAmountDecimal.toNumber(),
      bdFareAfterTax: baseAmountDecimal.toNumber(),
    };
  }
}

export async function calculateBdCommissionWithTax(
  commissionBase: number,
  countryCode: string | null | undefined
): Promise<{
  commissionBase: number;
  bdTaxOnCommission: number;
  commissionTotal: number;
  taxRate: number;
}> {
  if (countryCode !== "BD") {
    return {
      commissionBase,
      bdTaxOnCommission: 0,
      commissionTotal: commissionBase,
      taxRate: 0,
    };
  }

  try {
    const taxRule = await prisma.bdTaxRule.findFirst({
      where: {
        isActive: true,
      },
    });

    if (!taxRule) {
      return {
        commissionBase,
        bdTaxOnCommission: 0,
        commissionTotal: commissionBase,
        taxRate: 0,
      };
    }

    const taxRatePercentage = new Decimal(taxRule.bdTaxRatePercentage);
    const commissionBaseDecimal = new Decimal(commissionBase);
    const bdTaxOnCommission = commissionBaseDecimal.mul(taxRatePercentage).div(100);
    const commissionTotal = commissionBaseDecimal.plus(bdTaxOnCommission);

    return {
      commissionBase,
      bdTaxOnCommission: bdTaxOnCommission.toDecimalPlaces(2).toNumber(),
      commissionTotal: commissionTotal.toDecimalPlaces(2).toNumber(),
      taxRate: taxRatePercentage.toNumber(),
    };
  } catch (error) {
    console.error("[BdTax] Error calculating commission tax:", error);
    return {
      commissionBase,
      bdTaxOnCommission: 0,
      commissionTotal: commissionBase,
      taxRate: 0,
    };
  }
}

export async function seedBdTaxRules(): Promise<void> {
  const serviceTypes: BdServiceType[] = ["ride", "food", "parcel", "shop", "ticket", "rental"];

  for (const serviceType of serviceTypes) {
    const existing = await prisma.bdTaxRule.findUnique({
      where: { serviceType },
    });

    if (!existing) {
      await prisma.bdTaxRule.create({
        data: {
          serviceType,
          bdTaxType: "vat",
          bdTaxRatePercentage: 15.00,
          isActive: true,
        },
      });
      console.log(`[BdTax] Created default tax rule for ${serviceType}: 15% VAT`);
    }
  }
}

export async function getBdTaxRules() {
  return prisma.bdTaxRule.findMany({
    orderBy: { serviceType: "asc" },
  });
}

export async function updateBdTaxRule(
  serviceType: BdServiceType,
  data: {
    bdTaxRatePercentage?: number;
    isActive?: boolean;
  },
  adminId?: string
) {
  return prisma.bdTaxRule.update({
    where: { serviceType },
    data: {
      ...data,
      updatedByAdminId: adminId,
      updatedAt: new Date(),
    },
  });
}
