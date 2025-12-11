/**
 * SafeGo Driver Delivery Configuration
 * Step 49: Driver Food-Delivery Web App Configuration
 * 
 * This module defines configuration for driver food delivery operations including:
 * - Feature toggles (food delivery, demo mode, proof photos)
 * - Location update intervals
 * - Cash negative balance blocking thresholds
 */

export interface CashBlockingThreshold {
  BD: number;
  US: number;
}

export interface DriverDeliveryConfigType {
  enableFoodDelivery: boolean;
  locationUpdateIntervalSeconds: number;
  maxDeliveryRadiusKm: number;
  cashNegativeBalanceBlockThreshold: CashBlockingThreshold;
  enableProofPhoto: boolean;
  enableDemoMode: boolean;
  pollingIntervalSeconds: number;
  maxPendingDeliveriesShown: number;
}

export const driverDeliveryConfig: DriverDeliveryConfigType = {
  enableFoodDelivery: true,
  locationUpdateIntervalSeconds: 10,
  maxDeliveryRadiusKm: 8,
  cashNegativeBalanceBlockThreshold: {
    BD: 2000,
    US: 100,
  },
  enableProofPhoto: false,
  enableDemoMode: true,
  pollingIntervalSeconds: 5,
  maxPendingDeliveriesShown: 10,
};

export function getCashBlockingThreshold(countryCode: string): number {
  if (countryCode === "BD") {
    return driverDeliveryConfig.cashNegativeBalanceBlockThreshold.BD;
  }
  return driverDeliveryConfig.cashNegativeBalanceBlockThreshold.US;
}

export function isDriverBlockedForCashDeliveries(
  driverNegativeBalance: number,
  countryCode: string
): boolean {
  const threshold = getCashBlockingThreshold(countryCode);
  return driverNegativeBalance > threshold;
}

export function getDriverDeliveryConfigSummary(): DriverDeliveryConfigType {
  return { ...driverDeliveryConfig };
}
