import { prisma } from "../db";
import { Decimal } from "@prisma/client/runtime/library";
import type { ServiceType, TaxType } from "@prisma/client";

export interface TaxBreakdownItem {
  taxType: TaxType;
  taxName: string;
  percentRate: Decimal | null;
  flatFee: Decimal | null;
  taxAmount: Decimal;
}

interface TaxCalculationResult {
  taxBreakdown: TaxBreakdownItem[];
  totalTaxAmount: Decimal;
}

interface GetApplicableTaxRulesParams {
  countryCode: string;
  cityCode?: string | null;
  serviceType: ServiceType;
}

/**
 * Get all applicable tax rules for a given context
 * City-specific rules override country-level rules
 */
export async function getApplicableTaxRules(
  params: GetApplicableTaxRulesParams
) {
  const { countryCode, cityCode, serviceType } = params;

  const where: any = {
    countryCode,
    serviceType,
    isActive: true,
  };

  // Prefer city-specific rules if cityCode is provided
  if (cityCode) {
    const cityRules = await prisma.taxRule.findMany({
      where: { ...where, cityCode },
      orderBy: { createdAt: "desc" },
    });

    if (cityRules.length > 0) {
      return cityRules;
    }
  }

  // Fallback to country-level rules
  const countryRules = await prisma.taxRule.findMany({
    where: { ...where, cityCode: null },
    orderBy: { createdAt: "desc" },
  });

  return countryRules;
}

/**
 * Calculate tax on a given base fare using Uber-style logic
 * Formula: taxAmount = baseFare * (percentRate/100) + flatFee
 * Multiple taxes stack (all amounts add together)
 */
export async function calculateTax(
  params: GetApplicableTaxRulesParams & { baseFare: Decimal }
): Promise<TaxCalculationResult> {
  const { baseFare, ...ruleParams } = params;

  const rules = await getApplicableTaxRules(ruleParams);

  if (rules.length === 0) {
    return {
      taxBreakdown: [],
      totalTaxAmount: new Decimal(0),
    };
  }

  const taxBreakdown: TaxBreakdownItem[] = [];
  let totalTaxAmount = new Decimal(0);

  for (const rule of rules) {
    let taxAmount = new Decimal(0);

    // Calculate percentage-based tax
    if (rule.percentRate) {
      const percentTax = baseFare.mul(rule.percentRate).div(100);
      taxAmount = taxAmount.plus(percentTax);
    }

    // Add flat fee
    if (rule.flatFee) {
      taxAmount = taxAmount.plus(rule.flatFee);
    }

    // Generate tax name from tax type
    const taxName = getTaxName(rule.taxType);

    taxBreakdown.push({
      taxType: rule.taxType,
      taxName,
      percentRate: rule.percentRate,
      flatFee: rule.flatFee,
      taxAmount,
    });

    totalTaxAmount = totalTaxAmount.plus(taxAmount);
  }

  return {
    taxBreakdown,
    totalTaxAmount,
  };
}

/**
 * Convert TaxType enum to human-readable name
 */
function getTaxName(taxType: TaxType): string {
  const nameMap: Record<TaxType, string> = {
    VAT: "VAT",
    SALES_TAX: "Sales Tax",
    GOVERNMENT_SERVICE_FEE: "Government Service Fee",
    MARKETPLACE_FACILITATOR_TAX: "Marketplace Facilitator Tax",
    TRIP_FEE: "Trip Fee",
    LOCAL_MUNICIPALITY_FEE: "Local Municipality Fee",
    REGULATORY_FEE: "Regulatory Fee",
  };
  return nameMap[taxType] || taxType;
}

/**
 * Calculate tax for a ride
 */
export async function calculateRideTax(params: {
  countryCode: string;
  cityCode?: string | null;
  baseFare: Decimal;
}) {
  return calculateTax({
    ...params,
    serviceType: "RIDE",
  });
}

/**
 * Calculate tax for a food order
 */
export async function calculateFoodOrderTax(params: {
  countryCode: string;
  cityCode?: string | null;
  baseFare: Decimal;
}) {
  return calculateTax({
    ...params,
    serviceType: "FOOD",
  });
}

/**
 * Calculate tax for a parcel delivery
 */
export async function calculateParcelTax(params: {
  countryCode: string;
  cityCode?: string | null;
  baseFare: Decimal;
}) {
  return calculateTax({
    ...params,
    serviceType: "PARCEL",
  });
}
