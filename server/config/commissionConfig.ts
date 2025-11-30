/**
 * SafeGo Official Commission Configuration
 * 
 * This module defines the official commission rates per country for:
 * - Restaurants (food orders)
 * - Drivers (rides + deliveries)
 * 
 * These are the platform's core commission rules applied across all services.
 * DO NOT modify these values - use adminCommissionOverrideConfig for temporary adjustments.
 */

export interface CountryCommissionConfig {
  restaurant_commission_percent: number;
  driver_commission_percent: number;
  currency: string;
}

export interface CommissionConfigType {
  BD: CountryCommissionConfig;
  US: CountryCommissionConfig;
}

export const commissionConfig: CommissionConfigType = {
  BD: {
    restaurant_commission_percent: 12,
    driver_commission_percent: 10,
    currency: "BDT"
  },
  US: {
    restaurant_commission_percent: 15,
    driver_commission_percent: 10,
    currency: "USD"
  }
};

export interface AdminCommissionOverride {
  countryCode: "BD" | "US";
  restaurant_commission_percent?: number;
  driver_commission_percent?: number;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  overrideReason?: string;
}

export const adminCommissionOverrideConfig: AdminCommissionOverride[] = [];

export function getRestaurantCommissionRate(countryCode: "BD" | "US"): number {
  const override = adminCommissionOverrideConfig.find(o => 
    o.countryCode === countryCode && 
    o.restaurant_commission_percent !== undefined &&
    (!o.effectiveFrom || new Date() >= o.effectiveFrom) &&
    (!o.effectiveTo || new Date() <= o.effectiveTo)
  );
  
  if (override?.restaurant_commission_percent !== undefined) {
    return override.restaurant_commission_percent;
  }
  
  return commissionConfig[countryCode].restaurant_commission_percent;
}

export function getDriverCommissionRate(countryCode: "BD" | "US"): number {
  const override = adminCommissionOverrideConfig.find(o => 
    o.countryCode === countryCode && 
    o.driver_commission_percent !== undefined &&
    (!o.effectiveFrom || new Date() >= o.effectiveFrom) &&
    (!o.effectiveTo || new Date() <= o.effectiveTo)
  );
  
  if (override?.driver_commission_percent !== undefined) {
    return override.driver_commission_percent;
  }
  
  return commissionConfig[countryCode].driver_commission_percent;
}

export function getCurrency(countryCode: "BD" | "US"): string {
  return commissionConfig[countryCode].currency;
}

export function calculateRestaurantCommission(
  totalAmountChargedToCustomer: number,
  countryCode: "BD" | "US"
): {
  platformCommissionAmount: number;
  restaurantEarnings: number;
  commissionRate: number;
  currency: string;
} {
  const commissionRate = getRestaurantCommissionRate(countryCode);
  const platformCommissionAmount = (totalAmountChargedToCustomer * commissionRate) / 100;
  const restaurantEarnings = totalAmountChargedToCustomer - platformCommissionAmount;
  
  return {
    platformCommissionAmount: parseFloat(platformCommissionAmount.toFixed(2)),
    restaurantEarnings: parseFloat(restaurantEarnings.toFixed(2)),
    commissionRate,
    currency: getCurrency(countryCode)
  };
}

export function calculateDriverCommission(
  totalAmountChargedToCustomer: number,
  countryCode: "BD" | "US"
): {
  platformCommissionAmount: number;
  driverEarningsAmount: number;
  commissionRate: number;
  currency: string;
} {
  const commissionRate = getDriverCommissionRate(countryCode);
  const platformCommissionAmount = (totalAmountChargedToCustomer * commissionRate) / 100;
  const driverEarningsAmount = totalAmountChargedToCustomer - platformCommissionAmount;
  
  return {
    platformCommissionAmount: parseFloat(platformCommissionAmount.toFixed(2)),
    driverEarningsAmount: parseFloat(driverEarningsAmount.toFixed(2)),
    commissionRate,
    currency: getCurrency(countryCode)
  };
}

export function getCommissionConfigSummary(): {
  BD: CountryCommissionConfig;
  US: CountryCommissionConfig;
  activeOverrides: AdminCommissionOverride[];
} {
  const now = new Date();
  const activeOverrides = adminCommissionOverrideConfig.filter(o =>
    (!o.effectiveFrom || now >= o.effectiveFrom) &&
    (!o.effectiveTo || now <= o.effectiveTo)
  );
  
  return {
    BD: {
      restaurant_commission_percent: getRestaurantCommissionRate("BD"),
      driver_commission_percent: getDriverCommissionRate("BD"),
      currency: "BDT"
    },
    US: {
      restaurant_commission_percent: getRestaurantCommissionRate("US"),
      driver_commission_percent: getDriverCommissionRate("US"),
      currency: "USD"
    },
    activeOverrides
  };
}
