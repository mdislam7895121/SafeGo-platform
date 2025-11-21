import { prisma } from "../db";
import { Decimal } from "@prisma/client/runtime/library";
import type { ServiceType, PayeeType } from "@prisma/client";

interface TaxCalculationResult {
  taxAmount: Decimal;
  netAmount: Decimal;
  grossAmount: Decimal;
  appliedRules: Array<{
    taxName: string;
    taxRatePercent: Decimal;
    taxAmount: Decimal;
    isInclusive: boolean;
  }>;
}

interface GetApplicableTaxRulesParams {
  countryCode: string;
  stateCode?: string | null;
  cityCode?: string | null;
  serviceType: ServiceType;
  payeeType: PayeeType;
  date?: Date;
}

/**
 * Get all applicable tax rules for a given context
 * Orders by specificity: city > state > country
 */
export async function getApplicableTaxRules(
  params: GetApplicableTaxRulesParams
) {
  const {
    countryCode,
    stateCode,
    cityCode,
    serviceType,
    payeeType,
    date = new Date(),
  } = params;

  const where: any = {
    countryCode,
    payeeType,
    isActive: true,
    // Date must be within effective range
    AND: [
      {
        effectiveFrom: {
          lte: date,
        },
      },
      {
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: date } },
        ],
      },
    ],
    // Match either specific service or ALL
    appliesTo: {
      in: [serviceType, "ALL"],
    },
  };

  // Build specificity filters - prefer more specific rules
  const cityRules = cityCode
    ? await prisma.taxRule.findMany({
        where: { ...where, cityCode },
        orderBy: { effectiveFrom: "desc" },
      })
    : [];

  if (cityRules.length > 0) {
    return cityRules;
  }

  const stateRules = stateCode
    ? await prisma.taxRule.findMany({
        where: { ...where, stateCode, cityCode: null },
        orderBy: { effectiveFrom: "desc" },
      })
    : [];

  if (stateRules.length > 0) {
    return stateRules;
  }

  // Fallback to country-level rules
  const countryRules = await prisma.taxRule.findMany({
    where: { ...where, stateCode: null, cityCode: null },
    orderBy: { effectiveFrom: "desc" },
  });

  return countryRules;
}

/**
 * Calculate tax on a given amount
 * Handles both inclusive and exclusive tax
 * 
 * For EXCLUSIVE tax: 
 *   - grossAmount = baseAmount + taxAmount
 *   - taxAmount = baseAmount * (taxRate / 100)
 *   - netAmount = baseAmount
 * 
 * For INCLUSIVE tax:
 *   - grossAmount = baseAmount (already includes tax)
 *   - taxAmount = baseAmount * (taxRate / (100 + taxRate))
 *   - netAmount = baseAmount - taxAmount
 */
export async function calculateTax(
  params: GetApplicableTaxRulesParams & { baseAmount: Decimal }
): Promise<TaxCalculationResult> {
  const { baseAmount, ...ruleParams } = params;

  const rules = await getApplicableTaxRules(ruleParams);

  if (rules.length === 0) {
    // No tax rules found
    return {
      taxAmount: new Decimal(0),
      netAmount: baseAmount,
      grossAmount: baseAmount,
      appliedRules: [],
    };
  }

  // Check for mixed inclusive/exclusive rules - this is not allowed
  const hasInclusive = rules.some((r) => r.isInclusive);
  const hasExclusive = rules.some((r) => !r.isInclusive);

  if (hasInclusive && hasExclusive) {
    console.error(
      "[TaxService] Mixed inclusive/exclusive tax rules detected - using exclusive rules only",
      { rules }
    );
    // Filter to only exclusive rules to avoid accounting errors
    const exclusiveRules = rules.filter((r) => !r.isInclusive);
    return calculateTaxForRules(baseAmount, exclusiveRules, false);
  }

  return calculateTaxForRules(baseAmount, rules, hasInclusive);
}

/**
 * Calculate tax for a consistent set of rules (all inclusive or all exclusive)
 */
function calculateTaxForRules(
  baseAmount: Decimal,
  rules: any[],
  isInclusive: boolean
): TaxCalculationResult {
  const appliedRules: TaxCalculationResult["appliedRules"] = [];

  if (isInclusive) {
    // For inclusive taxes, use combined rate approach
    // If gross = $115 with 10% and 5% inclusive taxes:
    // Combined rate = 15%, net = $115 / 1.15 = $100, total tax = $15
    
    // Calculate combined tax rate
    const combinedRate = rules.reduce(
      (sum, rule) => sum.plus(rule.taxRatePercent),
      new Decimal(0)
    );

    const grossAmount = baseAmount;
    // net = gross / (1 + combinedRate/100)
    const netAmount = baseAmount.div(
      new Decimal(1).plus(combinedRate.div(100))
    );
    const totalTaxAmount = grossAmount.minus(netAmount);

    // Distribute total tax proportionally among rules
    for (const rule of rules) {
      const rateDecimal = rule.taxRatePercent;
      // Each rule's share = (its rate / combined rate) * total tax
      const taxAmount = totalTaxAmount.mul(rateDecimal).div(combinedRate);

      appliedRules.push({
        taxName: rule.taxName,
        taxRatePercent: rule.taxRatePercent,
        taxAmount,
        isInclusive: true,
      });
    }

    return {
      taxAmount: totalTaxAmount,
      netAmount,
      grossAmount,
      appliedRules,
    };
  } else {
    // For exclusive taxes, simple addition works correctly
    let totalTaxAmount = new Decimal(0);

    for (const rule of rules) {
      const rateDecimal = rule.taxRatePercent;
      // taxAmount = baseAmount * (taxRate / 100)
      const taxAmount = baseAmount.mul(rateDecimal).div(100);

      totalTaxAmount = totalTaxAmount.plus(taxAmount);

      appliedRules.push({
        taxName: rule.taxName,
        taxRatePercent: rule.taxRatePercent,
        taxAmount,
        isInclusive: false,
      });
    }

    const netAmount = baseAmount;
    const grossAmount = baseAmount.plus(totalTaxAmount);

    return {
      taxAmount: totalTaxAmount,
      netAmount,
      grossAmount,
      appliedRules,
    };
  }
}

/**
 * Calculate tax for a ride
 */
export async function calculateRideTax(params: {
  countryCode: string;
  stateCode?: string | null;
  cityCode?: string | null;
  driverPayout: Decimal;
  customerFare: Decimal;
  date?: Date;
}) {
  const { countryCode, stateCode, cityCode, driverPayout, customerFare, date } =
    params;

  // Calculate driver tax
  const driverTax = await calculateTax({
    countryCode,
    stateCode,
    cityCode,
    serviceType: "RIDE",
    payeeType: "DRIVER",
    baseAmount: driverPayout,
    date,
  });

  // Calculate customer tax
  const customerTax = await calculateTax({
    countryCode,
    stateCode,
    cityCode,
    serviceType: "RIDE",
    payeeType: "CUSTOMER",
    baseAmount: customerFare,
    date,
  });

  return {
    driver: driverTax,
    customer: customerTax,
  };
}

/**
 * Calculate tax for a food order
 */
export async function calculateFoodOrderTax(params: {
  countryCode: string;
  stateCode?: string | null;
  cityCode?: string | null;
  restaurantPayout: Decimal;
  customerFare: Decimal;
  date?: Date;
}) {
  const {
    countryCode,
    stateCode,
    cityCode,
    restaurantPayout,
    customerFare,
    date,
  } = params;

  // Calculate restaurant tax
  const restaurantTax = await calculateTax({
    countryCode,
    stateCode,
    cityCode,
    serviceType: "FOOD",
    payeeType: "RESTAURANT",
    baseAmount: restaurantPayout,
    date,
  });

  // Calculate customer tax
  const customerTax = await calculateTax({
    countryCode,
    stateCode,
    cityCode,
    serviceType: "FOOD",
    payeeType: "CUSTOMER",
    baseAmount: customerFare,
    date,
  });

  return {
    restaurant: restaurantTax,
    customer: customerTax,
  };
}

/**
 * Calculate tax for a parcel delivery
 */
export async function calculateParcelTax(params: {
  countryCode: string;
  stateCode?: string | null;
  cityCode?: string | null;
  driverPayout: Decimal;
  customerFare: Decimal;
  date?: Date;
}) {
  const { countryCode, stateCode, cityCode, driverPayout, customerFare, date } =
    params;

  // Calculate driver tax
  const driverTax = await calculateTax({
    countryCode,
    stateCode,
    cityCode,
    serviceType: "PARCEL",
    payeeType: "DRIVER",
    baseAmount: driverPayout,
    date,
  });

  // Calculate customer tax
  const customerTax = await calculateTax({
    countryCode,
    stateCode,
    cityCode,
    serviceType: "PARCEL",
    payeeType: "CUSTOMER",
    baseAmount: customerFare,
    date,
  });

  return {
    driver: driverTax,
    customer: customerTax,
  };
}
